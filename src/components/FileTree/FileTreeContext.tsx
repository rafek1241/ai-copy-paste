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

// State types - using path as key instead of numeric ID
interface FileTreeState {
  nodesMap: Record<string, TreeNode>;  // Keyed by path
  rootPaths: string[];
  flatTree: (TreeNode & { level: number })[];
  filterType: FilterType;
  isLoading: boolean;
}

type FileTreeAction =
  | { type: "SET_NODES"; payload: { map: Record<string, TreeNode>; rootPaths: string[] } }
  | { type: "UPDATE_NODE"; payload: TreeNode }
  | { type: "UPDATE_NODES_MAP"; payload: Record<string, TreeNode> }
  | { type: "SET_FLAT_TREE"; payload: (TreeNode & { level: number })[] }
  | { type: "SET_FILTER"; payload: FilterType }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_ALL" };

const initialState: FileTreeState = {
  nodesMap: {},
  rootPaths: [],
  flatTree: [],
  filterType: "ALL",
  isLoading: false,
};

function fileTreeReducer(state: FileTreeState, action: FileTreeAction): FileTreeState {
  switch (action.type) {
    case "SET_NODES":
      return { ...state, nodesMap: action.payload.map, rootPaths: action.payload.rootPaths };
    case "UPDATE_NODE":
      return {
        ...state,
        nodesMap: { ...state.nodesMap, [action.payload.path]: action.payload },
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
  loadChildren: (nodePath: string) => Promise<TreeNode[]>;
  toggleExpand: (nodePath: string) => Promise<void>;
  toggleCheck: (nodePath: string, checked: boolean) => Promise<void>;
  clearSelection: () => void;
  setFilter: (filter: FilterType) => void;
  clearAll: () => void;
  // Selection helpers
  getSelectedPaths: () => string[];
}

const FileTreeContext = createContext<FileTreeContextValue | null>(null);

interface FileTreeProviderProps {
  children: ReactNode;
  searchQuery?: string;
  onSelectionChange?: (paths: string[]) => void;
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
    (paths: string[], map: Record<string, TreeNode>, level = 0): (TreeNode & { level: number })[] => {
      const result: (TreeNode & { level: number })[] = [];
      for (const path of paths) {
        const node = map[path];
        if (!node) continue;

        const isMatch = matchesFilter(node);
        if (!node.is_dir && !isMatch) continue;

        result.push({ ...node, level });

        if (node.expanded && node.childPaths) {
          result.push(...buildFlatTree(node.childPaths, map, level + 1));
        }
      }
      return result;
    },
    [matchesFilter]
  );

  // Update flat tree when state changes
  React.useEffect(() => {
    const flatTree = buildFlatTree(state.rootPaths, state.nodesMap);
    dispatch({ type: "SET_FLAT_TREE", payload: flatTree });
  }, [state.nodesMap, state.rootPaths, buildFlatTree]);

  // Normalize path separators for cross-platform consistency
  const normalizePath = useCallback((filePath: string): string => {
    return filePath.replace(/\\/g, '/');
  }, []);

  // Helper function to get parent directory path
  const getParentDirectoryPath = useCallback((filePath: string): string | null => {
    const normalized = normalizePath(filePath);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) return null;
    return normalized.substring(0, lastSlash);
  }, [normalizePath]);

  // Helper function to get name from path
  const getNameFromPath = useCallback((filePath: string): string => {
    const normalized = normalizePath(filePath);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
  }, [normalizePath]);

  // Load root entries
  const loadRootEntries = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const entries = await invoke<FileEntry[]>("get_children", { parentPath: null });

      // Normalize all entry paths for consistent processing
      const normalizedEntries = entries.map((entry) => ({
        ...entry,
        raw_path: entry.path,
        raw_parent_path: entry.parent_path,
        path: normalizePath(entry.path),
        parent_path: entry.parent_path ? normalizePath(entry.parent_path) : null,
      }));

      // Group orphaned files by their parent directory
      // An orphaned file is one whose parent directory is not in the entries list
      const orphanedFilesByParent = new Map<string, FileEntry[]>();
      const directoryPaths = new Set(normalizedEntries.filter(e => e.is_dir).map(e => e.path));

      normalizedEntries.forEach((entry) => {
        if (!entry.is_dir && entry.parent_path) {
          // Check if the parent directory is in our entries
          if (!directoryPaths.has(entry.parent_path)) {
            // This is an orphaned file - group it by its parent directory
            if (!orphanedFilesByParent.has(entry.parent_path)) {
              orphanedFilesByParent.set(entry.parent_path, []);
            }
            orphanedFilesByParent.get(entry.parent_path)!.push(entry);
          }
        }
      });

      // Start with fresh maps - don't preserve old state to avoid stale data
      const newNodesMap: Record<string, TreeNode> = {};
      const newRootPaths: string[] = [];
      const processedPaths = new Set<string>();

      // Helper to add a path as root (and avoid duplicates)
      const addRootPath = (path: string) => {
        if (!processedPaths.has(path)) {
          processedPaths.add(path);
          newRootPaths.push(path);
        }
      };

      // First, add all directory entries
      normalizedEntries.forEach((entry) => {
        if (entry.is_dir) {
          newNodesMap[entry.path] = {
            ...entry,
            expanded: false,
            checked: false,
            indeterminate: false,
            hasChildren: true,
            childPaths: [],
          };
          if (!entry.parent_path || !directoryPaths.has(entry.parent_path)) {
            addRootPath(entry.path);
          }
        }
      });

      // Create synthetic folder nodes for directories containing orphaned files
      // Auto-expand these folders so individually selected files are immediately visible
      orphanedFilesByParent.forEach((files, parentPath) => {
        if (!newNodesMap[parentPath]) {
          const folderName = getNameFromPath(parentPath);
          newNodesMap[parentPath] = {
            path: parentPath,
            parent_path: getParentDirectoryPath(parentPath),
            raw_path: parentPath,
            raw_parent_path: getParentDirectoryPath(parentPath),
            name: folderName,
            size: null,
            mtime: null,
            is_dir: true,
            token_count: null,
            fingerprint: null,
            child_count: files.length,
            expanded: true, // Auto-expand so files are visible
            checked: false,
            indeterminate: false,
            hasChildren: true,
            childPaths: files.map(f => f.path),
          };
          addRootPath(parentPath);
        }
      });

      // Now add all file entries, updating parent_path for orphaned files
      normalizedEntries.forEach((entry) => {
        if (!entry.is_dir) {
          // If this file's parent is not a directory in our index, it's under a synthetic folder
          const parentPath = entry.parent_path;
          const isOrphaned = parentPath && !directoryPaths.has(parentPath);

          newNodesMap[entry.path] = {
            ...entry,
            parent_path: isOrphaned && parentPath ? parentPath : entry.parent_path,
            expanded: false,
            checked: false,
            indeterminate: false,
            hasChildren: false,
            childPaths: [],
          };

          // Add files at the root level to rootPaths
          if (!entry.parent_path) {
            addRootPath(entry.path);
          }
        }
      });

      // Update childPaths for all directories (real and synthetic)
      Object.values(newNodesMap).forEach((node) => {
        if (node.is_dir) {
          // Collect all files that have this node as parent
          const childPaths: string[] = node.childPaths || [];
          normalizedEntries.forEach((entry) => {
            if (!entry.is_dir && entry.parent_path === node.path) {
              if (!childPaths.includes(entry.path)) {
                childPaths.push(entry.path);
              }
            }
          });
          node.childPaths = childPaths;
          // node.child_count = childPaths.length; // Don't overwrite child_count from backend
        }
      });

      dispatch({ type: "SET_NODES", payload: { map: newNodesMap, rootPaths: newRootPaths } });
    } catch (error) {
      console.error("Failed to load root entries:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [getParentDirectoryPath, getNameFromPath, normalizePath]);

  // Load children for a node
  const loadChildren = useCallback(async (nodePath: string): Promise<TreeNode[]> => {
    try {
      const entries = await invoke<FileEntry[]>("get_children", { parentPath: nodePath });
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
  }, [normalizePath]);

  // Toggle node expansion
  const toggleExpand = useCallback(
    async (nodePath: string) => {
      const normalizedNodePath = normalizePath(nodePath);
      const node = state.nodesMap[normalizedNodePath];
      if (!node || !node.is_dir) return;

      if (!node.expanded && (!node.childPaths || node.childPaths.length === 0)) {
        const children = await loadChildren(node.raw_path ?? normalizedNodePath);
        // Normalize child paths
        const normalizedChildren = children.map(child => ({
          ...child,
          path: normalizePath(child.path),
          parent_path: child.parent_path ? normalizePath(child.parent_path) : null,
        }));

        const newNodesMap: Record<string, TreeNode> = {};
        // Copy existing nodes with normalized paths
        Object.entries(state.nodesMap).forEach(([path, n]) => {
          newNodesMap[normalizePath(path)] = n;
        });

        const childPaths = normalizedChildren.map((c) => c.path);

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
    [state.nodesMap, loadChildren, normalizePath]
  );

  // Helper: Update children selection recursively
  const updateChildrenSelection = useCallback(
    (map: Record<string, TreeNode>, nodePath: string, checked: boolean) => {
      const node = map[nodePath];
      if (!node) return;

      map[nodePath] = { ...node, checked, indeterminate: false };

      if (node.childPaths) {
        node.childPaths.forEach((childPath) => {
          updateChildrenSelection(map, childPath, checked);
        });
      }
    },
    []
  );

  // Helper: Update parent selection states
  const updateParentSelection = useCallback(
    (map: Record<string, TreeNode>, parentPath: string | null) => {
      if (parentPath === null) return;

      const parent = map[parentPath];
      if (!parent || !parent.childPaths) return;

      const children = parent.childPaths.map((path) => map[path]).filter(Boolean);
      const checkedCount = children.filter((c) => c.checked).length;
      const indeterminateCount = children.filter((c) => c.indeterminate).length;

      const isAllChecked = checkedCount === children.length && children.length > 0;
      const isIndeterminate = (checkedCount > 0 && !isAllChecked) || indeterminateCount > 0;

      if (parent.checked !== isAllChecked || parent.indeterminate !== isIndeterminate) {
        map[parentPath] = { ...parent, checked: isAllChecked, indeterminate: isIndeterminate };
        updateParentSelection(map, parent.parent_path);
      }
    },
    []
  );

  // Helper: Load all children recursively
  const loadAllChildrenRecursively = useCallback(
    async (nodePath: string, currentMap: Record<string, TreeNode>): Promise<string[]> => {
      const invokePath = currentMap[nodePath]?.raw_path ?? nodePath;
      const entries = await invoke<FileEntry[]>("get_children", { parentPath: invokePath });
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
    [normalizePath]
  );

  // Toggle checkbox
  const toggleCheck = useCallback(
    async (nodePath: string, checked: boolean) => {
      const newMap = { ...state.nodesMap };
      const node = newMap[nodePath];
      if (!node) return;

      if (node.is_dir && checked && (!node.childPaths || node.childPaths.length === 0)) {
        const childPaths = await loadAllChildrenRecursively(nodePath, newMap);
        newMap[nodePath] = { ...node, checked, indeterminate: false, childPaths, expanded: true };
      } else {
        updateChildrenSelection(newMap, nodePath, checked);
      }

      updateParentSelection(newMap, node.parent_path);
      dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });

      // Notify parent
      if (onSelectionChange) {
        const selected = collectSelected(newMap, state.rootPaths);
        onSelectionChange(selected);
      }
    },
    [state.nodesMap, state.rootPaths, onSelectionChange, loadAllChildrenRecursively, updateChildrenSelection, updateParentSelection]
  );

  const clearSelection = useCallback(() => {
    const newMap = { ...state.nodesMap };
    let hasChanges = false;

    Object.keys(newMap).forEach((path) => {
      const node = newMap[path];
      if (node && (node.checked || node.indeterminate)) {
        newMap[path] = { ...node, checked: false, indeterminate: false };
        hasChanges = true;
      }
    });

    if (hasChanges) {
      dispatch({ type: "UPDATE_NODES_MAP", payload: newMap });
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    }
  }, [state.nodesMap, onSelectionChange]);

  // Helper: Collect selected files
  const collectSelected = useCallback(
    (map: Record<string, TreeNode>, paths: string[]): string[] => {
      const selectedPaths: string[] = [];

      const traverse = (currentPaths: string[]) => {
        for (const path of currentPaths) {
          const node = map[path];
          if (!node) continue;
          if (node.checked && !node.is_dir) {
            selectedPaths.push(node.path);
          }
          if (node.childPaths) {
            traverse(node.childPaths);
          }
        }
      };

      traverse(paths);
      return selectedPaths;
    },
    []
  );

  const getSelectedPaths = useCallback(() => {
    return collectSelected(state.nodesMap, state.rootPaths);
  }, [state.nodesMap, state.rootPaths, collectSelected]);

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
      clearSelection,
      setFilter,
      clearAll,
      getSelectedPaths,
    }),
    [state, loadRootEntries, loadChildren, toggleExpand, toggleCheck, clearSelection, setFilter, clearAll, getSelectedPaths]
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
