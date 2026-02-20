import { useCallback } from "react";
import type React from "react";
import type { TreeNode } from "../../types";
import { getChildrenEntries } from "./fileTreeServices";
import {
  buildRootTreeState,
  computePathsToExpand,
  updateParentSelection,
} from "./fileTreeTreeUtils";
import type { FileTreeAction, FileTreeState } from "./fileTreeTypes";

interface UseFileTreeIndexingParams {
  stateRef: React.MutableRefObject<FileTreeState>;
  dispatch: React.Dispatch<FileTreeAction>;
  normalizePath: (filePath: string) => string;
  getParentDirectoryPath: (filePath: string) => string | null;
  getNameFromPath: (filePath: string) => string;
}

interface UseFileTreeIndexingResult {
  loadRootEntries: () => Promise<void>;
  loadChildren: (nodePath: string) => Promise<TreeNode[]>;
}

export function useFileTreeIndexing({
  stateRef,
  dispatch,
  normalizePath,
  getParentDirectoryPath,
  getNameFromPath,
}: UseFileTreeIndexingParams): UseFileTreeIndexingResult {
  const loadChildren = useCallback(
    async (nodePath: string): Promise<TreeNode[]> => {
      try {
        const entries = await getChildrenEntries(nodePath);
        return entries.map((entry) => ({
          ...entry,
          raw_path: entry.path,
          raw_parent_path: entry.parent_path,
          path: normalizePath(entry.path),
          parent_path: entry.parent_path ? normalizePath(entry.parent_path) : null,
          expanded: false,
          checked: false,
          indeterminate: false,
          hasChildren: entry.is_dir,
          childPaths: [],
        }));
      } catch (error) {
        console.error("Failed to load children:", error);
        return [];
      }
    },
    [normalizePath]
  );

  const loadRootEntries = useCallback(async () => {
    const prevNodesMap = stateRef.current.nodesMap;
    const prevExpandedPaths = new Set<string>();
    const prevCheckedFilePaths = new Set<string>();

    Object.values(prevNodesMap).forEach((node) => {
      if (node.expanded) prevExpandedPaths.add(node.path);
      if (node.checked && !node.is_dir) prevCheckedFilePaths.add(node.path);
    });

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const entries = await getChildrenEntries(null);
      const normalizedEntries = entries.map((entry) => ({
        ...entry,
        raw_path: entry.path,
        raw_parent_path: entry.parent_path,
        path: normalizePath(entry.path),
        parent_path: entry.parent_path ? normalizePath(entry.parent_path) : null,
      }));

      const { nodesMap: newNodesMap, rootPaths: newRootPaths, rootEntries } = buildRootTreeState({
        entries: normalizedEntries,
        getParentDirectoryPath,
        getNameFromPath,
      });

      const isReIndex = Object.keys(prevNodesMap).length > 0;
      const pathsToExpand = computePathsToExpand({
        prevExpandedPaths,
        prevCheckedFilePaths,
        isReIndex,
        rootEntries,
        newNodesMap,
        prevNodesMap,
        getParentDirectoryPath,
      });

      const initialRootPaths = new Set(newRootPaths);
      const loadedPaths = new Set<string>();

      const loadAndExpandChildren = async (rawParentPath: string): Promise<string[]> => {
        const normalizedParent = normalizePath(rawParentPath);
        if (loadedPaths.has(normalizedParent)) return [];
        loadedPaths.add(normalizedParent);

        const childEntries = await getChildrenEntries(rawParentPath);
        const childPaths: string[] = [];

        for (const child of childEntries) {
          const normalizedChildPath = normalizePath(child.path);
          if (normalizedChildPath === normalizedParent) continue;
          if (initialRootPaths.has(normalizedChildPath)) continue;

          const normalizedChildParent = child.parent_path ? normalizePath(child.parent_path) : null;
          childPaths.push(normalizedChildPath);

          if (!newNodesMap[normalizedChildPath]) {
            const shouldExpand = pathsToExpand.has(normalizedChildPath) && child.is_dir;
            newNodesMap[normalizedChildPath] = {
              ...child,
              raw_path: child.path,
              raw_parent_path: child.parent_path,
              path: normalizedChildPath,
              parent_path: normalizedChildParent,
              expanded: shouldExpand,
              checked: false,
              indeterminate: false,
              hasChildren: child.is_dir,
              childPaths: [],
            };

            if (shouldExpand) {
              newNodesMap[normalizedChildPath].childPaths = await loadAndExpandChildren(child.path);
            }
          } else if (pathsToExpand.has(normalizedChildPath)) {
            const existingNode = newNodesMap[normalizedChildPath];
            if (existingNode && existingNode.is_dir) {
              newNodesMap[normalizedChildPath] = { ...existingNode, expanded: true };
              if (!existingNode.childPaths || existingNode.childPaths.length === 0) {
                newNodesMap[normalizedChildPath].childPaths = await loadAndExpandChildren(child.path);
              }
            }
          }
        }

        return childPaths;
      };

      for (const rootPath of newRootPaths) {
        const rootNode = newNodesMap[rootPath];
        if (rootNode && rootNode.is_dir && pathsToExpand.has(rootPath) && !rootNode.expanded) {
          rootNode.expanded = true;
          const rootChildPaths = rootNode.childPaths ?? [];

          if (rootChildPaths.length === 0) {
            const rawPath = rootNode.raw_path ?? rootPath;
            rootNode.childPaths = await loadAndExpandChildren(rawPath);
          } else {
            const restoreExpansion = async (parentChildPaths: string[]): Promise<void> => {
              for (const childPath of parentChildPaths) {
                const childNode = newNodesMap[childPath];
                if (childNode && childNode.is_dir && pathsToExpand.has(childPath) && !childNode.expanded) {
                  childNode.expanded = true;
                  const grandchildPaths = childNode.childPaths ?? [];

                  if (grandchildPaths.length === 0) {
                    childNode.childPaths = await loadAndExpandChildren(childNode.raw_path ?? childPath);
                  } else {
                    await restoreExpansion(grandchildPaths);
                  }
                }
              }
            };

            await restoreExpansion(rootChildPaths);
          }
        }
      }

      if (isReIndex) {
        prevCheckedFilePaths.forEach((filePath) => {
          if (newNodesMap[filePath] && !newNodesMap[filePath].is_dir) {
            newNodesMap[filePath] = { ...newNodesMap[filePath], checked: true };
          }
        });

        prevCheckedFilePaths.forEach((filePath) => {
          const node = newNodesMap[filePath];
          if (node) {
            updateParentSelection(newNodesMap, node.parent_path);
          }
        });
      }

      dispatch({ type: "SET_NODES", payload: { map: newNodesMap, rootPaths: newRootPaths } });
    } catch (error) {
      console.error("Failed to load root entries:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [dispatch, getNameFromPath, getParentDirectoryPath, normalizePath, stateRef]);

  return {
    loadRootEntries,
    loadChildren,
  };
}
