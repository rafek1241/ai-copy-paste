import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TreeNode, FileEntry } from "../../types";

// Filter types
export type FilterType = "ALL" | "SRC" | "DOCS";

// Extension lists for filtering
export const SRC_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".c", ".cpp", ".h",
  ".java", ".rb", ".php", ".css", ".html", ".sh", ".yaml", ".json"
];

export const DOCS_EXTENSIONS = [
  ".md", ".txt", ".pdf", ".docx", ".doc", ".odt", ".rtf"
];

// State types
interface FileTreeState {
  nodesMap: Record<number, TreeNode>;
  rootIds: number[];
  flatTree: (TreeNode & { level: number })[];
  filterType: FilterType;
  isLoading: boolean;
}

type FileTreeAction =
  | { type: "SET_NODES"; payload: { map: Record<number, TreeNode>; rootIds: number[] } }
  | { type: "UPDATE_NODE"; payload: TreeNode }
  | { type: "UPDATE_NODES_MAP"; payload: Record<number, TreeNode> }
  | { type: "SET_FLAT_TREE"; payload: (TreeNode & { level: number })[] }
  | { type: "SET_FILTER"; payload: FilterType }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_ALL" };

const initialState: FileTreeState = {
  nodesMap: {},
  rootIds: [],
  flatTree: [],
  filterType: "ALL",
  isLoading: false,
};

