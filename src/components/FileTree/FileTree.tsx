import { useState, useCallback, useRef, useEffect, useReducer } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TreeNode, FileEntry } from '../../types';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FileTreeProps {
  onSelectionChange?: (selectedPaths: string[]) => void;
  searchQuery?: string;
  initialSelectedPaths?: string[];
  shouldClearSelection?: boolean;
}

type FilterType = 'ALL' | 'SRC' | 'DOCS';

interface TreeState {
  nodesMap: Record<string, TreeNode>;
  rootPaths: string[];
  filterType: FilterType;
}

type TreeAction =
  | { type: 'MERGE_ROOTS'; entries: FileEntry[] }
  | { type: 'SET_CHILDREN'; parentPath: string; children: FileEntry[] }
  | { type: 'TOGGLE_EXPAND'; nodePath: string }
  | { type: 'SET_EXPANDED'; nodePath: string; expanded: boolean }
  | { type: 'BATCH_UPDATE'; nodesMap: Record<string, TreeNode> }
  | { type: 'SET_FILTER'; filter: FilterType }
  | { type: 'CLEAR_SELECTIONS' };

// ─── Extension lists (module-level, created once) ───────────────────────────

const SRC_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.c', '.cpp', '.h',
  '.java', '.rb', '.php', '.css', '.html', '.sh', '.yaml', '.json',
]);

const DOCS_EXTENSIONS = new Set([
  '.md', '.txt', '.pdf', '.docx', '.doc', '.odt', '.rtf',
]);

// ─── Pure helpers ───────────────────────────────────────────────────────────

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function getExtension(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.substring(dot).toLowerCase() : '';
}

