import React, { useRef, useEffect, useCallback, memo, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { FileTreeProvider, useFileTreeActions, useFileTreeState } from "./FileTreeContext";
import { FileTreeFilters } from "./FileTreeFilters";
import { FileTreeRow } from "./FileTreeRow";
import { FileTreeEmpty } from "./FileTreeEmpty";
import { useToast } from "../ui/toast";
import { parseSearchQuery } from "@/lib/searchFilters";

interface FileTreeProps {
  onSelectionChange?: (selectedPaths: string[]) => void;
  searchQuery?: string;
  initialSelectedPaths?: string[];
  shouldClearSelection?: boolean;
}

// Inner component that uses the context
const FileTreeInner = memo(function FileTreeInner({
  searchQuery = "",
  initialSelectedPaths,
  shouldClearSelection,
}: Omit<FileTreeProps, "onSelectionChange">) {
  const { state, flatTree } = useFileTreeState();
  const { loadRootEntries, clearSelection, applyInitialSelection } = useFileTreeActions();
  const parentRef = useRef<HTMLDivElement>(null);
  const previousClearSelection = useRef(false);
  const { success } = useToast();

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: flatTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Copy path to clipboard
  const handleCopyPath = useCallback(
    (path: string) => {
      navigator.clipboard.writeText(path).then(() => {
        success("Path copied to clipboard");
      });
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

  // Check if we're in search mode (flat results) or tree mode
  const isSearchMode = !!searchQuery;
  const parsedFilters = useMemo(() => parseSearchQuery(searchQuery), [searchQuery]);
  const highlightQuery = parsedFilters.fileName ?? parsedFilters.directoryName ?? parsedFilters.plainText ?? "";

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

              return (
                <FileTreeRow
                  key={node.path}
                  node={node}
                  level={flatNode.level}
                  offsetTop={virtualRow.start}
                  onCopyPath={handleCopyPath}
                  showFullPath={isSearchMode}
                  highlightQuery={highlightQuery}
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
