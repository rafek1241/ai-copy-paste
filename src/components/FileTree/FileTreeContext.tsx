import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef, ReactNode, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TreeNode, FileEntry, SearchResult } from "../../types";

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

const SRC_EXTENSION_SET = new Set(SRC_EXTENSIONS);
const DOCS_EXTENSION_SET = new Set(DOCS_EXTENSIONS);

// State types - using path as key instead of numeric ID
interface FileTreeState {
  nodesMap: Record<string, TreeNode>;  // Keyed by path
  rootPaths: string[];
  filterType: FilterType;
  isLoading: boolean;
}

interface FlatTreeItem {
  path: string;
  level: number;
}

interface SensitiveScanResult {
  path: string;
  has_sensitive_data: boolean;
  matched_patterns: string[];
  match_count: number;
}

type FileTreeAction =
  | { type: "SET_NODES"; payload: { map: Record<string, TreeNode>; rootPaths: string[] } }
  | { type: "UPDATE_NODE"; payload: TreeNode }
  | { type: "UPDATE_NODES_MAP"; payload: Record<string, TreeNode> }
  | { type: "SET_FILTER"; payload: FilterType }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_ALL" };

const initialState: FileTreeState = {
  nodesMap: {},
  rootPaths: [],
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
interface FileTreeStateContextValue {
  state: FileTreeState;
  flatTree: FlatTreeItem[];
}

interface FileTreeActionsContextValue {
  dispatch: React.Dispatch<FileTreeAction>;
  loadRootEntries: () => Promise<void>;
  loadChildren: (nodePath: string) => Promise<TreeNode[]>;
  toggleExpand: (nodePath: string) => Promise<void>;
  toggleCheck: (nodePath: string, checked: boolean) => Promise<void>;
  clearSelection: () => void;
  setFilter: (filter: FilterType) => void;
  clearAll: () => void;
  getSelectedPaths: () => string[];
  applyInitialSelection: (paths: string[]) => void;
}

const FileTreeStateContext = createContext<FileTreeStateContextValue | null>(null);
const FileTreeActionsContext = createContext<FileTreeActionsContextValue | null>(null);
// Dedicated context for filter type - prevents FileTreeFilters from re-rendering on tree changes
const FilterTypeContext = createContext<FilterType>("ALL");

interface FileTreeProviderProps {
  children: ReactNode;
  searchQuery?: string;
  onSelectionChange?: (paths: string[]) => void;
}

export function FileTreeProvider({ children, searchQuery = "", onSelectionChange }: FileTreeProviderProps) {
  const [state, dispatch] = useReducer(fileTreeReducer, initialState);

  // Check if we're in search mode
  const isSearchMode = !!searchQuery.trim();

  // Ref to access current state inside loadRootEntries without stale closure
  const stateRef = useRef(state);
  stateRef.current = state;

  const previousSearchActiveRef = useRef(false);
  const previousExpandedPathsRef = useRef<Set<string> | null>(null);
  const searchRequestIdRef = useRef(0);

  // Extension filter for SRC/DOCS tabs (not related to search)
  const matchesExtensionFilter = useCallback(
    (node: TreeNode): boolean => {
      if (state.filterType === "ALL") return true;
      if (node.is_dir) return true;

      const dotIndex = node.path.lastIndexOf(".");
      const ext = dotIndex >= 0 ? node.path.substring(dotIndex).toLowerCase() : "";
      if (state.filterType === "SRC") return SRC_EXTENSION_SET.has(ext);
      if (state.filterType === "DOCS") return DOCS_EXTENSION_SET.has(ext);
      return true;
    },
    [state.filterType]
  );

  // Search results root paths (built from backend search results)
  const searchResultRootsRef = useRef<string[]>([]);

  // Build flat tree for virtual scrolling.
  // Both normal and search modes use the same tree traversal - always tree-like.
  const buildFlatTree = useCallback(
    (rootPaths: string[], map: Record<string, TreeNode>): FlatTreeItem[] => {
      const result: FlatTreeItem[] = [];

      const traverse = (paths: string[], level: number) => {
        for (const path of paths) {
          const node = map[path];
          if (!node) continue;

          // Apply extension filter (SRC/DOCS) for non-directory nodes
          if (!node.is_dir && !matchesExtensionFilter(node)) continue;

          result.push({ path, level });

          if (node.expanded && node.childPaths) {
            traverse(node.childPaths, level + 1);
          }
        }
      };
      traverse(rootPaths, 0);

      return result;
    },
    [matchesExtensionFilter]
  );

  const flatTree = useMemo(() => {
    const roots = isSearchMode ? searchResultRootsRef.current : state.rootPaths;
    return buildFlatTree(roots, state.nodesMap);
  }, [state.rootPaths, state.nodesMap, buildFlatTree, isSearchMode]);

  // Normalize path separators for cross-platform consistency
  const normalizePath = useCallback((filePath: string): string => {
    const normalized = filePath.replace(/\\/g, '/');
    if (/^[A-Za-z]:\/$/.test(normalized)) {
      return normalized.slice(0, 2);
    }
    return normalized;
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
    if (/^[A-Za-z]:$/.test(normalized)) {
      return normalized;
    }
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
  }, [normalizePath]);

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
  }, [searchQuery]);

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
        // Backend returns scored, sorted results
        const results = await invoke<SearchResult[]>("search_path", { pattern: trimmed });
        if (searchRequestIdRef.current !== requestId) return;

        const currentState = stateRef.current;
        const newMap: Record<string, TreeNode> = { ...currentState.nodesMap };

        // Flat list of search result paths (each at level 0)
        const searchRoots: string[] = [];

        for (const entry of results) {
          const normalizedPath = normalizePath(entry.path);
          const normalizedParent = entry.parent_path ? normalizePath(entry.parent_path) : null;

          // Merge entry into map (preserve checked/indeterminate state)
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
            hasChildren: entry.is_dir || (entry.child_count != null && entry.child_count > 0) || existingNode?.hasChildren || false,
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

    run();
  }, [searchQuery, normalizePath]);

  // Load root entries - preserves expansion/selection state across re-indexing
  const loadRootEntries = useCallback(async () => {
    // Capture previous state for preservation across rebuild
    const prevNodesMap = stateRef.current.nodesMap;
    const prevExpandedPaths = new Set<string>();
    const prevCheckedFilePaths = new Set<string>();

    Object.values(prevNodesMap).forEach(node => {
      if (node.expanded) prevExpandedPaths.add(node.path);
      if (node.checked && !node.is_dir) prevCheckedFilePaths.add(node.path);
    });

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

      const rootEntries = normalizedEntries;
      const rootDirs = rootEntries.filter(entry => entry.is_dir);
      const rootFiles = rootEntries.filter(entry => !entry.is_dir);

      const getCommonAncestorPath = (paths: string[]): string | null => {
        if (paths.length === 0) return null;
        const splitPaths = paths.map(p => normalizePath(p).split('/'));
        let commonSegments = splitPaths[0];
        for (let index = 1; index < splitPaths.length; index += 1) {
          const segments = splitPaths[index];
          let shared = 0;
          while (shared < commonSegments.length && shared < segments.length && commonSegments[shared] === segments[shared]) {
            shared += 1;
          }
          commonSegments = commonSegments.slice(0, shared);
          if (commonSegments.length === 0) return null;
        }
        return commonSegments.join('/');
      };

      let rootAnchor: string | null = null;
      if (rootDirs.length > 0 && rootFiles.length === 0) {
        const commonDirAncestor = getCommonAncestorPath(rootDirs.map(entry => entry.path));
        if (commonDirAncestor) {
          rootAnchor = commonDirAncestor;
        }
      } else if (rootFiles.length > 0 && rootDirs.length === 0) {
        const parentPaths = rootFiles.map(entry => entry.parent_path).filter((path): path is string => !!path);
        if (parentPaths.length === rootFiles.length) {
          const uniqueParents = new Set(parentPaths);
          if (uniqueParents.size === 1 && parentPaths.length > 0) {
            rootAnchor = parentPaths[0];
          } else {
            const commonFileAncestor = getCommonAncestorPath(rootFiles.map(entry => entry.path));
            if (commonFileAncestor) {
              rootAnchor = getParentDirectoryPath(commonFileAncestor) ?? commonFileAncestor;
            }
          }
        }
      } else if (rootEntries.length > 0) {
        const commonMixedAncestor = getCommonAncestorPath(rootEntries.map(entry => entry.path));
        if (commonMixedAncestor) {
          rootAnchor = getParentDirectoryPath(commonMixedAncestor) ?? commonMixedAncestor;
        }
      }

      // Fresh maps for rebuild
      const newNodesMap: Record<string, TreeNode> = {};

      // Add all directory entries
      for (const entry of normalizedEntries) {
        newNodesMap[entry.path] = {
          ...entry,
          expanded: false,
          checked: false,
          indeterminate: false,
          hasChildren: entry.is_dir,
          childPaths: [],
        };
      }

      const ensureSyntheticNode = (path: string, parentPath: string | null) => {
        if (!newNodesMap[path]) {
          newNodesMap[path] = {
            path,
            parent_path: parentPath,
            raw_path: path,
            raw_parent_path: parentPath,
            name: getNameFromPath(path),
            size: null,
            mtime: null,
            is_dir: true,
            token_count: null,
            fingerprint: null,
            child_count: null,
            expanded: false,
            checked: false,
            indeterminate: false,
            hasChildren: true,
            childPaths: [],
          };
        }
      };

      const ensureAncestorChain = (startPath: string | null) => {
        let currentPath = startPath;
        while (currentPath) {
          const parentPath = getParentDirectoryPath(currentPath);
          const isRoot = rootAnchor ? currentPath === rootAnchor : parentPath === null;
          ensureSyntheticNode(currentPath, isRoot ? null : parentPath);
          if (isRoot) break;
          currentPath = parentPath;
        }
      };

      for (const entry of rootEntries) {
        ensureAncestorChain(entry.parent_path ?? null);
      }

      if (rootAnchor) {
        ensureSyntheticNode(rootAnchor, null);
      }

      // Single pass: reset childPaths, build parent-child relationships, and update hasChildren
      const allNodes = Object.values(newNodesMap);
      // First reset all directory childPaths
      for (const node of allNodes) {
        if (node.is_dir) {
          node.childPaths = [];
        }
      }
      // Then build parent-child links and update hasChildren in one pass
      const childPathSets = new Map<string, Set<string>>();
      for (const node of allNodes) {
        const parentPath = node.parent_path;
        if (parentPath && newNodesMap[parentPath]) {
          const parent = newNodesMap[parentPath];
          if (parent.is_dir) {
            let childSet = childPathSets.get(parentPath);
            if (!childSet) {
              childSet = new Set(parent.childPaths);
              childPathSets.set(parentPath, childSet);
            }
            if (!childSet.has(node.path)) {
              childSet.add(node.path);
              parent.childPaths!.push(node.path);
            }
          }
        }
      }
      // Update hasChildren based on childPaths
      for (const node of allNodes) {
        if (node.is_dir && node.childPaths) {
          node.hasChildren = node.childPaths.length > 0 || node.hasChildren;
        }
      }

      const newRootPaths: string[] = [];
      if (rootAnchor) {
        newRootPaths.push(rootAnchor);
      } else {
        const seenRoots = new Set<string>();
        Object.values(newNodesMap).forEach((node) => {
          const parentPath = node.parent_path;
          if (!parentPath || !newNodesMap[parentPath]) {
            if (!seenRoots.has(node.path)) {
              seenRoots.add(node.path);
              newRootPaths.push(node.path);
            }
          }
        });
      }

      // --- State preservation: auto-expand roots and restore previous state ---
      // Only apply state preservation when re-indexing (previous state existed)
      const isReIndex = Object.keys(prevNodesMap).length > 0;

      // Track paths that should be expanded
      const pathsToExpand = new Set<string>(prevExpandedPaths);

      const addAncestorsToExpand = (path: string | null) => {
        let current = path;
        while (current) {
          pathsToExpand.add(current);
          current = getParentDirectoryPath(current);
        }
      };

      // Ensure all ancestors of previously expanded paths are also in the set
      Array.from(prevExpandedPaths).forEach(addAncestorsToExpand);
      // Ensure ancestors of checked files are expanded so they are visible
      Array.from(prevCheckedFilePaths).forEach(addAncestorsToExpand);

      if (isReIndex) {
        // For re-indexing: auto-expand parents of NEWLY added items
        Object.keys(newNodesMap).forEach(path => {
          if (!prevNodesMap[path]) {
            const node = newNodesMap[path];
            if (node.is_dir) {
              pathsToExpand.add(path);
            }
            addAncestorsToExpand(node.parent_path);
          }
        });
      } else if (rootEntries.length > 0) {
        // Initial load: auto-expand synthetic ancestors so the indexed content is visible.
        // When a folder is indexed, its ancestor chain (rootAnchor up to drive root) should
        // all be expanded so the user sees the indexed folder's contents immediately.
        rootEntries.forEach(entry => {
          if (!entry.is_dir) {
            // Files: expand their ancestors so they're visible
            addAncestorsToExpand(entry.parent_path);
          }
        });
        // Auto-expand all synthetic ancestor nodes (nodes that exist in the map
        // but are NOT root entries themselves - they were created by ensureAncestorChain)
        const rootEntryPaths = new Set(rootEntries.map(e => e.path));
        Object.values(newNodesMap).forEach(node => {
          if (node.is_dir && !rootEntryPaths.has(node.path)) {
            // This is a synthetic ancestor node - auto-expand it
            pathsToExpand.add(node.path);
          }
        });
      }

      // Track initial root entries to prevent treating them as children of each other
      const initialRootPaths = new Set(newRootPaths);

      // Helper to recursively load children for a directory from the backend
      const loadedPaths = new Set<string>(); // Prevent infinite recursion
      const loadAndExpandChildren = async (rawParentPath: string): Promise<string[]> => {
        const normalizedParent = normalizePath(rawParentPath);
        if (loadedPaths.has(normalizedParent)) return [];
        loadedPaths.add(normalizedParent);

        const childEntries = await invoke<FileEntry[]>("get_children", { parentPath: rawParentPath });
        const childPaths: string[] = [];

        for (const child of childEntries) {
          const normalizedChildPath = normalizePath(child.path);
          // Skip self-references and root entries (to prevent siblings becoming each other's children)
          if (normalizedChildPath === normalizedParent) continue;
          if (initialRootPaths.has(normalizedChildPath)) continue;
          const normalizedChildParent = child.parent_path ? normalizePath(child.parent_path) : null;
          childPaths.push(normalizedChildPath);

          // Only add if not already in the map (from root entries)
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

            // Recursively load children for previously-expanded subdirectories
            if (shouldExpand) {
              newNodesMap[normalizedChildPath].childPaths =
                await loadAndExpandChildren(child.path);
            }
          } else if (pathsToExpand.has(normalizedChildPath)) {
            const existingNode = newNodesMap[normalizedChildPath];
            if (existingNode && existingNode.is_dir) {
              // Node exists but was previously expanded - expand it and load children
              newNodesMap[normalizedChildPath] = { ...existingNode, expanded: true };
              if (!existingNode.childPaths || existingNode.childPaths.length === 0) {
                newNodesMap[normalizedChildPath].childPaths =
                  await loadAndExpandChildren(child.path);
              }
            }
          }
        }

        return childPaths;
      };

      // Apply expansion state (both restored and auto-expanded)
      for (const rootPath of newRootPaths) {
        const rootNode = newNodesMap[rootPath];
        if (rootNode && rootNode.is_dir && pathsToExpand.has(rootPath) && !rootNode.expanded) {
          rootNode.expanded = true;
          const rootChildPaths = rootNode.childPaths ?? [];
          if (rootChildPaths.length === 0) {
            const rawPath = rootNode.raw_path ?? rootPath;
            rootNode.childPaths = await loadAndExpandChildren(rawPath);
          } else {
            // Children already populated - recursively restore expansion for sub-dirs
            const restoreExpansion = async (parentChildPaths: string[]) => {
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

      // Restore selection state when re-indexing
      if (isReIndex) {
        // Restore selection state for previously-checked files
        prevCheckedFilePaths.forEach(filePath => {
          if (newNodesMap[filePath] && !newNodesMap[filePath].is_dir) {
            newNodesMap[filePath] = { ...newNodesMap[filePath], checked: true };
          }
        });

        // Propagate parent selection states (indeterminate/checked) upward
        const propagateParentState = (parentPath: string | null) => {
          if (!parentPath || !newNodesMap[parentPath]) return;
          const parent = newNodesMap[parentPath];
          if (!parent.childPaths || parent.childPaths.length === 0) return;

          const childNodes = parent.childPaths.map(p => newNodesMap[p]).filter(Boolean);
          const checkedCount = childNodes.filter(c => c.checked).length;
          const indeterminateCount = childNodes.filter(c => c.indeterminate).length;
          const isAllChecked = checkedCount === childNodes.length && childNodes.length > 0;
          const isIndeterminate = (checkedCount > 0 && !isAllChecked) || indeterminateCount > 0;

          newNodesMap[parentPath] = { ...parent, checked: isAllChecked, indeterminate: isIndeterminate };
          propagateParentState(parent.parent_path);
        };

        prevCheckedFilePaths.forEach(filePath => {
          const node = newNodesMap[filePath];
          if (node) {
            propagateParentState(node.parent_path);
          }
        });
      }

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
      const currentState = stateRef.current;
      const normalizedNodePath = normalizePath(nodePath);
      const node = currentState.nodesMap[normalizedNodePath];
      if (!node || !node.is_dir) return;

      if (!node.expanded && (!node.childPaths || node.childPaths.length === 0)) {
        const children = await loadChildren(node.raw_path ?? normalizedNodePath);
        // Normalize child paths
        const normalizedChildren = children.map(child => ({
          ...child,
          path: normalizePath(child.path),
          parent_path: child.parent_path ? normalizePath(child.parent_path) : null,
        }));

        const newNodesMap: Record<string, TreeNode> = { ...currentState.nodesMap };

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
    [loadChildren, normalizePath]
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

  const collectSelected = useCallback(
    (map: Record<string, TreeNode>): string[] => {
      const selectedPaths: string[] = [];
      for (const node of Object.values(map)) {
        if (node.checked && !node.is_dir) {
          selectedPaths.push(node.path);
        }
      }
      return selectedPaths;
    },
    []
  );

  const isSensitivePreventionEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const [sensitiveEnabled, preventSelectionEnabled] = await Promise.all([
        invoke<boolean>("get_sensitive_data_enabled"),
        invoke<boolean>("get_prevent_selection"),
      ]);
      return sensitiveEnabled && preventSelectionEnabled;
    } catch (error) {
      console.warn("Failed to resolve sensitive prevention settings:", error);
      return false;
    }
  }, []);

  const collectDescendantFilePaths = useCallback(
    (map: Record<string, TreeNode>, startPath: string): string[] => {
      const rootNode = map[startPath];
      if (!rootNode) return [];
      if (!rootNode.is_dir) return [startPath];

      const result: string[] = [];
      const stack: string[] = [...(rootNode.childPaths ?? [])];

      while (stack.length > 0) {
        const currentPath = stack.pop()!;
        const currentNode = map[currentPath];
        if (!currentNode) continue;
        if (currentNode.is_dir) {
          if (currentNode.childPaths?.length) {
            stack.push(...currentNode.childPaths);
          }
        } else {
          result.push(currentPath);
        }
      }

      return result;
    },
    []
  );

  const getSensitivePathSet = useCallback(
    async (paths: string[]): Promise<Set<string>> => {
      if (paths.length === 0) return new Set<string>();
      try {
        const scanResults = await invoke<SensitiveScanResult[]>("scan_files_sensitive", {
          filePaths: paths,
        });
        return new Set(
          scanResults
            .filter((result) => result.has_sensitive_data)
            .map((result) => normalizePath(result.path))
        );
      } catch (error) {
        console.warn("Failed to scan files for sensitive data:", error);
        return new Set<string>();
      }
    },
    [normalizePath]
  );

  // Toggle checkbox
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
            if (!sensitiveNode || sensitiveNode.is_dir) continue;
            if (!sensitiveNode.checked) continue;

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
        const selected = collectSelected(newMap);
        onSelectionChange(selected);
      }
    },
    [
      onSelectionChange,
      loadAllChildrenRecursively,
      updateChildrenSelection,
      updateParentSelection,
      collectSelected,
      isSearchMode,
      isSensitivePreventionEnabled,
      collectDescendantFilePaths,
      getSensitivePathSet,
    ]
  );

  const clearSelection = useCallback(() => {
    const currentState = stateRef.current;
    const newMap = { ...currentState.nodesMap };
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
  }, [onSelectionChange]);

  const getSelectedPaths = useCallback(() => {
    const currentState = stateRef.current;
    return collectSelected(currentState.nodesMap);
  }, [collectSelected]);

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
          onSelectionChange(collectSelected(newMap));
        }
      }
    },
    [collectSelected, normalizePath, onSelectionChange, updateParentSelection]
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
    [dispatch, loadRootEntries, loadChildren, toggleExpand, toggleCheck, clearSelection, setFilter, clearAll, getSelectedPaths, applyInitialSelection]
  );

  return (
    <FilterTypeContext.Provider value={state.filterType}>
      <FileTreeStateContext.Provider value={stateValue}>
        <FileTreeActionsContext.Provider value={actionsValue}>
          {children}
        </FileTreeActionsContext.Provider>
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

// Lightweight hook that only re-renders when filterType changes (not on tree mutations)
export function useFilterType(): FilterType {
  return useContext(FilterTypeContext);
}

export function useFileTree() {
  const stateContext = useFileTreeState();
  const actionsContext = useFileTreeActions();
  return { ...stateContext, ...actionsContext };
}
