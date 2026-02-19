import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type { TreeNode } from "../../types";
import { matchesExtensionFilter, SRC_EXTENSIONS, DOCS_EXTENSIONS } from "./fileTreeFilterUtils";
import { getNameFromPath, getParentDirectoryPath, normalizePath } from "./fileTreePathUtils";
import { fileTreeReducer, initialFileTreeState } from "./fileTreeReducer";
import { getChildrenEntries, getSensitiveMarkedPaths, getSensitivePreventionSettings } from "./fileTreeServices";
import {
  buildFlatTree,
  clearSelectionMap,
  collectDescendantFilePaths,
  collectSelectedPaths,
  updateChildrenSelection,
  updateParentSelection,
} from "./fileTreeTreeUtils";
import type {
  FileTreeAction,
  FileTreeActionsContextValue,
  FileTreeState,
  FileTreeStateContextValue,
  FilterType,
} from "./fileTreeTypes";
import { useFileTreeSearch } from "./useFileTreeSearch";
import { useFileTreeIndexing } from "./useFileTreeIndexing";

const FileTreeStateContext = createContext<FileTreeStateContextValue | null>(null);
const FileTreeActionsContext = createContext<FileTreeActionsContextValue | null>(null);
const FilterTypeContext = createContext<FilterType>("ALL");

interface FileTreeProviderProps {
  children: ReactNode;
  searchQuery?: string;
  onSelectionChange?: (paths: string[]) => void;
}