function getParentPath(path: string): string {
  const last = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return last > 0 ? path.substring(0, last) : '';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getFileIconName(path: string): string {
  switch (getExtension(path)) {
    case '.ts': case '.tsx': return 'terminal';
    case '.js': case '.jsx': return 'javascript';
    case '.py': return 'code';
    case '.go': return 'description';
    case '.css': return 'css';
    case '.json': return 'data_object';
    default: return 'description';
  }
}

function getFileIconColor(name: string): string {
  if (name.endsWith('.go')) return 'text-blue-400';
  if (name.endsWith('.py')) return 'text-yellow-500';
  if (name.endsWith('.json')) return 'text-green-400';
  if (name.endsWith('.css')) return 'text-blue-400';
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'text-blue-500';
  return 'text-white/40';
}

/** Check if childPath is a direct child of parentPath. */
function isDirectChildOf(childPath: string, parentPath: string): boolean {
  const cp = normalizePath(childPath);
  const pp = normalizePath(parentPath);
  const prefix = pp.endsWith('/') ? pp : pp + '/';
  if (!cp.startsWith(prefix)) return false;
  const remainder = cp.substring(prefix.length);
  return remainder.length > 0 && !remainder.includes('/');
}

/** Merge a backend FileEntry into a TreeNode, preserving existing UI state. */
function mergeEntry(entry: FileEntry, existing: TreeNode | undefined): TreeNode {
  return {
    ...entry,
    expanded: existing?.expanded ?? false,
    checked: existing?.checked ?? false,
    indeterminate: existing?.indeterminate ?? false,
    hasChildren: entry.is_dir,
    childPaths: existing?.childPaths?.length ? existing.childPaths : [],
    child_count: entry.child_count ?? existing?.child_count ?? null,
  };
}

/**
 * Remove root entries whose path falls inside another root directory.
 * E.g. if "plan.ts" is at root and then "track1/" is indexed,
 * plan.ts should no longer appear at root level.
 */
function deduplicateRoots(entries: FileEntry[]): FileEntry[] {
  const dirPrefixes: string[] = [];
  for (const e of entries) {
    if (e.is_dir) {
      const p = normalizePath(e.path);
      dirPrefixes.push(p.endsWith('/') ? p : p + '/');
    }
  }
  return entries.filter(entry => {
    const ep = normalizePath(entry.path);
    for (const prefix of dirPrefixes) {
      if (ep !== prefix.slice(0, -1) && ep.startsWith(prefix)) return false;
    }
    return true;
  });
}

// ─── Selection helpers (operate on a mutable snapshot) ──────────────────────

function setSubtreeChecked(map: Record<string, TreeNode>, nodePath: string, checked: boolean) {
  const node = map[nodePath];
  if (!node) return;
  map[nodePath] = { ...node, checked, indeterminate: false };
  if (node.childPaths) {
    for (const cp of node.childPaths) {
      setSubtreeChecked(map, cp, checked);
    }
  }
}

function recomputeParentChain(map: Record<string, TreeNode>, parentPath: string | null) {
  if (parentPath === null) return;
  const parent = map[parentPath];
  if (!parent?.childPaths?.length) return;

  let allChecked = true;
  let anyChecked = false;
  let anyIndeterminate = false;

  for (const cp of parent.childPaths) {
    const child = map[cp];
    if (!child) continue;
    if (child.checked) anyChecked = true; else allChecked = false;
    if (child.indeterminate) anyIndeterminate = true;
  }

  const newChecked = allChecked && parent.childPaths.length > 0;
  const newIndet = !newChecked && (anyChecked || anyIndeterminate);

  if (parent.checked !== newChecked || parent.indeterminate !== newIndet) {
    map[parentPath] = { ...parent, checked: newChecked, indeterminate: newIndet };
    recomputeParentChain(map, parent.parent_path);
  }
}

function collectSelectedPaths(map: Record<string, TreeNode>, rootPaths: string[]): string[] {
  const result: string[] = [];
  const visit = (paths: string[]) => {
    for (const p of paths) {
      const n = map[p];
      if (!n) continue;
      if (n.checked && !n.is_dir) result.push(n.path);
      if (n.childPaths?.length) visit(n.childPaths);
    }
  };
  visit(rootPaths);
  return result;
}

// ─── Orphan adoption: find existing nodes that should be children of a dir ──

function adoptOrphans(map: Record<string, TreeNode>, dirPath: string) {
  const node = map[dirPath];
  if (!node) return;

  const existingChildPaths = new Set(node.childPaths || []);
  const adopted: string[] = [];

  for (const key of Object.keys(map)) {
    if (key === dirPath) continue;
    if (existingChildPaths.has(key)) continue;
    if (isDirectChildOf(key, dirPath)) {
      adopted.push(key);
      // Update child's parent_path reference
      map[key] = { ...map[key], parent_path: dirPath };
    }
  }

  if (adopted.length > 0) {
    const allChildPaths = [...(node.childPaths || []), ...adopted];
    const hasSelectedChildren = allChildPaths.some(cp => {
      const child = map[cp];
      return child && (child.checked || child.indeterminate);
    });

    map[dirPath] = {
      ...node,
      childPaths: allChildPaths,
      expanded: node.expanded || hasSelectedChildren,
    };

    recomputeParentChain(map, dirPath);
  }
}

// ─── Reducer ────────────────────────────────────────────────────────────────

function treeReducer(state: TreeState, action: TreeAction): TreeState {
  switch (action.type) {

    case 'MERGE_ROOTS': {
      const deduped = deduplicateRoots(action.entries);
      const newMap = { ...state.nodesMap };

      // Update/add all entries (not just deduped - we want children in the map too)
      for (const entry of action.entries) {
        newMap[entry.path] = mergeEntry(entry, newMap[entry.path]);
      }

      // Build new root list from deduped entries
      const incomingRootPaths = deduped.map(e => e.path);
      const incomingSet = new Set(incomingRootPaths);

      // Keep old roots that are still independent
      for (const oldPath of state.rootPaths) {
        if (incomingSet.has(oldPath)) continue;
        const node = newMap[oldPath];
        if (!node) continue;
        const np = normalizePath(node.path);
        let isDescendant = false;
        for (const rp of incomingRootPaths) {
          const root = newMap[rp];
          if (root?.is_dir) {
            const rootNorm = normalizePath(root.path);
            const prefix = rootNorm.endsWith('/') ? rootNorm : rootNorm + '/';
            if (np.startsWith(prefix)) {
              isDescendant = true;
              break;
            }
          }
        }
        if (!isDescendant) incomingRootPaths.push(oldPath);
      }

      // Adopt orphans into newly added directories
      const dirEntries = action.entries
        .filter(e => e.is_dir)
        .sort((a, b) => {
          // Process deepest first
          const da = (normalizePath(a.path).match(/\//g) || []).length;
          const db = (normalizePath(b.path).match(/\//g) || []).length;
          return db - da;
        });

      for (const dir of dirEntries) {
        adoptOrphans(newMap, dir.path);
      }

      return { ...state, nodesMap: newMap, rootPaths: incomingRootPaths };
    }

    case 'SET_CHILDREN': {
      const newMap = { ...state.nodesMap };
      const parent = newMap[action.parentPath];
      if (!parent) return state;

      const childPaths: string[] = [];
      for (const entry of action.children) {
        childPaths.push(entry.path);
        newMap[entry.path] = mergeEntry(entry, newMap[entry.path]);
      }

      // Also adopt orphans (existing nodes that should be direct children)
      const adoptedSet = new Set(childPaths);
      for (const key of Object.keys(newMap)) {
        if (key === action.parentPath) continue;
        if (adoptedSet.has(key)) continue;
        if (isDirectChildOf(key, action.parentPath)) {
          childPaths.push(key);
          newMap[key] = { ...newMap[key], parent_path: action.parentPath };
        }
      }

      newMap[action.parentPath] = { ...parent, childPaths };

      // Update parent's check state based on children
      recomputeParentChain(newMap, action.parentPath);

      return { ...state, nodesMap: newMap };
    }

    case 'TOGGLE_EXPAND': {
      const node = state.nodesMap[action.nodePath];
      if (!node?.is_dir) return state;
      return {
        ...state,
        nodesMap: {
          ...state.nodesMap,
          [action.nodePath]: { ...node, expanded: !node.expanded },
        },
      };
    }

    case 'SET_EXPANDED': {
      const node = state.nodesMap[action.nodePath];
      if (!node) return state;
      return {
        ...state,
        nodesMap: {
          ...state.nodesMap,
          [action.nodePath]: { ...node, expanded: action.expanded },
        },
      };
    }

    case 'BATCH_UPDATE':
      return { ...state, nodesMap: action.nodesMap };

    case 'SET_FILTER':
      return { ...state, filterType: action.filter };

    case 'CLEAR_SELECTIONS': {
      const newMap: Record<string, TreeNode> = {};
      for (const [path, node] of Object.entries(state.nodesMap)) {
        newMap[path] = { ...node, checked: false, indeterminate: false };
      }
      return { ...state, nodesMap: newMap };
    }

    default:
      return state;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const FileTree: React.FC<FileTreeProps> = ({
  onSelectionChange,
  searchQuery = '',
  initialSelectedPaths,
  shouldClearSelection,
}) => {
  const [state, dispatch] = useReducer(treeReducer, {
    nodesMap: {},
    rootPaths: [],
    filterType: 'ALL',
  });

  const [toast, setToast] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const initialPathsApplied = useRef(false);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  // ── Filter logic ────────────────────────────────────────────────────────

  const matchesFilter = useCallback(
    (node: TreeNode): boolean => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!node.name.toLowerCase().includes(q) && !node.path?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (state.filterType === 'ALL') return true;
      if (node.is_dir) return true;
      const ext = getExtension(node.path);
      if (state.filterType === 'SRC') return SRC_EXTENSIONS.has(ext);
      if (state.filterType === 'DOCS') return DOCS_EXTENSIONS.has(ext);
      return true;
    },
    [state.filterType, searchQuery],
  );

  // ── Flat tree (computed directly, not stored in state) ────────────────

  const buildFlatTree = useCallback(
    (paths: string[], map: Record<string, TreeNode>, level = 0): (TreeNode & { level: number })[] => {
      const result: (TreeNode & { level: number })[] = [];
      for (const p of paths) {
        const node = map[p];
        if (!node) continue;
        if (!node.is_dir && !matchesFilter(node)) continue;
        result.push({ ...node, level });
        if (node.is_dir && node.expanded && node.childPaths?.length) {
          result.push(...buildFlatTree(node.childPaths, map, level + 1));
        }
      }
      return result;
    },
    [matchesFilter],
  );

  const flatTree = buildFlatTree(state.rootPaths, state.nodesMap);

  // ── Virtual scrolling ─────────────────────────────────────────────────

  const rowVirtualizer = useVirtualizer({
    count: flatTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  // ── Data loading ──────────────────────────────────────────────────────

  const loadRootEntries = useCallback(async () => {
    try {
      const entries = await invoke<FileEntry[]>('get_children', { parentPath: null });
      dispatch({ type: 'MERGE_ROOTS', entries });
    } catch (error) {
      console.error('Failed to load root entries:', error);
    }
  }, []);

  const loadChildrenFromBackend = useCallback(async (parentPath: string): Promise<FileEntry[]> => {
    try {
      return await invoke<FileEntry[]>('get_children', { parentPath });
    } catch (error) {
      console.error('Failed to load children:', error);
      return [];
    }
  }, []);

  // ── Toggle expansion ─────────────────────────────────────────────────

  const toggleExpand = useCallback(
    async (nodePath: string) => {
      const node = state.nodesMap[nodePath];
      if (!node?.is_dir) return;

      const needsLoad = !node.expanded && (
        !node.childPaths ||
        node.childPaths.length === 0 ||
        (node.child_count !== null && node.child_count > (node.childPaths?.length || 0))
      );

      if (needsLoad) {
        const children = await loadChildrenFromBackend(nodePath);
        dispatch({ type: 'SET_CHILDREN', parentPath: nodePath, children });
        dispatch({ type: 'SET_EXPANDED', nodePath, expanded: true });
      } else {
        dispatch({ type: 'TOGGLE_EXPAND', nodePath });
      }
    },
    [state.nodesMap, loadChildrenFromBackend],
  );

  // ── Recursive child loader (for selecting an unloaded folder) ─────────

  const loadSubtreeRecursively = useCallback(
    async (nodePath: string, targetMap: Record<string, TreeNode>) => {
      const entries = await loadChildrenFromBackend(nodePath);
      const childPaths: string[] = [];
      for (const entry of entries) {
        childPaths.push(entry.path);
        const childNode = mergeEntry(entry, targetMap[entry.path]);
        childNode.checked = true;
        childNode.indeterminate = false;
        targetMap[entry.path] = childNode;
        if (entry.is_dir) {
          await loadSubtreeRecursively(entry.path, targetMap);
        }
      }
      const parent = targetMap[nodePath];
      if (parent) {
        targetMap[nodePath] = { ...parent, childPaths };
      }
    },
    [loadChildrenFromBackend],
  );

  // ── Toggle checkbox ───────────────────────────────────────────────────

  const toggleCheck = useCallback(
    async (nodePath: string, checked: boolean) => {
      // Take a deep snapshot to avoid stale closures
      const snapshot: Record<string, TreeNode> = {};
      for (const [key, val] of Object.entries(state.nodesMap)) {
        snapshot[key] = { ...val };
      }

      const node = snapshot[nodePath];
      if (!node) return;

      if (node.is_dir && checked && (!node.childPaths || node.childPaths.length === 0)) {
        await loadSubtreeRecursively(nodePath, snapshot);
        snapshot[nodePath] = { ...snapshot[nodePath], checked: true, indeterminate: false, expanded: true };
      } else {
        setSubtreeChecked(snapshot, nodePath, checked);
      }

      recomputeParentChain(snapshot, node.parent_path);
      dispatch({ type: 'BATCH_UPDATE', nodesMap: snapshot });

      const cb = onSelectionChangeRef.current;
      if (cb) {
        cb(collectSelectedPaths(snapshot, state.rootPaths));
      }
    },
    [state.nodesMap, state.rootPaths, loadSubtreeRecursively],
  );

  // ── Clipboard ─────────────────────────────────────────────────────────

  const copyPathToClipboard = useCallback((path: string) => {
    navigator.clipboard.writeText(path).then(() => {
      setToast('Path copied!');
      setTimeout(() => setToast(null), 2000);
    });
  }, []);

  // ── Event listeners ───────────────────────────────────────────────────

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    const setup = async () => {
      unlisten = await listen('refresh-file-tree', () => loadRootEntries());
    };
    setup();
    return () => { unlisten?.(); };
  }, [loadRootEntries]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    const setup = async () => {
      unlisten = await listen('indexing-progress', (event: { payload: { current_path: string } }) => {
        if (event.payload.current_path === 'Complete') {
          loadRootEntries();
        }
      });
    };
    setup();
    return () => { unlisten?.(); };
  }, [loadRootEntries]);

  // ── Restore initial selection ─────────────────────────────────────────

  useEffect(() => {
    if (
      initialSelectedPaths?.length &&
      state.rootPaths.length > 0 &&
      !initialPathsApplied.current
    ) {
      const pathsSet = new Set(initialSelectedPaths);
      const snapshot: Record<string, TreeNode> = {};
      let changed = false;

      for (const [key, val] of Object.entries(state.nodesMap)) {
        snapshot[key] = { ...val };
      }

      for (const node of Object.values(snapshot)) {
        if (!node.is_dir && pathsSet.has(node.path) && !node.checked) {
          snapshot[node.path] = { ...node, checked: true, indeterminate: false };
          recomputeParentChain(snapshot, node.parent_path);
          changed = true;
        }
      }

      if (changed) {
        dispatch({ type: 'BATCH_UPDATE', nodesMap: snapshot });
        initialPathsApplied.current = true;
      }
    }
  }, [initialSelectedPaths, state.rootPaths.length, state.nodesMap]);

  // ── Clear selections ──────────────────────────────────────────────────

  useEffect(() => {
    if (shouldClearSelection) {
      dispatch({ type: 'CLEAR_SELECTIONS' });
      onSelectionChangeRef.current?.([]);
    }
  }, [shouldClearSelection]);

  // ── Load on mount ─────────────────────────────────────────────────────

  useEffect(() => {
    loadRootEntries();
  }, [loadRootEntries]);

  // ── Drag over handler ─────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full w-full bg-[#0d1117] text-[#c9d1d9] overflow-hidden"
      data-testid="file-tree-container"
      role="tree"
      aria-label="File tree"
    >
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600/90 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50 animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Filter Bar */}
      <div className="h-8 flex items-center px-2 justify-between border-b border-border-dark bg-[#0d1117]">
        <div className="flex items-center gap-1" role="group" aria-label="File type filter">
          {(['ALL', 'SRC', 'DOCS'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => dispatch({ type: 'SET_FILTER', filter: t })}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-bold transition-all',
                'focus:outline-none focus:ring-1 focus:ring-primary/50',
                state.filterType === t
                  ? 'bg-primary/20 text-primary'
                  : 'text-white/40 hover:bg-white/5',
              )}
              aria-pressed={state.filterType === t}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="flex items-center gap-0.5 text-[9px] font-medium text-white/50 hover:text-white">
            <span>Name</span>
            <span className="material-symbols-outlined text-[12px]">arrow_drop_down</span>
          </button>
          <button type="button" className="flex items-center gap-0.5 text-[9px] font-medium text-white/50 hover:text-white">
            <span>Size</span>
            <span className="material-symbols-outlined text-[12px]">unfold_more</span>
          </button>
        </div>
      </div>

      {/* Tree content */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto relative custom-scrollbar"
        data-testid="file-tree-scroll"
        onDragOver={handleDragOver}
      >
        {flatTree.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-muted-foreground text-sm p-5 text-center select-none"
            data-testid="empty-state"
            role="status"
          >
            {searchQuery
              ? 'No matching files found.'
              : 'No files indexed. Drag and drop a folder to start.'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const node = flatTree[virtualRow.index];
              const isFolder = node.is_dir;
              const paddingLeft = node.level * 12 + 8;

              if (isFolder) {
                return (
                  <div
                    key={node.path}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="flex items-center px-2 py-1 sticky z-10 w-full bg-[#161b22]/90 backdrop-blur-sm border-b border-border-dark"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingLeft: `${paddingLeft}px`,
                    }}
                    onClick={() => toggleCheck(node.path, !node.checked)}
                    data-testid="tree-node"
                    data-node-type="folder"
                    role="treeitem"
                    aria-expanded={node.expanded}
                    aria-selected={node.checked}
                  >
                    <span
                      className={cn(
                        'material-symbols-outlined text-[14px] text-white/40 mr-1 cursor-pointer transition-transform select-none',
                        node.expanded && 'rotate-90',
                      )}
                      data-testid="expand-icon"
                      data-expanded={node.expanded}
                      onClick={e => { e.stopPropagation(); toggleExpand(node.path); }}
                      role="button"
                      tabIndex={0}
                      aria-label={node.expanded ? 'Collapse folder' : 'Expand folder'}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault(); e.stopPropagation(); toggleExpand(node.path);
                        }
                      }}
                    >
                      chevron_right
                    </span>

                    <div className="w-5 flex justify-center mr-1" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="custom-checkbox appearance-none border border-border-dark checked:bg-primary checked:border-transparent relative after:content-[''] after:absolute after:inset-0 after:m-auto after:block after:w-1.5 after:h-1.5 after:rounded-[1px] checked:after:bg-white cursor-pointer size-2.5 rounded-sm bg-transparent text-primary focus:ring-0 focus:ring-offset-0 select-none"
                        checked={node.checked}
                        onChange={() => toggleCheck(node.path, !node.checked)}
                        ref={el => { if (el) el.indeterminate = node.indeterminate; }}
                        data-testid="tree-checkbox"
                        aria-label={`Select ${node.name}`}
                      />
                    </div>

                    <span className="material-symbols-outlined text-[14px] text-yellow-600/70 mr-2 select-none" data-testid="tree-icon" aria-hidden="true">
                      folder
                    </span>

                    <span className="text-[10px] font-medium text-white/70 flex-shrink-0" data-testid="tree-label">
                      {node.name}
                    </span>

                    <span className="text-[9px] text-white/30 ml-2 flex-1 whitespace-nowrap">
                      ({node.child_count ?? node.childPaths?.length ?? 0} items)
                    </span>

                    <span
                      className="text-white/20 text-[9px] pr-2 ml-2 cursor-pointer hover:text-white/40 transition-colors select-none min-w-0 truncate"
                      style={{ direction: 'rtl', textAlign: 'left' }}
                      onClick={e => { e.stopPropagation(); copyPathToClipboard(node.path); }}
                    >
                      {getParentPath(node.path)}
                    </span>
                  </div>
                );
              }

              // ── File row ──
              return (
                <div
                  key={node.path}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="flex items-center px-2 py-0.5 min-h-[22px] border-b border-border-dark/30 hover:bg-white/[0.02] transition-colors"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: `${paddingLeft}px`,
                  }}
                  onClick={() => toggleCheck(node.path, !node.checked)}
                  data-testid="tree-node"
                  data-node-type="file"
                  role="treeitem"
                  aria-selected={node.checked}
                >
                  <span className="material-symbols-outlined text-[14px] mr-1 invisible select-none">chevron_right</span>

                  <div className="w-5 flex justify-center mr-1" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="custom-checkbox appearance-none border border-border-dark checked:bg-primary checked:border-transparent relative after:content-[''] after:absolute after:inset-0 after:m-auto after:block after:w-1.5 after:h-1.5 after:rounded-[1px] checked:after:bg-white cursor-pointer size-2.5 rounded-sm bg-transparent text-primary focus:ring-0 focus:ring-offset-0 select-none"
                      checked={node.checked}
                      onChange={() => toggleCheck(node.path, !node.checked)}
                      ref={el => { if (el) el.indeterminate = node.indeterminate; }}
                      data-testid="tree-checkbox"
                      aria-label={`Select ${node.name}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span
                      className={cn('material-symbols-outlined text-[13px] select-none flex-shrink-0', getFileIconColor(node.name))}
                      data-testid="tree-icon"
                      aria-hidden="true"
                    >
                      {getFileIconName(node.path)}
                    </span>

                    <span className="text-white text-[11px] flex-1 shrink-0" data-testid="tree-label">
                      {node.name}
                    </span>

                    <span
                      className="text-white/20 text-[9px] pr-2 cursor-pointer hover:text-white/40 transition-colors select-none min-w-0 truncate"
                      style={{ direction: 'rtl', textAlign: 'left' }}
                      onClick={e => { e.stopPropagation(); copyPathToClipboard(node.path); }}
                    >
                      {getParentPath(node.path)}
                    </span>
                  </div>

                  <div className="px-2 select-none">
                    <span className="text-[9px] font-mono text-white/30">
                      {formatFileSize(node.size || 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