function fileTreeReducer(state: FileTreeState, action: FileTreeAction): FileTreeState {
  switch (action.type) {
    case "SET_NODES":
      return { ...state, nodesMap: action.payload.map, rootIds: action.payload.rootIds };
    case "UPDATE_NODE":
      return {
        ...state,
        nodesMap: { ...state.nodesMap, [action.payload.id]: action.payload },
      };
    case "UPDATE_NODES_MAP":
      return { ...state, nodesMap: action.payload };
    case "SET_FLAT_TREE":
      return { ...state, flatTree: action.payload };
    case "SET_FILTER":
      return { ...state, filterType: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "CLEAR_ALL":
      return initialState;
    default:
      return state;
  }
}

// Context value type
interface FileTreeContextValue {
  state: FileTreeState;
  dispatch: React.Dispatch<FileTreeAction>;
  // Actions
  loadRootEntries: () => Promise<void>;
  loadChildren: (nodeId: number) => Promise<TreeNode[]>;
  toggleExpand: (nodeId: number) => Promise<void>;
  toggleCheck: (nodeId: number, checked: boolean) => Promise<void>;
  setFilter: (filter: FilterType) => void;
  clearAll: () => void;
  // Selection helpers
  getSelectedPaths: () => { paths: string[]; ids: number[] };
}

const FileTreeContext = createContext<FileTreeContextValue | null>(null);

interface FileTreeProviderProps {
  children: ReactNode;
  searchQuery?: string;
  onSelectionChange?: (paths: string[], ids: number[]) => void;
}

export function FileTreeProvider({ children, searchQuery = "", onSelectionChange }: FileTreeProviderProps) {
  const [state, dispatch] = useReducer(fileTreeReducer, initialState);

  // Helper: Check if node matches filter
  const matchesFilter = useCallback(
    (node: TreeNode): boolean => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          node.name.toLowerCase().includes(query) ||
          (node.path && node.path.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      if (state.filterType === "ALL") return true;
      if (node.is_dir) return true;

      const ext = node.path.substring(node.path.lastIndexOf(".")).toLowerCase();
      if (state.filterType === "SRC") return SRC_EXTENSIONS.includes(ext);
      if (state.filterType === "DOCS") return DOCS_EXTENSIONS.includes(ext);
      return true;
    },
    [state.filterType, searchQuery]
  );

  // Build flat tree for virtual scrolling
  const buildFlatTree = useCallback(
    (ids: number[], map: Record<number, TreeNode>, level = 0): (TreeNode & { level: number })[] => {
      const result: (TreeNode & { level: number })[] = [];
      for (const id of ids) {
        const node = map[id];
        if (!node) continue;

        const isMatch = matchesFilter(node);
        if (!node.is_dir && !isMatch) continue;

        result.push({ ...node, level });

        if (node.expanded && node.childIds) {
          result.push(...buildFlatTree(node.childIds, map, level + 1));
        }
      }
      return result;
    },
    [matchesFilter]
  );

  // Update flat tree when state changes
  React.useEffect(() => {
    const flatTree = buildFlatTree(state.rootIds, state.nodesMap);
    dispatch({ type: "SET_FLAT_TREE", payload: flatTree });
  }, [state.nodesMap, state.rootIds, buildFlatTree]);

  // Load root entries
  const loadRootEntries = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const entries = await invoke<FileEntry[]>("get_children", { parentId: null });
      const newNodesMap: Record<number, TreeNode> = {};
      const newRootIds: number[] = [];

      entries.forEach((entry) => {
        newNodesMap[entry.id] = {
          ...entry,
          expanded: false,
          checked: false,
          indeterminate: false,
          hasChildren: entry.is_dir,
          childIds: [],
        };
        newRootIds.push(entry.id);
      });

      dispatch({ type: "SET_NODES", payload: { map: newNodesMap, rootIds: newRootIds } });
    } catch (error) {
      console.error("Failed to load root entries:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // Load children for a node
  const loadChildren = useCallback(async (nodeId: number): Promise<TreeNode[]> => {
    try {
      const entries = await invoke<FileEntry[]>("get_children", { parentId: nodeId });
      return entries.map((entry) => ({
        ...entry,
        expanded: false,
        checked: false,
        indeterminate: false,
        hasChildren: entry.is_dir,
        childIds: [],
      }));
    } catch (error) {
      console.error("Failed to load children:", error);
      return [];
    }
  }, []);

  // Toggle node expansion
  const toggleExpand = useCallback(
    async (nodeId: number) => {
      const node = state.nodesMap[nodeId];
      if (!node || !node.is_dir) return;

      if (!node.expanded && (!node.childIds || node.childIds.length === 0)) {
        const children = await loadChildren(nodeId);
        const newNodesMap = { ...state.nodesMap };
        const childIds = children.map((c) => c.id);

        newNodesMap[nodeId] = { ...node, expanded: true, childIds };

        children.forEach((child) => {
          if (!newNodesMap[child.id]) {
            newNodesMap[child.id] = child;
          }
        });

        dispatch({ type: "UPDATE_NODES_MAP", payload: newNodesMap });
      } else {
        dispatch({ type: "UPDATE_NODE", payload: { ...node, expanded: !node.expanded } });
      }
    },
    [state.nodesMap, loadChildren]
  );

  // Helper: Update children selection recursively
  const updateChildrenSelection = useCallback(
    (map: Record<number, TreeNode>, nodeId: number, checked: boolean) => {
      const node = map[nodeId];
      if (!node) return;

      map[nodeId] = { ...node, checked, indeterminate: false };

      if (node.childIds) {
        node.childIds.forEach((childId) => {
          updateChildrenSelection(map, childId, checked);
        });
      }
    },
    []
  );

  // Helper: Update parent selection states
  const updateParentSelection = useCallback(
    (map: Record<number, TreeNode>, parentId: number | null) => {
      if (parentId === null) return;

      const parent = map[parentId];
      if (!parent || !parent.childIds) return;

      const children = parent.childIds.map((id) => map[id]).filter(Boolean);
      const checkedCount = children.filter((c) => c.checked).length;
      const indeterminateCount = children.filter((c) => c.indeterminate).length;

      const isAllChecked = checkedCount === children.length && children.length > 0;
      const isIndeterminate = (checkedCount > 0 && !isAllChecked) || indeterminateCount > 0;

      if (parent.checked !== isAllChecked || parent.indeterminate !== isIndeterminate) {
        map[parentId] = { ...parent, checked: isAllChecked, indeterminate: isIndeterminate };
        updateParentSelection(map, parent.parent_id);
      }
    },
    []
  );

  // Helper: Load all children recursively
  const loadAllChildrenRecursively = useCallback(
    async (nodeId: number, currentMap: Record<number, TreeNode>): Promise<number[]> => {
      const entries = await invoke<FileEntry[]>("get_children", { parentId: nodeId });
      const childIds: number[] = [];

      for (const entry of entries) {
        childIds.push(entry.id);
        let entryChildIds: number[] = [];
        if (entry.is_dir) {
          entryChildIds = await loadAllChildrenRecursively(entry.id, currentMap);
        }
        currentMap[entry.id] = {
          ...entry,
          expanded: false,
          checked: true,
          indeterminate: false,
          hasChildren: entry.is_dir,
          childIds: entryChildIds,
        };
      }
      return childIds;
    },
    []
  );

  // Toggle checkbox
  const toggleCheck = useCallback(
    async (nodeId: number, checked: boolean) => {
      const newMap = { ...state.nodesMap };
      const node = newMap[nodeId];
      if (!node) return;

      if (node.is_dir && checked && (!node.childIds || node.childIds.length === 0)) {
        const childIds = await loadAllChildrenRecursively(nodeId, newMap);
        newMap[nodeId] = { ...node, checked, indeterminate: false, childIds, expanded: true };
      } else {
        updateChildrenSelection(newMap, nodeId, checked);
      }

      updateParentSelection(newMap, node.parent_id);
      dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });

      // Notify parent
      if (onSelectionChange) {
        const selected = collectSelected(newMap, state.rootIds);
        onSelectionChange(selected.paths, selected.ids);
      }
    },
    [state.nodesMap, state.rootIds, onSelectionChange, loadAllChildrenRecursively, updateChildrenSelection, updateParentSelection]
  );

  // Helper: Collect selected files
  const collectSelected = useCallback(
    (map: Record<number, TreeNode>, ids: number[]): { paths: string[]; ids: number[] } => {
      const paths: string[] = [];
      const selectedIds: number[] = [];

      const traverse = (currentIds: number[]) => {
        for (const id of currentIds) {
          const node = map[id];
          if (!node) continue;
          if (node.checked && !node.is_dir) {
            paths.push(node.path);
            selectedIds.push(node.id);
          }
          if (node.childIds) {
            traverse(node.childIds);
          }
        }
      };

      traverse(ids);
      return { paths, ids: selectedIds };
    },
    []
  );

  const getSelectedPaths = useCallback(() => {
    return collectSelected(state.nodesMap, state.rootIds);
  }, [state.nodesMap, state.rootIds, collectSelected]);

  const setFilter = useCallback((filter: FilterType) => {
    dispatch({ type: "SET_FILTER", payload: filter });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" });
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      loadRootEntries,
      loadChildren,
      toggleExpand,
      toggleCheck,
      setFilter,
      clearAll,
      getSelectedPaths,
    }),
    [state, loadRootEntries, loadChildren, toggleExpand, toggleCheck, setFilter, clearAll, getSelectedPaths]
  );

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>;
}

export function useFileTree() {
  const context = useContext(FileTreeContext);
  if (!context) {
    throw new Error("useFileTree must be used within a FileTreeProvider");
  }
  return context;
}
