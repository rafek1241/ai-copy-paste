import { useState, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TreeNode, FileEntry } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

interface FileTreeProps {
  onSelectionChange?: (selectedPaths: string[], selectedIds: number[]) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ onSelectionChange }) => {
  const [nodesMap, setNodesMap] = useState<Record<number, TreeNode>>({});
  const [rootIds, setRootIds] = useState<number[]>([]);
  const [flatTree, setFlatTree] = useState<TreeNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: flatTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  // Convert tree to flat list for virtual scrolling
  const buildFlatTree = useCallback((ids: number[], map: Record<number, TreeNode>, level = 0): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const id of ids) {
      const node = map[id];
      if (!node) continue;
      
      const nodeWithLevel = { ...node, level } as any;
      result.push(nodeWithLevel);
      
      if (node.expanded && node.childIds) {
        result.push(...buildFlatTree(node.childIds, map, level + 1));
      }
    }
    return result;
  }, []);

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

  // Handle folder indexing
  const handleIndexFolder = useCallback(async (folderPath: string) => {
    try {
      const count = await invoke<number>('index_folder', { path: folderPath });
      console.log(`Indexed ${count} entries from ${folderPath}`);
      await loadRootEntries();
    } catch (error) {
      console.error('Failed to index folder:', error);
      alert(`Failed to index folder: ${error}`);
    }
  }, [loadRootEntries]);

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

  // Handle search with debouncing
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setIsSearching(false);
      loadRootEntries();
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await invoke<FileEntry[]>('search_path', { pattern: query });
        const newNodesMap: Record<number, TreeNode> = {};
        const newRootIds: number[] = [];

        results.forEach(entry => {
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
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 150);
  }, [loadRootEntries]);

  // Select folder using Tauri dialog
  const handleSelectFolder = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected) {
        await invoke('index_folder', { path: selected as string });
        await loadRootEntries();
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  }, [loadRootEntries]);

  // Load root entries on mount
  useEffect(() => {
    loadRootEntries();
  }, [loadRootEntries]);

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground" data-testid="file-tree-container">
      <div className="flex gap-2.5 p-2.5 bg-secondary border-b border-border" data-testid="file-tree-controls">
        <Input
          type="text"
          placeholder="Search files and folders..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1"
          data-testid="file-tree-search"
        />
        <Button onClick={handleSelectFolder} data-testid="add-folder-btn">
          Add Folder
        </Button>
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-auto relative"
        data-testid="file-tree-scroll"
        onDragOver={handleDragOver}
      >
        {flatTree.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-5 text-center" data-testid="empty-state">
            {isSearching ? 'Searching...' : 'No files indexed. Click "Add Folder" or drag and drop a folder to start.'}
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
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none h-7 transition-colors hover:bg-accent"
                    data-testid="tree-node"
                    data-path={node.path}
                    style={{ paddingLeft: `${node.level * 20 + 8}px` }}
                  >
                    {node.is_dir && (
                      <span
                        className={cn(
                          "inline-block w-4 h-4 text-center cursor-pointer text-[10px] transition-transform text-foreground/75",
                          node.expanded && "rotate-90"
                        )}
                        data-testid="expand-icon"
                        onClick={() => toggleExpand(node.id)}
                      >
                        ▶
                      </span>
                    )}
                    {!node.is_dir && <span className="inline-block w-4" />}

                    <input
                      type="checkbox"
                      checked={node.checked}
                      ref={(el) => {
                        if (el) el.indeterminate = node.indeterminate;
                      }}
                      onChange={(e) => toggleCheck(node.id, e.target.checked)}
                      className="cursor-pointer w-4 h-4 m-0"
                      data-testid="tree-checkbox"
                    />

                    <span className="text-base leading-4" data-testid="tree-icon">{node.is_dir ? '📁' : '📄'}</span>
                    <span className="flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap" data-testid="tree-label" title={node.path}>
                      {node.name}
                    </span>

                    {!node.is_dir && node.size !== null && (
                      <span className="text-[11px] text-muted-foreground ml-auto pr-2" data-testid="tree-size">
                        {formatFileSize(node.size)}
                      </span>
                    )}
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
