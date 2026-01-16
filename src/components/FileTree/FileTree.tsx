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
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
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
  const flattenTree = useCallback((nodes: TreeNode[], level = 0): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const node of nodes) {
      result.push({ ...node, level } as any);
      if (node.expanded && node.children) {
        result.push(...flattenTree(node.children, level + 1));
      }
    }
    return result;
  }, []);

  // Update flat tree when tree data changes
  useEffect(() => {
    setFlatTree(flattenTree(treeData));
  }, [treeData, flattenTree]);

  // Load root level entries
  const loadRootEntries = useCallback(async () => {
    try {
      const entries = await invoke<FileEntry[]>('get_children', { parentId: null });
      const nodes: TreeNode[] = entries.map(entry => ({
        ...entry,
        expanded: false,
        checked: false,
        indeterminate: false,
        hasChildren: entry.is_dir,
      }));
      setTreeData(nodes);
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
      }));
    } catch (error) {
      console.error('Failed to load children:', error);
      return [];
    }
  }, []);

  // Toggle node expansion
  const toggleExpand = useCallback(async (path: string) => {
    const updateNode = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
      return Promise.all(nodes.map(async node => {
        if (node.path === path) {
          if (!node.expanded && node.is_dir) {
            // Load children if not already loaded
            const children = node.children || await loadChildren(node.id);
            return { ...node, expanded: true, children };
          } else {
            return { ...node, expanded: !node.expanded };
          }
        } else if (node.children) {
          return { ...node, children: await updateNode(node.children) };
        }
        return node;
      }));
    };

    setTreeData(await updateNode(treeData));
  }, [treeData, loadChildren]);

  // Collect all selected paths
  const collectSelectedPaths = useCallback((nodes: TreeNode[]): string[] => {
    const paths: string[] = [];
    for (const node of nodes) {
      if (node.checked && !node.is_dir) {
        paths.push(node.path);
      }
      if (node.children) {
        paths.push(...collectSelectedPaths(node.children));
      }
    }
    return paths;
  }, []);

  // Collect all selected file IDs
  const collectSelectedIds = useCallback((nodes: TreeNode[]): number[] => {
    const ids: number[] = [];
    for (const node of nodes) {
      if (node.checked && !node.is_dir) {
        ids.push(node.id);
      }
      if (node.children) {
        ids.push(...collectSelectedIds(node.children));
      }
    }
    return ids;
  }, []);

  // Update parent checkbox states
  const updateParentStates = useCallback((nodes: TreeNode[]): TreeNode[] => {
    return nodes.map(node => {
      if (node.children && node.children.length > 0) {
        const updatedChildren = updateParentStates(node.children);
        const checkedCount = updatedChildren.filter(c => c.checked).length;
        const indeterminateCount = updatedChildren.filter(c => c.indeterminate).length;

        return {
          ...node,
          children: updatedChildren,
          checked: checkedCount === updatedChildren.length && checkedCount > 0,
          indeterminate: (checkedCount > 0 && checkedCount < updatedChildren.length) || indeterminateCount > 0,
        };
      }
      return node;
    });
  }, []);

  // Recursively load all children for a folder
  const loadAllChildrenRecursively = useCallback(async (nodeId: number): Promise<TreeNode[]> => {
    const children = await loadChildren(nodeId);
    const childrenWithSubChildren = await Promise.all(
      children.map(async (child) => {
        if (child.is_dir) {
          const subChildren = await loadAllChildrenRecursively(child.id);
          return { ...child, children: subChildren };
        }
        return child;
      })
    );
    return childrenWithSubChildren;
  }, [loadChildren]);

  // Toggle checkbox
  const toggleCheck = useCallback(async (path: string, checked: boolean) => {
    // Helper to update a node and all its children
    const updateAllChildren = (n: TreeNode, isChecked: boolean): TreeNode => ({
      ...n,
      checked: isChecked,
      indeterminate: false,
      children: n.children?.map(child => updateAllChildren(child, isChecked)),
    });

    // Update function that loads children if needed
    const updateNode = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
      return Promise.all(nodes.map(async node => {
        if (node.path === path) {
          // If it's a directory and we're checking it, load all children first
          if (node.is_dir && checked && !node.children) {
            const children = await loadAllChildrenRecursively(node.id);
            return updateAllChildren({ ...node, children, expanded: true }, checked);
          }
          return updateAllChildren(node, checked);
        } else if (node.children) {
          return { ...node, children: await updateNode(node.children) };
        }
        return node;
      }));
    };

    const updatedNodes = await updateNode(treeData);
    const updatedTree = updateParentStates(updatedNodes);
    setTreeData(updatedTree);

    // Notify parent of selection change
    if (onSelectionChange) {
      onSelectionChange(collectSelectedPaths(updatedTree), collectSelectedIds(updatedTree));
    }
  }, [treeData, updateParentStates, collectSelectedPaths, collectSelectedIds, onSelectionChange, loadAllChildrenRecursively]);

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

  // Listen to Tauri's native drag-drop events
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupDragDrop = async () => {
      unlisten = await listen<DragDropPayload>('tauri://drag-drop', async (event) => {
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          // Index all dropped paths (folders will be indexed, files will show the parent folder)
          for (const path of paths) {
            try {
              await handleIndexFolder(path);
            } catch (error) {
              console.error(`Failed to index dropped path ${path}:`, error);
            }
          }
        }
      });
    };

    setupDragDrop();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleIndexFolder]);

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
        const nodes: TreeNode[] = results.map(entry => ({
          ...entry,
          expanded: false,
          checked: false,
          indeterminate: false,
          hasChildren: entry.is_dir,
        }));
        setTreeData(nodes);
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
        await handleIndexFolder(selected as string);
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  }, [handleIndexFolder]);

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
                        onClick={() => toggleExpand(node.path)}
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
                      onChange={(e) => toggleCheck(node.path, e.target.checked)}
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
