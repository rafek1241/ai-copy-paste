import { useEffect, useRef } from "react";
import type React from "react";
import type { TreeNode } from "../../types";
import { searchIndexedPaths } from "./fileTreeServices";
import type { FileTreeAction, FileTreeState } from "./fileTreeTypes";

interface UseFileTreeSearchParams {
  searchQuery: string;
  stateRef: React.MutableRefObject<FileTreeState>;
  dispatch: React.Dispatch<FileTreeAction>;
  normalizePath: (filePath: string) => string;
}

interface UseFileTreeSearchResult {
  isSearchMode: boolean;
  searchResultRootsRef: React.MutableRefObject<string[]>;
}

export function useFileTreeSearch({
  searchQuery,
  stateRef,
  dispatch,
  normalizePath,
}: UseFileTreeSearchParams): UseFileTreeSearchResult {
  const isSearchMode = !!searchQuery.trim();
  const previousSearchActiveRef = useRef(false);
  const previousExpandedPathsRef = useRef<Set<string> | null>(null);
  const searchRequestIdRef = useRef(0);
  const searchResultRootsRef = useRef<string[]>([]);

  useEffect(() => {
    const isActive = !!searchQuery.trim();
    const wasActive = previousSearchActiveRef.current;

    if (isActive && !wasActive) {
      const currentState = stateRef.current;
      const prevExpanded = new Set<string>();
      const newMap: Record<string, TreeNode> = { ...currentState.nodesMap };
      let hasChanges = false;

      Object.values(currentState.nodesMap).forEach((node) => {
        if (node.is_dir && node.expanded) {
          prevExpanded.add(node.path);
          newMap[node.path] = { ...node, expanded: false };
          hasChanges = true;
        }
      });

      previousExpandedPathsRef.current = prevExpanded;
      if (hasChanges) {
        dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });
      }
    }

    if (!isActive && wasActive) {
      const restorePaths = previousExpandedPathsRef.current;
      previousExpandedPathsRef.current = null;
      const currentState = stateRef.current;

      if (restorePaths && restorePaths.size > 0) {
        const newMap: Record<string, TreeNode> = { ...currentState.nodesMap };
        let hasChanges = false;

        restorePaths.forEach((path) => {
          const node = newMap[path];
          if (node && node.is_dir && !node.expanded) {
            newMap[path] = { ...node, expanded: true };
            hasChanges = true;
          }
        });

        if (hasChanges) {
          dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });
        }
      }
    }

    previousSearchActiveRef.current = isActive;
  }, [dispatch, searchQuery, stateRef]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      searchResultRootsRef.current = [];
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    const run = async () => {
      try {
        const results = await searchIndexedPaths(trimmed);
        if (searchRequestIdRef.current !== requestId) return;

        const currentState = stateRef.current;
        const newMap: Record<string, TreeNode> = { ...currentState.nodesMap };
        const searchRoots: string[] = [];

        for (const entry of results) {
          const normalizedPath = normalizePath(entry.path);
          const normalizedParent = entry.parent_path ? normalizePath(entry.parent_path) : null;
          const existingNode = newMap[normalizedPath];

          newMap[normalizedPath] = {
            ...entry,
            raw_path: entry.path,
            raw_parent_path: entry.parent_path,
            path: normalizedPath,
            parent_path: normalizedParent,
            expanded: existingNode?.expanded ?? false,
            checked: existingNode?.checked ?? false,
            indeterminate: existingNode?.indeterminate ?? false,
            hasChildren:
              entry.is_dir ||
              (entry.child_count != null && entry.child_count > 0) ||
              existingNode?.hasChildren ||
              false,
            childPaths: existingNode?.childPaths ?? [],
          };

          searchRoots.push(normalizedPath);
        }

        if (searchRequestIdRef.current !== requestId) return;

        searchResultRootsRef.current = searchRoots;
        dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });
      } catch (error) {
        console.error("Failed to search indexed paths:", error);
      }
    };

    void run();
  }, [dispatch, normalizePath, searchQuery, stateRef]);

  return {
    isSearchMode,
    searchResultRootsRef,
  };
}
