import { useState, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { invoke } from '@tauri-apps/api/core';
import { TreeNode, FileEntry } from '../../types';
import './FileTree.css';

interface FileTreeProps {
  onSelectionChange?: (selectedPaths: string[]) => void;
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

  // Toggle checkbox
  const toggleCheck = useCallback((path: string, checked: boolean) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.path === path) {
          // Update this node and all children
          const updateAllChildren = (n: TreeNode): TreeNode => ({
            ...n,
            checked,
            indeterminate: false,
            children: n.children?.map(updateAllChildren),
          });
          return updateAllChildren(node);
        } else if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };

    const updatedTree = updateParentStates(updateNode(treeData));
    setTreeData(updatedTree);
    
    // Notify parent of selection change
    if (onSelectionChange) {
      onSelectionChange(collectSelectedPaths(updatedTree));
    }
  }, [treeData, updateParentStates, collectSelectedPaths, onSelectionChange]);

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

  // Handle drag and drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Note: In a web/Tauri context, getting the actual folder path from drag-drop
    // is limited. We'll just show a message to use the button instead.
    alert('Please use the "Add Folder" button to select folders');
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

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
    <div className="file-tree-container">
      <div className="file-tree-controls">
        <input
          type="text"
          placeholder="Search files and folders..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
        />
        <button onClick={handleSelectFolder} className="add-folder-btn">
          Add Folder
        </button>
      </div>

      <div
        ref={parentRef}
        className="file-tree-scroll"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {flatTree.length === 0 ? (
          <div className="empty-state">
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
                    className="tree-node"
                    style={{ paddingLeft: `${node.level * 20}px` }}
                  >
                    {node.is_dir && (
                      <span
                        className={`expand-icon ${node.expanded ? 'expanded' : ''}`}
                        onClick={() => toggleExpand(node.path)}
                      >
                        ▶
                      </span>
                    )}
                    {!node.is_dir && <span className="expand-icon-placeholder" />}
                    
                    <input
                      type="checkbox"
                      checked={node.checked}
                      ref={(el) => {
                        if (el) el.indeterminate = node.indeterminate;
                      }}
                      onChange={(e) => toggleCheck(node.path, e.target.checked)}
                      className="tree-checkbox"
                    />
                    
                    <span className="tree-icon">{node.is_dir ? '📁' : '📄'}</span>
                    <span className="tree-label" title={node.path}>
                      {node.name}
                    </span>
                    
                    {!node.is_dir && node.size !== null && (
                      <span className="tree-size">
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
