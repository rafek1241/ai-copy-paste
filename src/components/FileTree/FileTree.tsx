import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TreeNode, FileEntry } from '../../types';
import { cn } from '@/lib/utils';
import { parseSearchQuery, matchesSearchFilters, getMatchScore, SearchFilters } from '@/lib/searchFilters';

interface FileTreeProps {
  onSelectionChange?: (selectedPaths: string[], selectedIds: number[]) => void;
  searchQuery?: string;
  initialSelectedPaths?: string[];
  shouldClearSelection?: boolean;
}

export const FileTree: React.FC<FileTreeProps> = ({ onSelectionChange, searchQuery = "", initialSelectedPaths, shouldClearSelection }) => {
  const [nodesMap, setNodesMap] = useState<Record<number, TreeNode>>({});
  const [rootIds, setRootIds] = useState<number[]>([]);
  const [flatTree, setFlatTree] = useState<TreeNode[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'SRC' | 'DOCS'>('ALL');
  const [toast, setToast] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: flatTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  // Extensions for filters
  const SRC_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.c', '.cpp', '.h', '.java', '.rb', '.php', '.css', '.html', '.sh', '.yaml', '.json'];
  const DOCS_EXTENSIONS = ['.md', '.txt', '.pdf', '.docx', '.doc', '.odt', '.rtf'];

  // Parse search query into structured filters (memoized for performance)
  const parsedFilters = useMemo<SearchFilters>(() => {
    return parseSearchQuery(searchQuery);
  }, [searchQuery]);

  const matchesFilter = useCallback((node: TreeNode): boolean => {
    // Search query matching using advanced filters
    if (searchQuery) {
      if (!matchesSearchFilters(node, parsedFilters)) {
        return false;
      }
    }

    if (filterType === 'ALL') return true;

    // For directories in filtered mode, we might want to keep them if they contain matching children
    // But for simple filtering:
    if (node.is_dir) return true;

    const ext = node.path.substring(node.path.lastIndexOf('.')).toLowerCase();
    if (filterType === 'SRC') return SRC_EXTENSIONS.includes(ext);
    if (filterType === 'DOCS') return DOCS_EXTENSIONS.includes(ext);
    return true;
  }, [filterType, searchQuery, parsedFilters]);

  // Convert tree to flat list for virtual scrolling
  const buildFlatTree = useCallback((ids: number[], map: Record<number, TreeNode>, level = 0): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const id of ids) {
      const node = map[id];
      if (!node) continue;

      const isMatch = matchesFilter(node);

      // Skip non-matching files (but always process directories to maintain tree structure)
      if (!node.is_dir && !isMatch) continue;

      // Always add directories to maintain tree hierarchy
      // Add files only if they match the filter
      // Include match score for sorting when using file: filter
      const matchScore = searchQuery && parsedFilters.fileName
        ? getMatchScore(node, parsedFilters)
        : 1;
      const nodeWithLevel = { ...node, level, matchScore } as TreeNode & { level: number; matchScore: number };
      result.push(nodeWithLevel);

      // If expanded and has children, recursively add them
      if (node.expanded && node.childIds) {
        result.push(...buildFlatTree(node.childIds, map, level + 1));
      }
    }

    // Sort by match score (highest first) when using file: filter
    // Keep directories in their hierarchy position
    if (searchQuery && parsedFilters.fileName && level === 0) {
      // Sort files by match score, keeping folder order
      result.sort((a, b) => {
        // Folders come before files at the same level
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;

        // Sort files by match score (higher is better)
        const scoreA = (a as any).matchScore || 0;
        const scoreB = (b as any).matchScore || 0;
        return scoreB - scoreA;
      });
    }

    return result;
  }, [matchesFilter, searchQuery, parsedFilters]);

  // Update flat tree when nodes map or root ids change
  useEffect(() => {
    setFlatTree(buildFlatTree(rootIds, nodesMap));
  }, [nodesMap, rootIds, buildFlatTree]);

  // Load root level entries
  const loadRootEntries = useCallback(async () => {
    try {
      const entries = await invoke<FileEntry[]>('get_children', { parentId: null });
      const newNodesMap: Record<number, TreeNode> = {};
      const newRootIds: number[] = [];

      entries.forEach(entry => {
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

      setNodesMap(newNodesMap);
      setRootIds(newRootIds);
    } catch (error) {
      console.error('Failed to load root entries:', error);
    }
  }, []);

  // Load children for a node
  const loadChildren = useCallback(async (nodeId: number): Promise<TreeNode[]> => {
    try {
      const entries = await invoke<FileEntry[]>('get_children', { parentId: nodeId });
      return entries.map(entry => ({
        ...entry,
        expanded: false,
        checked: false,
        indeterminate: false,
        hasChildren: entry.is_dir,
        childIds: [],
      }));
    } catch (error) {
      console.error('Failed to load children:', error);
      return [];
    }
  }, []);

  // Toggle node expansion
  const toggleExpand = useCallback(async (nodeId: number) => {
    const node = nodesMap[nodeId];
    if (!node || !node.is_dir) return;

    if (!node.expanded && (!node.childIds || node.childIds.length === 0)) {
      const children = await loadChildren(nodeId);
      const newNodesMap = { ...nodesMap };
      const childIds = children.map(c => c.id);

      // Update parent
      newNodesMap[nodeId] = { ...node, expanded: true, childIds };

      // Add children to map
      children.forEach(child => {
        if (!newNodesMap[child.id]) {
          newNodesMap[child.id] = child;
        }
      });

      setNodesMap(newNodesMap);
    } else {
      setNodesMap({
        ...nodesMap,
        [nodeId]: { ...node, expanded: !node.expanded }
      });
    }
  }, [nodesMap, loadChildren]);

  // Recursively update children selection
  const updateChildrenSelection = (
    map: Record<number, TreeNode>,
    nodeId: number,
    checked: boolean
  ) => {
    const node = map[nodeId];
    if (!node) return;

    map[nodeId] = {
      ...node,
      checked,
      indeterminate: false,
    };

    if (node.childIds) {
      node.childIds.forEach(childId => {
        updateChildrenSelection(map, childId, checked);
      });
    }
  };

  // Update parent selection states up the tree
  const updateParentSelection = (map: Record<number, TreeNode>, parentId: number | null) => {
    if (parentId === null) return;

    const parent = map[parentId];
    if (!parent || !parent.childIds) return;

    const children = parent.childIds.map(id => map[id]).filter(Boolean);
    const checkedCount = children.filter(c => c.checked).length;
    const indeterminateCount = children.filter(c => c.indeterminate).length;

    const isAllChecked = checkedCount === children.length && children.length > 0;
    const isIndeterminate = (checkedCount > 0 && !isAllChecked) || indeterminateCount > 0;

    const nextChecked = isAllChecked;
    const nextIndeterminate = isIndeterminate;

    if (parent.checked !== nextChecked || parent.indeterminate !== nextIndeterminate) {
      map[parentId] = {
        ...parent,
        checked: nextChecked,
        indeterminate: nextIndeterminate,
      };
      updateParentSelection(map, parent.parent_id);
    }
  };

  // Recursively load and index all children for a folder
  const loadAllChildrenRecursively = async (
    nodeId: number,
    currentMap: Record<number, TreeNode>
  ): Promise<number[]> => {
    const entries = await invoke<FileEntry[]>('get_children', { parentId: nodeId });
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
  };

  // Toggle checkbox
  const toggleCheck = useCallback(async (nodeId: number, checked: boolean) => {
    const newMap = { ...nodesMap };
    const node = newMap[nodeId];
    if (!node) return;

    // If it's a directory and we're checking it, load all children first if not loaded
    if (node.is_dir && checked && (!node.childIds || node.childIds.length === 0)) {
      const childIds = await loadAllChildrenRecursively(nodeId, newMap);
      newMap[nodeId] = { ...node, checked, indeterminate: false, childIds, expanded: true };
    } else {
      updateAllChildrenInMap(newMap, nodeId, checked);
    }

    updateParentSelection(newMap, node.parent_id);
    setNodesMap(newMap);

    // Notify parent of selection change
    if (onSelectionChange) {
      const selected = collectSelectedInMap(newMap, rootIds);
      onSelectionChange(selected.paths, selected.ids);
    }
  }, [nodesMap, rootIds, onSelectionChange]);

  const updateAllChildrenInMap = (map: Record<number, TreeNode>, nodeId: number, checked: boolean) => {
    const node = map[nodeId];
    if (!node) return;

    map[nodeId] = { ...node, checked, indeterminate: false };
    if (node.childIds) {
      node.childIds.forEach(id => updateAllChildrenInMap(map, id, checked));
    }
  };

  const collectSelectedInMap = (map: Record<number, TreeNode>, ids: number[]): { paths: string[], ids: number[] } => {
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
  };

  // Handle path copy to clipboard
  const copyPathToClipboard = (path: string) => {
    navigator.clipboard.writeText(path).then(() => {
      setToast('Path copied!');
      setTimeout(() => setToast(null), 2000);
    });
  };

  // Handle drag and drop (React events - just for visual feedback)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Listen to refresh events (from global drag-drop or other sources)
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupRefreshListener = async () => {
      unlisten = await listen('refresh-file-tree', () => {
        console.log('Refreshing file tree...');
        loadRootEntries();
      });
    };

    setupRefreshListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [loadRootEntries]);

  // Handle indexing-progress to refresh when complete
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupProgressListener = async () => {
      unlisten = await listen('indexing-progress', (event: any) => {
        if (event.payload.current_path === 'Complete') {
          loadRootEntries();
        }
      });
    };

    setupProgressListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [loadRootEntries]);

  // Restore selected state from initialSelectedPaths
  useEffect(() => {
    if (initialSelectedPaths && initialSelectedPaths.length > 0 && rootIds.length > 0) {
      const newMap = { ...nodesMap };
      const pathsSet = new Set(initialSelectedPaths);

      Object.values(newMap).forEach(node => {
        if (!node.is_dir && pathsSet.has(node.path)) {
          newMap[node.id] = { ...node, checked: true };
          updateParentSelection(newMap, node.parent_id);
        }
      });

      setNodesMap(newMap);
    }
  }, [initialSelectedPaths, rootIds.length]);

  // Clear all selections when signaled
  useEffect(() => {
    if (shouldClearSelection) {
      const newMap = { ...nodesMap };

      Object.keys(newMap).forEach(id => {
        const node = newMap[Number(id)];
        if (node) {
          newMap[Number(id)] = { ...node, checked: false, indeterminate: false };
        }
      });

      setNodesMap(newMap);

      if (onSelectionChange) {
        onSelectionChange([], []);
      }
    }
  }, [shouldClearSelection, onSelectionChange]);

  // Load root entries on mount
  useEffect(() => {
    loadRootEntries();
  }, [loadRootEntries]);

  return (
    <div className="flex flex-col h-full w-full bg-[#0d1117] text-[#c9d1d9] overflow-hidden" data-testid="file-tree-container">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600/90 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50 animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Filter Bar */}
      <div className="h-8 flex items-center px-2 justify-between border-b border-border-dark bg-[#0d1117]">
        <div className="flex items-center gap-1">
          {(['ALL', 'SRC', 'DOCS'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                filterType === t
                  ? "bg-primary/20 text-primary"
                  : "text-white/40 hover:bg-white/5"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-0.5 text-[9px] font-medium text-white/50 hover:text-white">
            <span>Name</span>
            <span className="material-symbols-outlined text-[12px]">arrow_drop_down</span>
          </button>
          <button className="flex items-center gap-0.5 text-[9px] font-medium text-white/50 hover:text-white">
            <span>Size</span>
            <span className="material-symbols-outlined text-[12px]">unfold_more</span>
          </button>
        </div>
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-auto relative custom-scrollbar"
        data-testid="file-tree-scroll"
        onDragOver={handleDragOver}
      >
        {flatTree.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-5 text-center select-none" data-testid="empty-state">
            {searchQuery ? 'No matching files found.' : 'No files indexed. Drag and drop a folder to start.'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const node = flatTree[virtualRow.index] as TreeNode & { level: number };
              const isFolder = node.is_dir;

              // Folder Row Style
              if (isFolder) {
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="flex items-center px-2 py-1 sticky z-10 w-full bg-[#161b22]/90 backdrop-blur-sm border-b border-border-dark"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingLeft: `${node.level * 12 + 8}px`
                    }}
                    onClick={() => toggleCheck(node.id, !node.checked)}
                    data-testid="tree-node"
                    data-node-type="folder"
                  >
                    <span
                      className={cn(
                        "material-symbols-outlined text-[14px] text-white/40 mr-1 cursor-pointer transition-transform select-none",
                        node.expanded && "rotate-90"
                      )}
                      data-testid="expand-icon"
                      data-expanded={node.expanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(node.id);
                      }}
                    >
                      chevron_right
                    </span>

                    <div className="w-5 flex justify-center mr-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="custom-checkbox appearance-none border border-border-dark checked:bg-primary checked:border-transparent relative after:content-[''] after:absolute after:inset-0 after:m-auto after:block after:w-1.5 after:h-1.5 after:rounded-[1px] checked:after:bg-white cursor-pointer size-2.5 rounded-sm bg-transparent text-primary focus:ring-0 focus:ring-offset-0 select-none"
                        checked={node.checked}
                        onChange={() => toggleCheck(node.id, !node.checked)}
                        ref={(el) => { if (el) el.indeterminate = node.indeterminate; }}
                        data-testid="tree-checkbox"
                      />
                    </div>

                    <span className="material-symbols-outlined text-[14px] text-yellow-600/70 mr-2 select-none" data-testid="tree-icon">folder</span>
                    <span className="text-[10px] font-medium text-white/70 flex-shrink-0" data-testid="tree-label">{node.name}</span>
                    <span className="text-[9px] text-white/30 ml-2 flex-1 whitespace-nowrap">
                      ({node.child_count ?? (node.childIds?.length || 0)} items)
                    </span>
                    <span
                      className="text-white/20 text-[9px] pr-2 ml-2 cursor-pointer hover:text-white/40 transition-colors select-none  min-w-0 truncate"
                      style={{ direction: 'rtl', textAlign: 'left' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyPathToClipboard(node.path);
                      }}
                    >
                      {node.path.substring(0, node.path.lastIndexOf('\\') !== -1 ? node.path.lastIndexOf('\\') : node.path.lastIndexOf('/'))}
                    </span>
                  </div>
                );
              }

              // File Row Style
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="flex items-center px-2 py-0.5 min-h-[22px] border-b border-border-dark/30 hover:bg-white/[0.02] transition-colors"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: `${node.level * 12 + 8}px`
                  }}
                  onClick={() => toggleCheck(node.id, !node.checked)}
                  data-testid="tree-node"
                  data-node-type="file"
                >
                  {/* Invisible spacer to align with folders that have expand arrow */}
                  <span className="material-symbols-outlined text-[14px] mr-1 invisible select-none">
                    chevron_right
                  </span>

                  <div className="w-5 flex justify-center mr-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="custom-checkbox appearance-none border border-border-dark checked:bg-primary checked:border-transparent relative after:content-[''] after:absolute after:inset-0 after:m-auto after:block after:w-1.5 after:h-1.5 after:rounded-[1px] checked:after:bg-white cursor-pointer size-2.5 rounded-sm bg-transparent text-primary focus:ring-0 focus:ring-offset-0 select-none"
                      checked={node.checked}
                      onChange={() => toggleCheck(node.id, !node.checked)}
                      ref={(el) => { if (el) el.indeterminate = node.indeterminate; }}
                      data-testid="tree-checkbox"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span
                      className={cn(
                        "material-symbols-outlined text-[13px] select-none flex-shrink-0",
                        getFileIconColor(node.name)
                      )}
                      data-testid="tree-icon"
                    >
                      {getFileIconName(node.path)}
                    </span>
                    <span className="text-white text-[11px] flex-1 shrink-0" data-testid="tree-label">{node.name}</span>
                    {/* Parent path display in gray - truncates from left showing end of path */}
                    <span
                      className="text-white/20 text-[9px] pr-2 cursor-pointer hover:text-white/40 transition-colors select-none min-w-0 truncate"
                      style={{ direction: 'rtl', textAlign: 'left' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyPathToClipboard(node.path);
                      }}
                    >
                      {node.path.substring(0, node.path.lastIndexOf('\\') !== -1 ? node.path.lastIndexOf('\\') : node.path.lastIndexOf('/'))}
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

function getFileIconName(path: string): string {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.ts': case '.tsx': return 'terminal';
    case '.js': case '.jsx': return 'javascript';
    case '.py': return 'code';
    case '.go': return 'description'; // or specific
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
