import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTree } from '@/components/FileTree/FileTree';
import { vi, expect, it, describe, beforeEach, afterEach } from 'vitest';
import { mockInvoke, mockEmit } from '../../setup';

// Mock virtualizer to just render everything
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: any) => ({
    getVirtualItems: () => Array.from({ length: options.count }, (_, i) => ({
      index: i,
      key: i,
      start: i * 28,
      size: 28,
    })),
    getTotalSize: () => options.count * 28,
    measureElement: () => {},
  }),
}));

/**
 * FileTree State Preservation Tests
 *
 * Tests that selection and expansion states are preserved
 * when adding new content, refreshing, etc.
 */
describe('FileTree State Preservation', () => {
  let mockNodes: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNodes = [];
  });

  afterEach(() => {
    cleanup();
  });

  describe('Selection state preservation', () => {
    beforeEach(() => {
      mockNodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 2 },
        { path: '/mydir/file1.ts', parent_path: '/mydir', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/mydir/file2.ts', parent_path: '/mydir', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          const result = mockNodes.filter(n => n.parent_path === args.parentPath);
          return Promise.resolve(result);
        }
        return Promise.resolve([]);
      });
    });

    it('should preserve selection when new files are added', async () => {
      const { rerender } = render(<FileTree />);

      await screen.findByText('mydir');

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await screen.findByText('file1.ts');

      // Select file1.ts
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]); // file1.ts checkbox

      await waitFor(() => {
        expect(checkboxes[1]).toBeChecked();
      });

      // Add a new file to mockNodes
      mockNodes.push({
        path: '/mydir/file3.ts',
        parent_path: '/mydir',
        name: 'file3.ts',
        is_dir: false,
        size: 300,
        mtime: 125,
        token_count: null,
        fingerprint: 'fp3',
        child_count: null,
      });

      // Re-render (simulate refresh)
      rerender(<FileTree />);

      // file1.ts should still be checked
      await waitFor(() => {
        const newCheckboxes = screen.getAllByTestId('tree-checkbox');
        expect(newCheckboxes[1]).toBeChecked();
      });
    });

    it('should preserve selection state when folder is collapsed and re-expanded', async () => {
      render(<FileTree />);

      await screen.findByText('mydir');

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await screen.findByText('file1.ts');

      // Select file1.ts
      let checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(checkboxes[1]).toBeChecked();
      });

      // Collapse folder
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
      });

      // Re-expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
      });

      // Check that file1.ts is still selected
      checkboxes = screen.getAllByTestId('tree-checkbox');
      expect(checkboxes[1]).toBeChecked();
    });

    it('should preserve multiple selections', async () => {
      render(<FileTree />);

      await screen.findByText('mydir');

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await screen.findByText('file1.ts');
      await screen.findByText('file2.ts');

      // Select both files
      fireEvent.click(screen.getByLabelText('Select file1.ts'));
      await waitFor(() => {
        expect(screen.getByLabelText('Select file1.ts')).toBeChecked();
      });
      fireEvent.click(screen.getByLabelText('Select file2.ts'));

      await waitFor(() => {
        expect(screen.getByLabelText('Select file1.ts')).toBeChecked();
        expect(screen.getByLabelText('Select file2.ts')).toBeChecked();
      });

      // Collapse and re-expand
      fireEvent.click(screen.getByTestId('expand-icon'));
      await waitFor(() => {
        expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.getByLabelText('Select file1.ts')).toBeChecked();
        expect(screen.getByLabelText('Select file2.ts')).toBeChecked();
      });
    });
  });

  describe('Expansion state preservation', () => {
    beforeEach(() => {
      mockNodes = [
        { path: '/root', parent_path: null, name: 'root', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/root/child', parent_path: '/root', name: 'child', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/root/child/file.ts', parent_path: '/root/child', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        console.error(`mockInvoke (Clear selection): ${cmd}`, JSON.stringify(args));
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          const result = mockNodes.filter(n => n.parent_path === args.parentPath);
          console.error(`mockInvoke result for ${args.parentPath}:`, result);
          return Promise.resolve(result);
        }
        return Promise.resolve([]);
      });
    });

    it('should preserve expansion state when content is refreshed', async () => {
      const { rerender } = render(<FileTree />);

      await screen.findByText('root');

      // Expand root and child
      let expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[0]); // expand root
      await screen.findByText('child');

      expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[1]); // expand child
      await screen.findByText('file.ts');

      // Verify expanded state
      expandIcons = screen.getAllByTestId('expand-icon');
      expect(expandIcons[0]).toHaveAttribute('data-expanded', 'true');
      expect(expandIcons[1]).toHaveAttribute('data-expanded', 'true');

      // Re-render
      rerender(<FileTree />);

      // Expanded state should be preserved
      await waitFor(() => {
        const newExpandIcons = screen.getAllByTestId('expand-icon');
        expect(newExpandIcons[0]).toHaveAttribute('data-expanded', 'true');
        expect(newExpandIcons[1]).toHaveAttribute('data-expanded', 'true');
        expect(screen.getByText('file.ts')).toBeInTheDocument();
      });
    });

    it('should maintain nested expansion hierarchy', async () => {
      // Create deeper hierarchy
      mockNodes = [
        { path: '/a', parent_path: null, name: 'a', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/a/b', parent_path: '/a', name: 'b', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/a/b/c', parent_path: '/a/b', name: 'c', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/a/b/c/file.ts', parent_path: '/a/b/c', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      // Expand all levels
      await screen.findByText('a');
      fireEvent.click(screen.getAllByTestId('expand-icon')[0]);

      await screen.findByText('b');
      fireEvent.click(screen.getAllByTestId('expand-icon')[1]);

      await screen.findByText('c');
      fireEvent.click(screen.getAllByTestId('expand-icon')[2]);

      await screen.findByText('file.ts');

      // Collapse 'b'
      const expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[1]);

      await waitFor(() => {
        expect(screen.queryByText('c')).not.toBeInTheDocument();
        expect(screen.queryByText('file.ts')).not.toBeInTheDocument();
      });

      // Re-expand 'b'
      const newExpandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(newExpandIcons[1]);

      // 'c' should reappear, and since it was expanded, 'file.ts' should also show
      await waitFor(() => {
        expect(screen.getByText('c')).toBeInTheDocument();
        expect(screen.getByText('file.ts')).toBeInTheDocument();
      });
    });
  });

  describe('Combined state preservation', () => {
    // Note: Tests for dynamic re-indexing scenarios (adding parent directories
    // after files are indexed, etc.) are covered in E2E tests as they require
    // the full application lifecycle with Tauri events.

    it('should preserve selection across folder collapse/expand', async () => {
      mockNodes = [
        { path: '/project/src', parent_path: null, name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 2 },
        { path: '/project/src/file1.ts', parent_path: '/project/src', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/project/src/file2.ts', parent_path: '/project/src', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('src');

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await screen.findByText('file1.ts');

      // Select file1.ts
      let checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(checkboxes[1]).toBeChecked();
      });

      // Collapse folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await waitFor(() => {
        expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
      });

      // Re-expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
        checkboxes = screen.getAllByTestId('tree-checkbox');
        expect(checkboxes[1]).toBeChecked(); // Selection preserved
      });
    });
  });

  describe('Indeterminate state preservation', () => {
    beforeEach(() => {
      mockNodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 2 },
        { path: '/mydir/file1.ts', parent_path: '/mydir', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/mydir/file2.ts', parent_path: '/mydir', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });
    });

    it('should preserve indeterminate state after collapse/expand', async () => {
      render(<FileTree />);

      await screen.findByText('mydir');

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await screen.findByText('file1.ts');

      // Select only file1.ts (folder should become indeterminate)
      let checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]); // file1.ts

      await waitFor(() => {
        expect(checkboxes[1]).toBeChecked();
        expect((checkboxes[0] as HTMLInputElement).indeterminate).toBe(true);
      });

      // Collapse folder
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
      });

      // Folder should still be indeterminate
      checkboxes = screen.getAllByTestId('tree-checkbox');
      expect((checkboxes[0] as HTMLInputElement).indeterminate).toBe(true);

      // Re-expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        checkboxes = screen.getAllByTestId('tree-checkbox');
        expect(checkboxes[1]).toBeChecked();
        expect((checkboxes[0] as HTMLInputElement).indeterminate).toBe(true);
      });
    });
  });

  describe('Clear selection', () => {
    it('should clear all selections when shouldClearSelection is true', async () => {
      mockNodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/mydir/file.ts', parent_path: '/mydir', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          const result = mockNodes.filter(n => n.parent_path === args.parentPath);
          return Promise.resolve(result);
        }
        return Promise.resolve([]);
      });

      const { rerender } = render(<FileTree shouldClearSelection={false} />);

      await screen.findByText('mydir');

      // Expand and select
      const expandButton = screen.getByTestId('expand-icon');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_children', { parentPath: '/mydir' });
      });

      // Wait for expansion state to reflect in DOM
      await waitFor(() => {
        const folderNode = screen.getAllByTestId('tree-node')[0];
        expect(folderNode).toHaveAttribute('aria-expanded', 'true');
      }, { timeout: 3000 });

      await screen.findByText('file.ts', {}, { timeout: 3000 });

      const checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(checkboxes[1]).toBeChecked();
      });

      // Trigger clear
      rerender(<FileTree shouldClearSelection={true} />);

      await waitFor(() => {
        const newCheckboxes = screen.getAllByTestId('tree-checkbox');
        newCheckboxes.forEach(cb => {
          expect(cb).not.toBeChecked();
        });
      });
    });
  });

  describe('Initial selected paths', () => {
    // Note: initialSelectedPaths only applies to nodes already loaded in the nodesMap.
    // With lazy loading, children aren't selected until the folder is expanded and nodes are loaded.
    // Full restoration of selection state across app reloads is tested in E2E tests.

    it('should restore selection for root-level files from initialSelectedPaths', async () => {
      // Test with root-level file that's loaded immediately
      mockNodes = [
        { path: '/file1.ts', parent_path: null, name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/file2.ts', parent_path: null, name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree initialSelectedPaths={['/file1.ts']} />);

      await screen.findByText('file1.ts');
      await screen.findByText('file2.ts');

      // Give time for the useEffect to process initialSelectedPaths
      await waitFor(() => {
        const checkboxes = screen.getAllByTestId('tree-checkbox');
        expect(checkboxes[0]).toBeChecked(); // file1.ts should be checked
        expect(checkboxes[1]).not.toBeChecked(); // file2.ts should not be checked
      });
    });
  });
});
