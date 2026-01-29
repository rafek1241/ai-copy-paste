import React, { useRef, useEffect, useCallback, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { FileTreeProvider, useFileTree } from "./FileTreeContext";
import { FileTreeFilters } from "./FileTreeFilters";
import { FileTreeRow } from "./FileTreeRow";
import { FileTreeEmpty } from "./FileTreeEmpty";
import { useToast } from "../ui/toast";

interface FileTreeProps {
  onSelectionChange?: (selectedPaths: string[], selectedIds: number[]) => void;
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
  const { state, loadRootEntries, dispatch, toggleCheck } = useFileTree();
  const parentRef = useRef<HTMLDivElement>(null);
  const { success } = useToast();

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: state.flatTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
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
    if (initialSelectedPaths && initialSelectedPaths.length > 0 && state.rootIds.length > 0) {
      const pathsSet = new Set(initialSelectedPaths);

      Object.values(state.nodesMap).forEach((node) => {
        if (!node.is_dir && pathsSet.has(node.path) && !node.checked) {
          toggleCheck(node.id, true);
        }
      });
    }
  }, [initialSelectedPaths, state.rootIds.length, state.nodesMap, toggleCheck]);

  // Clear selection when signaled
  useEffect(() => {
    if (shouldClearSelection) {
      const newMap = { ...state.nodesMap };

      Object.keys(newMap).forEach((id) => {
        const node = newMap[Number(id)];
        if (node) {
          newMap[Number(id)] = { ...node, checked: false, indeterminate: false };
        }
      });

      dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });
    }
  }, [shouldClearSelection, dispatch, state.nodesMap]);

  // Load root entries on mount
  useEffect(() => {
    loadRootEntries();
  }, [loadRootEntries]);

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
        {state.flatTree.length === 0 ? (
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
              const node = state.flatTree[virtualRow.index];

              return (
                <FileTreeRow
                  key={virtualRow.key}
                  node={node}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onCopyPath={handleCopyPath}
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
