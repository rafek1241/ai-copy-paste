import { useState, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TreeNode, FileEntry } from '../../types';
import { cn } from '@/lib/utils';

interface FileTreeProps {
  onSelectionChange?: (selectedPaths: string[]) => void;
  searchQuery?: string;
  initialSelectedPaths?: string[];
  shouldClearSelection?: boolean;
}

export const FileTree: React.FC<FileTreeProps> = ({ onSelectionChange, searchQuery = "", initialSelectedPaths, shouldClearSelection }) => {
  const [nodesMap, setNodesMap] = useState<Record<string, TreeNode>>({});
  const [rootPaths, setRootPaths] = useState<string[]>([]);
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

  const matchesFilter = useCallback((node: TreeNode): boolean => {
    // Search query matching
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      // Match filename or full path
      const matchesSearch = node.name.toLowerCase().includes(query) ||
        (node.path && node.path.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    if (filterType === 'ALL') return true;

    // For directories in filtered mode, we might want to keep them if they contain matching children
    // But for simple filtering:
    if (node.is_dir) return true;

    const ext = node.path.substring(node.path.lastIndexOf('.')).toLowerCase();
    if (filterType === 'SRC') return SRC_EXTENSIONS.includes(ext);
    if (filterType === 'DOCS') return DOCS_EXTENSIONS.includes(ext);
    return true;
  }, [filterType, searchQuery]);

  // Convert tree to flat list for virtual scrolling
  const buildFlatTree = useCallback((paths: string[], map: Record<string, TreeNode>, level = 0): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const path of paths) {
      const node = map[path];
      if (!node) continue;

      const isMatch = matchesFilter(node);

      // Skip non-matching files (but always process directories to maintain tree structure)
      if (!node.is_dir && !isMatch) continue;

      // Always add directories to maintain tree hierarchy
      // Add files only if they match the filter
      const nodeWithLevel = { ...node, level } as any;
      result.push(nodeWithLevel);

      // If expanded and has children, recursively add them
      if (node.expanded && node.childPaths) {
        result.push(...buildFlatTree(node.childPaths, map, level + 1));
      }
    }
    return result;
  }, [matchesFilter, searchQuery]);

  // Update flat tree when nodes map or root paths change
  useEffect(() => {
    setFlatTree(buildFlatTree(rootPaths, nodesMap));
  }, [nodesMap, rootPaths, buildFlatTree]);

  // Load root level entries
  const loadRootEntries = useCallback(async () => {
    try {
      const entries = await invoke<FileEntry[]>('get_children', { parentPath: null });

      // Filter out paths that are nested inside other root directory entries
      // This prevents showing files at root level when their parent directory is also indexed
      const filteredEntries = entries.filter(entry => {
        // Check if this entry's path is a subpath of any directory entry
        const isNested = entries.some(other =>
          other.is_dir &&
          other.path !== entry.path &&
          (entry.path.startsWith(other.path + '\\') || entry.path.startsWith(other.path + '/'))
        );
        return !isNested;
      });

      setNodesMap(prevNodesMap => {
        const newNodesMap: Record<string, TreeNode> = {};

        // First, copy over all existing nodes to preserve state for nodes not in the new entries
        // This preserves expanded children that were loaded previously
        Object.entries(prevNodesMap).forEach(([path, node]) => {
          newNodesMap[path] = node;
        });

        // Populate/update map with entries, preserving existing state where applicable
        entries.forEach(entry => {
          const existingNode = prevNodesMap[entry.path];
          if (existingNode) {
            // Preserve existing state (checked, expanded, indeterminate, childPaths)
            newNodesMap[entry.path] = {
              ...entry,
              expanded: existingNode.expanded,
              checked: existingNode.checked,
              indeterminate: existingNode.indeterminate,
              hasChildren: entry.is_dir,
              childPaths: existingNode.childPaths || [],
            };
          } else {
            // New entry - initialize with default state
            newNodesMap[entry.path] = {
              ...entry,
              expanded: false,
              checked: false,
              indeterminate: false,
              hasChildren: entry.is_dir,
              childPaths: [],
            };
          }
        });

        // Now handle parent-child relationships for nodes that were previously orphaned
        // Find selected/expanded nodes that should now be children of newly added directories
        filteredEntries.forEach(rootEntry => {
          if (rootEntry.is_dir) {
            const parentPath = rootEntry.path;
            const existingChildPaths = newNodesMap[parentPath]?.childPaths || [];
            const adoptedChildPaths: string[] = [];

            // Find nodes that should be children of this directory
            Object.values(newNodesMap).forEach(node => {
              if (node.path !== parentPath && node.parent_path === parentPath) {
                // This node is a direct child of the root entry
                if (!existingChildPaths.includes(node.path)) {
                  adoptedChildPaths.push(node.path);
                }
              }
            });

            // If we found children to adopt, update the parent's childPaths and expand it
            if (adoptedChildPaths.length > 0) {
              const allChildPaths = [...new Set([...existingChildPaths, ...adoptedChildPaths])];
              const hasSelectedChildren = allChildPaths.some(cp => {
                const child = newNodesMap[cp];
                return child && (child.checked || child.indeterminate);
              });

              newNodesMap[parentPath] = {
                ...newNodesMap[parentPath],
                childPaths: allChildPaths,
                // Auto-expand if there are selected children inside
                expanded: newNodesMap[parentPath].expanded || hasSelectedChildren,
              };

              // Update parent's checked/indeterminate state based on children
              updateParentSelectionInMap(newNodesMap, parentPath);
            }
          }
        });

        return newNodesMap;
      });

      setRootPaths(filteredEntries.map(entry => entry.path));
    } catch (error) {
      console.error('Failed to load root entries:', error);
    }
  }, []);

  // Load children for a node, preserving existing state
  const loadChildren = useCallback(async (nodePath: string, existingMap: Record<string, TreeNode>): Promise<TreeNode[]> => {
    try {
      const entries = await invoke<FileEntry[]>('get_children', { parentPath: nodePath });
      return entries.map(entry => {
        const existingNode = existingMap[entry.path];
        if (existingNode) {
          // Preserve existing state
          return {
            ...entry,
            expanded: existingNode.expanded,
            checked: existingNode.checked,
            indeterminate: existingNode.indeterminate,
            hasChildren: entry.is_dir,
            childPaths: existingNode.childPaths || [],
          };
        }
        return {
          ...entry,
          expanded: false,
          checked: false,
          indeterminate: false,
          hasChildren: entry.is_dir,
          childPaths: [],
        };
      });
    } catch (error) {
      console.error('Failed to load children:', error);
      return [];
    }
  }, []);

  // Toggle node expansion
  const toggleExpand = useCallback(async (nodePath: string) => {
    const node = nodesMap[nodePath];
    if (!node || !node.is_dir) return;

    if (!node.expanded && (!node.childPaths || node.childPaths.length === 0)) {
      const children = await loadChildren(nodePath, nodesMap);
      const newNodesMap = { ...nodesMap };
      const childPaths = children.map(c => c.path);

      // Also find orphaned entries that should belong to this directory
      // These are files indexed before their parent directory was added
      const parentPath = node.path;
      const orphanedChildren: TreeNode[] = [];

      Object.values(nodesMap).forEach(existingNode => {
        // Check if this node should be a direct child of current node
        if (existingNode.path !== nodePath) {
          const existingPath = existingNode.path;
          // Check if path starts with parent path + separator
          if (existingPath.startsWith(parentPath + '\\') || existingPath.startsWith(parentPath + '/')) {
            // Check if it's a direct child (no additional separators after parent path)
            const relativePath = existingPath.substring(parentPath.length + 1);
            if (!relativePath.includes('\\') && !relativePath.includes('/')) {
              // This is a direct child - only adopt if not already in children
              if (!childPaths.includes(existingPath)) {
                orphanedChildren.push({
                  ...existingNode,
                  parent_path: nodePath, // Update parent reference
                });
              }
            }
          }
        }
      });

      // Merge children from backend with orphaned children (avoid duplicates)
      const allChildPaths = [...new Set([...childPaths, ...orphanedChildren.map(c => c.path)])];

      // Add children to map (preserving existing state)
      children.forEach(child => {
        // Only add if not already in map with state
        if (!newNodesMap[child.path] || !newNodesMap[child.path].checked) {
          newNodesMap[child.path] = child;
        }
      });

      // Update orphaned children with new parent_path
      orphanedChildren.forEach(child => {
        newNodesMap[child.path] = child;
      });

      // Check if any children are selected - update parent's indeterminate state
      const childNodes = allChildPaths.map(p => newNodesMap[p]).filter(Boolean);
      const checkedCount = childNodes.filter(c => c.checked).length;
      const indeterminateCount = childNodes.filter(c => c.indeterminate).length;
      const isAllChecked = checkedCount === childNodes.length && childNodes.length > 0;
      const isIndeterminate = (checkedCount > 0 && !isAllChecked) || indeterminateCount > 0;

      // Update parent with correct selection state
      newNodesMap[nodePath] = {
        ...node,
        expanded: true,
        childPaths: allChildPaths,
        checked: isAllChecked,
        indeterminate: isIndeterminate,
      };

      setNodesMap(newNodesMap);
    } else {
      setNodesMap({
        ...nodesMap,
        [nodePath]: { ...node, expanded: !node.expanded }
      });
    }
  }, [nodesMap, loadChildren]);

  // Recursively update children selection
  const updateChildrenSelection = (
    map: Record<string, TreeNode>,
    nodePath: string,
    checked: boolean
  ) => {
    const node = map[nodePath];
    if (!node) return;

    map[nodePath] = {
      ...node,
      checked,
      indeterminate: false,
    };

    if (node.childPaths) {
      node.childPaths.forEach(childPath => {
        updateChildrenSelection(map, childPath, checked);
      });
    }
  };

  // Update parent selection states up the tree
  const updateParentSelection = (map: Record<string, TreeNode>, parentPath: string | null) => {
    if (parentPath === null) return;

    const parent = map[parentPath];
    if (!parent || !parent.childPaths) return;

    const children = parent.childPaths.map(path => map[path]).filter(Boolean);
    const checkedCount = children.filter(c => c.checked).length;
    const indeterminateCount = children.filter(c => c.indeterminate).length;

    const isAllChecked = checkedCount === children.length && children.length > 0;
    const isIndeterminate = (checkedCount > 0 && !isAllChecked) || indeterminateCount > 0;

    const nextChecked = isAllChecked;
    const nextIndeterminate = isIndeterminate;

    if (parent.checked !== nextChecked || parent.indeterminate !== nextIndeterminate) {
      map[parentPath] = {
        ...parent,
        checked: nextChecked,
        indeterminate: nextIndeterminate,
      };
      updateParentSelection(map, parent.parent_path);
    }
  };

  // Recursively load and index all children for a folder
  // When setChecked is true, all new entries are marked as checked
  // When setChecked is false, we preserve existing state or default to unchecked
  const loadAllChildrenRecursively = async (
    nodePath: string,
    currentMap: Record<string, TreeNode>,
    setChecked: boolean = true
  ): Promise<string[]> => {
    const entries = await invoke<FileEntry[]>('get_children', { parentPath: nodePath });
    const childPaths: string[] = [];

    for (const entry of entries) {
      childPaths.push(entry.path);
      let entryChildPaths: string[] = [];
      if (entry.is_dir) {
        entryChildPaths = await loadAllChildrenRecursively(entry.path, currentMap, setChecked);
      }

      const existingNode = currentMap[entry.path];
      if (existingNode) {
        // Preserve existing state, but merge childPaths
        currentMap[entry.path] = {
          ...entry,
          expanded: existingNode.expanded,
          checked: setChecked ? true : existingNode.checked,
          indeterminate: setChecked ? false : existingNode.indeterminate,
          hasChildren: entry.is_dir,
          childPaths: entryChildPaths.length > 0 ? entryChildPaths : existingNode.childPaths || [],
        };
      } else {
        currentMap[entry.path] = {
          ...entry,
          expanded: false,
          checked: setChecked,
          indeterminate: false,
          hasChildren: entry.is_dir,
          childPaths: entryChildPaths,
        };
      }
    }
    return childPaths;
  };

  // Toggle checkbox
  const toggleCheck = useCallback(async (nodePath: string, checked: boolean) => {
    const newMap = { ...nodesMap };
    const node = newMap[nodePath];
    if (!node) return;

    // If it's a directory and we're checking it, load all children first if not loaded
    if (node.is_dir && checked && (!node.childPaths || node.childPaths.length === 0)) {
      const childPaths = await loadAllChildrenRecursively(nodePath, newMap);
      newMap[nodePath] = { ...node, checked, indeterminate: false, childPaths, expanded: true };
    } else {
      updateAllChildrenInMap(newMap, nodePath, checked);
    }

    updateParentSelection(newMap, node.parent_path);
    setNodesMap(newMap);

    // Notify parent of selection change
    if (onSelectionChange) {
      const selected = collectSelectedInMap(newMap, rootPaths);
      onSelectionChange(selected);
    }
  }, [nodesMap, rootPaths, onSelectionChange]);

  const updateAllChildrenInMap = (map: Record<string, TreeNode>, nodePath: string, checked: boolean) => {
    const node = map[nodePath];
    if (!node) return;

    map[nodePath] = { ...node, checked, indeterminate: false };
    if (node.childPaths) {
      node.childPaths.forEach(path => updateAllChildrenInMap(map, path, checked));
    }
  };

  const collectSelectedInMap = (map: Record<string, TreeNode>, paths: string[]): string[] => {
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
  };

  // Update a node's selection state based on its children (used in loadRootEntries)
  const updateParentSelectionInMap = (map: Record<string, TreeNode>, nodePath: string) => {
    const node = map[nodePath];
    if (!node || !node.childPaths || node.childPaths.length === 0) return;

    const children = node.childPaths.map(path => map[path]).filter(Boolean);
    if (children.length === 0) return;

    const checkedCount = children.filter(c => c.checked).length;
    const indeterminateCount = children.filter(c => c.indeterminate).length;

    const isAllChecked = checkedCount === children.length;
    const isIndeterminate = (checkedCount > 0 && !isAllChecked) || indeterminateCount > 0;

    map[nodePath] = {
      ...node,
      checked: isAllChecked,
      indeterminate: isIndeterminate,
    };
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
    if (initialSelectedPaths && initialSelectedPaths.length > 0 && rootPaths.length > 0) {
      const newMap = { ...nodesMap };
      const pathsSet = new Set(initialSelectedPaths);

      Object.values(newMap).forEach(node => {
        if (!node.is_dir && pathsSet.has(node.path)) {
          newMap[node.path] = { ...node, checked: true };
          updateParentSelection(newMap, node.parent_path);
        }
      });

      setNodesMap(newMap);
    }
  }, [initialSelectedPaths, rootPaths.length]);

  // Clear all selections when signaled
  useEffect(() => {
    if (shouldClearSelection) {
      const newMap = { ...nodesMap };

      Object.keys(newMap).forEach(path => {
        const node = newMap[path];
        if (node) {
          newMap[path] = { ...node, checked: false, indeterminate: false };
        }
      });

      setNodesMap(newMap);

      if (onSelectionChange) {
        onSelectionChange([]);
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
                      paddingLeft: `${node.level * 12 + 8}px`
                    }}
                    onClick={() => toggleCheck(node.path, !node.checked)}
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
                        toggleExpand(node.path);
                      }}
                    >
                      chevron_right
                    </span>

                    <div className="w-5 flex justify-center mr-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="custom-checkbox appearance-none border border-border-dark checked:bg-primary checked:border-transparent relative after:content-[''] after:absolute after:inset-0 after:m-auto after:block after:w-1.5 after:h-1.5 after:rounded-[1px] checked:after:bg-white cursor-pointer size-2.5 rounded-sm bg-transparent text-primary focus:ring-0 focus:ring-offset-0 select-none"
                        checked={node.checked}
                        onChange={() => toggleCheck(node.path, !node.checked)}
                        ref={(el) => { if (el) el.indeterminate = node.indeterminate; }}
                        data-testid="tree-checkbox"
                      />
                    </div>

                    <span className="material-symbols-outlined text-[14px] text-yellow-600/70 mr-2 select-none" data-testid="tree-icon">folder</span>
                    <span className="text-[10px] font-medium text-white/70 flex-shrink-0" data-testid="tree-label">{node.name}</span>
                    <span className="text-[9px] text-white/30 ml-2 flex-1 whitespace-nowrap">
                      ({node.child_count ?? (node.childPaths?.length || 0)} items)
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
                    paddingLeft: `${node.level * 12 + 8}px`
                  }}
                  onClick={() => toggleCheck(node.path, !node.checked)}
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
                      onChange={() => toggleCheck(node.path, !node.checked)}
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