export function FileTreeProvider({ children, searchQuery = "", onSelectionChange }: FileTreeProviderProps) {
  const [state, dispatch] = useReducer(fileTreeReducer, initialFileTreeState);
  const stateRef = useRef<FileTreeState>(state);
  stateRef.current = state;

  const { isSearchMode, searchResultRootsRef } = useFileTreeSearch({
    searchQuery,
    stateRef,
    dispatch,
    normalizePath,
  });

  const { loadRootEntries, loadChildren } = useFileTreeIndexing({
    stateRef,
    dispatch,
    normalizePath,
    getParentDirectoryPath,
    getNameFromPath,
  });

  const includeNode = useCallback(
    (node: TreeNode): boolean => matchesExtensionFilter(node, state.filterType),
    [state.filterType]
  );

  const flatTree = useMemo(() => {
    const roots = isSearchMode ? searchResultRootsRef.current : state.rootPaths;
    return buildFlatTree(roots, state.nodesMap, includeNode);
  }, [includeNode, isSearchMode, state.nodesMap, state.rootPaths]);

  const loadAllChildrenRecursively = useCallback(
    async (nodePath: string, currentMap: Record<string, TreeNode>): Promise<string[]> => {
      const invokePath = currentMap[nodePath]?.raw_path ?? nodePath;
      const entries = await getChildrenEntries(invokePath);
      const childPaths: string[] = [];

      for (const entry of entries) {
        const normalizedPath = normalizePath(entry.path);
        const normalizedParent = entry.parent_path ? normalizePath(entry.parent_path) : null;
        childPaths.push(normalizedPath);

        let entryChildPaths: string[] = [];
        if (entry.is_dir) {
          entryChildPaths = await loadAllChildrenRecursively(normalizedPath, currentMap);
        }

        currentMap[normalizedPath] = {
          ...entry,
          raw_path: entry.path,
          raw_parent_path: entry.parent_path,
          path: normalizedPath,
          parent_path: normalizedParent,
          expanded: false,
          checked: true,
          indeterminate: false,
          hasChildren: entry.is_dir,
          childPaths: entryChildPaths,
        };
      }

      return childPaths;
    },
    []
  );

  const isSensitivePreventionEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const { sensitiveEnabled, preventSelectionEnabled } = await getSensitivePreventionSettings();
      return sensitiveEnabled && preventSelectionEnabled;
    } catch (error) {
      console.warn("Failed to resolve sensitive prevention settings:", error);
      return false;
    }
  }, []);

  const getSensitivePathSet = useCallback(async (paths: string[]): Promise<Set<string>> => {
    if (paths.length === 0) return new Set<string>();

    try {
      const markedPaths = await getSensitiveMarkedPaths(paths);
      return new Set((markedPaths || []).map((markedPath) => normalizePath(markedPath)));
    } catch (error) {
      console.warn("Failed to load sensitive path marks:", error);
      return new Set<string>();
    }
  }, []);

  const toggleExpand = useCallback(
    async (nodePath: string) => {
      const currentState = stateRef.current;
      const normalizedNodePath = normalizePath(nodePath);
      const node = currentState.nodesMap[normalizedNodePath];
      if (!node || !node.is_dir) return;

      if (!node.expanded && (!node.childPaths || node.childPaths.length === 0)) {
        const children = await loadChildren(node.raw_path ?? normalizedNodePath);
        const normalizedChildren = children.map((child) => ({
          ...child,
          path: normalizePath(child.path),
          parent_path: child.parent_path ? normalizePath(child.parent_path) : null,
        }));

        const newNodesMap: Record<string, TreeNode> = { ...currentState.nodesMap };
        const childPaths = normalizedChildren.map((child) => child.path);
        newNodesMap[normalizedNodePath] = { ...node, expanded: true, childPaths };

        normalizedChildren.forEach((child) => {
          if (!newNodesMap[child.path]) {
            newNodesMap[child.path] = child;
          }
        });

        dispatch({ type: "UPDATE_NODES_MAP", payload: newNodesMap });
      } else {
        dispatch({ type: "UPDATE_NODE", payload: { ...node, expanded: !node.expanded } });
      }
    },
    [loadChildren]
  );

  const toggleCheck = useCallback(
    async (nodePath: string, checked: boolean) => {
      const currentState = stateRef.current;
      const newMap = { ...currentState.nodesMap };
      const node = newMap[nodePath];
      if (!node) return;

      const shouldPreventSensitive = checked && (await isSensitivePreventionEnabled());

      if (node.is_dir && checked && (!node.childPaths || node.childPaths.length === 0)) {
        const childPaths = await loadAllChildrenRecursively(nodePath, newMap);
        const expanded = isSearchMode ? node.expanded : true;
        newMap[nodePath] = { ...node, checked, indeterminate: false, childPaths, expanded };
      } else {
        updateChildrenSelection(newMap, nodePath, checked);
      }

      if (shouldPreventSensitive) {
        const targetFilePaths = node.is_dir
          ? collectDescendantFilePaths(newMap, nodePath)
          : [nodePath];

        const sensitivePaths = await getSensitivePathSet(targetFilePaths);
        if (sensitivePaths.size > 0) {
          for (const path of targetFilePaths) {
            if (!sensitivePaths.has(path)) continue;

            const sensitiveNode = newMap[path];
            if (!sensitiveNode || sensitiveNode.is_dir || !sensitiveNode.checked) continue;

            newMap[path] = {
              ...sensitiveNode,
              checked: false,
              indeterminate: false,
            };

            updateParentSelection(newMap, sensitiveNode.parent_path);
          }
        }
      }

      updateParentSelection(newMap, node.parent_path);
      dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });

      if (onSelectionChange) {
        onSelectionChange(collectSelectedPaths(newMap));
      }
    },
    [
      getSensitivePathSet,
      isSearchMode,
      isSensitivePreventionEnabled,
      loadAllChildrenRecursively,
      onSelectionChange,
    ]
  );

  const clearSelection = useCallback(() => {
    const currentState = stateRef.current;
    const { map, hasChanges } = clearSelectionMap(currentState.nodesMap);

    if (hasChanges) {
      dispatch({ type: "UPDATE_NODES_MAP", payload: map });
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    }
  }, [onSelectionChange]);

  const getSelectedPaths = useCallback(() => {
    const currentState = stateRef.current;
    return collectSelectedPaths(currentState.nodesMap);
  }, []);

  const setFilter = useCallback((filter: FilterType) => {
    dispatch({ type: "SET_FILTER", payload: filter });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" });
  }, []);

  const applyInitialSelection = useCallback(
    (paths: string[]) => {
      const currentState = stateRef.current;
      if (paths.length === 0 || currentState.rootPaths.length === 0) return;

      const normalizedPaths = new Set(paths.map(normalizePath));
      const newMap = { ...currentState.nodesMap };
      let hasChanges = false;

      normalizedPaths.forEach((path) => {
        const node = newMap[path];
        if (node && !node.is_dir && !node.checked) {
          newMap[path] = { ...node, checked: true, indeterminate: false };
          updateParentSelection(newMap, node.parent_path);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });
        if (onSelectionChange) {
          onSelectionChange(collectSelectedPaths(newMap));
        }
      }
    },
    [onSelectionChange]
  );

  const stateValue = useMemo(
    () => ({
      state,
      flatTree,
    }),
    [state, flatTree]
  );

  const actionsValue = useMemo(
    () => ({
      dispatch,
      loadRootEntries,
      loadChildren,
      toggleExpand,
      toggleCheck,
      clearSelection,
      setFilter,
      clearAll,
      getSelectedPaths,
      applyInitialSelection,
    }),
    [
      applyInitialSelection,
      clearAll,
      clearSelection,
      dispatch,
      getSelectedPaths,
      loadChildren,
      loadRootEntries,
      setFilter,
      toggleCheck,
      toggleExpand,
    ]
  );

  return (
    <FilterTypeContext.Provider value={state.filterType}>
      <FileTreeStateContext.Provider value={stateValue}>
        <FileTreeActionsContext.Provider value={actionsValue}>{children}</FileTreeActionsContext.Provider>
      </FileTreeStateContext.Provider>
    </FilterTypeContext.Provider>
  );
}

export function useFileTreeState() {
  const context = useContext(FileTreeStateContext);
  if (!context) {
    throw new Error("useFileTreeState must be used within a FileTreeProvider");
  }
  return context;
}

export function useFileTreeActions() {
  const context = useContext(FileTreeActionsContext);
  if (!context) {
    throw new Error("useFileTreeActions must be used within a FileTreeProvider");
  }
  return context;
}

export function useFilterType(): FilterType {
  return useContext(FilterTypeContext);
}

export function useFileTree() {
  const stateContext = useFileTreeState();
  const actionsContext = useFileTreeActions();
  return { ...stateContext, ...actionsContext };
}

export { SRC_EXTENSIONS, DOCS_EXTENSIONS };
export type { FilterType, FileTreeAction, FileTreeState, FileTreeActionsContextValue, FileTreeStateContextValue };
