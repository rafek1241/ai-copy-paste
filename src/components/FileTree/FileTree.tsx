import React, { useRef, useEffect, useCallback, useMemo, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { FileTreeProvider, useFileTreeActions, useFileTreeState } from "./FileTreeContext";
import { FileTreeFilters } from "./FileTreeFilters";
import { FileTreeRow } from "./FileTreeRow";
import { FileTreeEmpty } from "./FileTreeEmpty";
import { useToast } from "../ui/toast";
import { copyToClipboard } from "@/services/clipboard";

interface FileTreeProps {
  onSelectionChange?: (selectedPaths: string[]) => void;
  searchQuery?: string;
  initialSelectedPaths?: string[];
  shouldClearSelection?: boolean;
}

const toCanonicalPath = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");

  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith("//")) {
    return normalized.toLowerCase();
  }

  return normalized;
};

// Inner component that uses the context
const FileTreeInner = memo(function FileTreeInner({
  searchQuery = "",
  initialSelectedPaths,
  shouldClearSelection,
}: Omit<FileTreeProps, "onSelectionChange">) {
  const { state, flatTree } = useFileTreeState();
  const { loadRootEntries, clearSelection, applyInitialSelection } = useFileTreeActions();
  const parentRef = useRef<HTMLDivElement>(null);
  const nodesMapRef = useRef(state.nodesMap);
  const refreshSensitiveStateRef = useRef<() => Promise<void>>(async () => {});
  const previousClearSelection = useRef(false);
  const sensitiveScanRequestRef = useRef(0);
  const [sensitiveDataEnabled, setSensitiveDataEnabled] = React.useState(false);
  const [preventSelectionEnabled, setPreventSelectionEnabled] = React.useState(false);
  const [sensitiveByPath, setSensitiveByPath] = React.useState<Record<string, boolean>>({});
  const { success } = useToast();

  useEffect(() => {
    nodesMapRef.current = state.nodesMap;
  }, [state.nodesMap]);

  const refreshSensitiveState = useCallback(async () => {
    const requestId = sensitiveScanRequestRef.current + 1;
    sensitiveScanRequestRef.current = requestId;

    try {
      const [enabled, preventSelection] = await Promise.all([
        invoke<boolean>("get_sensitive_data_enabled"),
        invoke<boolean>("get_prevent_selection"),
      ]);

      if (sensitiveScanRequestRef.current !== requestId) {
        return;
      }

      setSensitiveDataEnabled(enabled);
      setPreventSelectionEnabled(enabled && preventSelection);

      if (!enabled) {
        setSensitiveByPath({});
        return;
      }

      const pathSet = new Set<string>();
      for (const node of Object.values(nodesMapRef.current)) {
        pathSet.add(node.path);

        if (!node.is_dir && node.parent_path) {
          pathSet.add(`${node.parent_path}/${node.name}`);
        }
      }

      const paths = Array.from(pathSet);

      if (paths.length === 0) {
        setSensitiveByPath({});
        return;
      }

      const markedPaths = await invoke<string[]>("get_sensitive_marked_paths", {
        paths,
      });

      if (sensitiveScanRequestRef.current !== requestId) {
        return;
      }

      const nextSensitiveByPath: Record<string, boolean> = {};
      for (const path of markedPaths || []) {
        const canonicalPath = toCanonicalPath(path);
        nextSensitiveByPath[canonicalPath] = true;
      }

      setSensitiveByPath(nextSensitiveByPath);
    } catch (error) {
      console.warn("Failed to refresh sensitive scan state:", error);
      setSensitiveByPath({});
      setSensitiveDataEnabled(false);
      setPreventSelectionEnabled(false);
    }
  }, []);

  useEffect(() => {
    refreshSensitiveStateRef.current = refreshSensitiveState;
  }, [refreshSensitiveState]);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: flatTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Copy path to clipboard
  const handleCopyPath = useCallback(
    async (path: string) => {
      try {
        await copyToClipboard(path);
        success("Path copied to clipboard");
      } catch (error) {
        console.warn("Failed to copy path:", error);
      }
    },
    [success]
  );

  // Listen to refresh events
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupRefreshListener = async () => {
      unlisten = await listen("refresh-file-tree", () => {
        console.log("Refreshing file tree...");
        loadRootEntries();
      });
    };

    setupRefreshListener();

    return () => {
      unlisten?.();
    };
  }, [loadRootEntries]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let isDisposed = false;

    const setupSensitiveSettingsListener = async () => {
      const dispose = await listen("sensitive-settings-changed", () => {
        void refreshSensitiveStateRef.current();
      });

      if (isDisposed) {
        dispose();
        return;
      }

      unlisten = dispose;
    };

    setupSensitiveSettingsListener();

    return () => {
      isDisposed = true;
      unlisten?.();
    };
  }, []);

  // Listen to indexing progress
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupProgressListener = async () => {
      unlisten = await listen("indexing-progress", (event: { payload: { current_path: string } }) => {
        if (event.payload.current_path === "Complete") {
          loadRootEntries();
        }
      });
    };

    setupProgressListener();

    return () => {
      unlisten?.();
    };
  }, [loadRootEntries]);

  // Restore selection from initial paths
  useEffect(() => {
    if (initialSelectedPaths && initialSelectedPaths.length > 0 && state.rootPaths.length > 0) {
      applyInitialSelection(initialSelectedPaths);
    }
  }, [initialSelectedPaths, state.rootPaths.length, applyInitialSelection]);

  // Clear selection when signaled
  useEffect(() => {
    const shouldTrigger = shouldClearSelection && !previousClearSelection.current;
    previousClearSelection.current = !!shouldClearSelection;
    if (shouldTrigger) {
      clearSelection();
    }
  }, [shouldClearSelection, clearSelection]);

  // Load root entries on mount
  useEffect(() => {
    loadRootEntries();
  }, [loadRootEntries]);

  useEffect(() => {
    void refreshSensitiveStateRef.current();
  }, [flatTree.length]);

  // Extract highlight query from search string for UI highlighting
  const isSearchMode = !!searchQuery;
  const highlightQuery = (() => {
    const trimmed = (searchQuery || "").trim();
    if (!trimmed) return "";
    // Extract the meaningful search term (strip file:/dir: prefixes)
    const parts = trimmed.split(/\s+/).filter(
      (p) => !p.toLowerCase().startsWith("file:") && !p.toLowerCase().startsWith("dir:")
    );
    if (parts.length > 0) return parts.join(" ");
    // If only prefixed filters, use the value after the colon
    const match = trimmed.match(/(?:file:|dir:)(\S+)/i);
    return match ? match[1] : trimmed;
  })();

  // Detect duplicate names in search results for disambiguation
  const duplicateNames = useMemo(() => {
    if (!isSearchMode) return new Set<string>();
    const nameCounts = new Map<string, number>();
    for (const item of flatTree) {
      if (item.level === 0) {
        const node = state.nodesMap[item.path];
        if (node) {
          nameCounts.set(node.name, (nameCounts.get(node.name) || 0) + 1);
        }
      }
    }
    const dupes = new Set<string>();
    for (const [name, count] of nameCounts) {
      if (count > 1) dupes.add(name);
    }
    return dupes;
  }, [isSearchMode, flatTree, state.nodesMap]);

  return (
    <div
      className="flex flex-col h-full w-full bg-[#0d1117] text-[#c9d1d9] overflow-hidden"
      data-testid="file-tree-container"
      role="tree"
      aria-label="File tree"
    >
      <FileTreeFilters />

      <div
        ref={parentRef}
        className="flex-1 overflow-auto relative custom-scrollbar"
        data-testid="file-tree-scroll"
      >
        {flatTree.length === 0 ? (
          <FileTreeEmpty hasSearchQuery={!!searchQuery} />
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const flatNode = flatTree[virtualRow.index];
              const node = flatNode ? state.nodesMap[flatNode.path] : undefined;
              if (!node) {
                return null;
              }

              // In search mode, show disambiguation path for level-0 items with duplicate names
              const needsDisambiguation = isSearchMode && flatNode.level === 0 && duplicateNames.has(node.name);
              const nodePathCanonical = toCanonicalPath(node.path);
              const reconstructedPathCanonical =
                !node.is_dir && node.parent_path
                  ? toCanonicalPath(`${node.parent_path}/${node.name}`)
                  : null;

              const hasSensitiveData =
                !!sensitiveByPath[nodePathCanonical] ||
                (!!reconstructedPathCanonical && !!sensitiveByPath[reconstructedPathCanonical]);
              const hideSelectionCheckbox =
                !!hasSensitiveData && sensitiveDataEnabled && preventSelectionEnabled;

              return (
                <FileTreeRow
                  key={node.path}
                  node={node}
                  level={flatNode.level}
                  offsetTop={virtualRow.start}
                  onCopyPath={handleCopyPath}
                  showFullPath={false}
                  disambiguationPath={needsDisambiguation ? node.parent_path ?? undefined : undefined}
                  highlightQuery={highlightQuery}
                  hasSensitiveData={hasSensitiveData}
                  showSensitiveIndicator={sensitiveDataEnabled}
                  hideSelectionCheckbox={hideSelectionCheckbox}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// Wrapper component that provides the context
export const FileTree: React.FC<FileTreeProps> = ({
  onSelectionChange,
  searchQuery,
  initialSelectedPaths,
  shouldClearSelection,
}) => {
  return (
    <FileTreeProvider searchQuery={searchQuery} onSelectionChange={onSelectionChange}>
      <FileTreeInner
        searchQuery={searchQuery}
        initialSelectedPaths={initialSelectedPaths}
        shouldClearSelection={shouldClearSelection}
      />
    </FileTreeProvider>
  );
};

// Re-export sub-components for testing
export { FileTreeProvider, useFileTree } from "./FileTreeContext";
export { FileTreeFilters } from "./FileTreeFilters";
export { FileTreeRow } from "./FileTreeRow";
export { FileTreeEmpty } from "./FileTreeEmpty";
