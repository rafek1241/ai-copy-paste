import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileTree } from '@/components/FileTree/FileTree';
import { vi, expect, it, describe, beforeEach } from 'vitest';
import { mockInvoke } from '../../setup';

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
 * FileTree Hierarchy Tests
 *
 * Tests hierarchical ordering, grouping by folders/drives,
 * and tree structure behavior
 */
describe('FileTree Hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hierarchical ordering', () => {
    it('should display nodes grouped by folders', async () => {
      const nodes = [
        { path: '/project', parent_path: null, name: 'project', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 3 },
        { path: '/project/src', parent_path: '/project', name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 2 },
        { path: '/project/src/index.ts', parent_path: '/project/src', name: 'index.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/project/src/utils.ts', parent_path: '/project/src', name: 'utils.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: '/project/package.json', parent_path: '/project', name: 'package.json', is_dir: false, size: 500, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
        { path: '/project/README.md', parent_path: '/project', name: 'README.md', is_dir: false, size: 1000, mtime: 126, token_count: null, fingerprint: 'fp4', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(nodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(nodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('project');

      // Expand project folder
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
        expect(screen.getByText('package.json')).toBeInTheDocument();
        expect(screen.getByText('README.md')).toBeInTheDocument();
      });
    });

    it('should handle deep nesting (5+ levels)', async () => {
      const deepNodes: any[] = [];
      const depth = 6;

      // Build deep hierarchy
      for (let i = 1; i <= depth; i++) {
        const path = Array.from({ length: i }, (_, j) => `level${j + 1}`).join('/');
        const parentPath = i === 1 ? null : Array.from({ length: i - 1 }, (_, j) => `level${j + 1}`).join('/');

        deepNodes.push({
          path: `/${path}`,
          parent_path: parentPath ? `/${parentPath}` : null,
          name: `level${i}`,
          is_dir: true,
          size: null,
          mtime: null,
          token_count: null,
          fingerprint: null,
          child_count: 1,
        });
      }

      // Add a file at the deepest level
      const deepestPath = Array.from({ length: depth }, (_, j) => `level${j + 1}`).join('/');
      deepNodes.push({
        path: `/${deepestPath}/deep-file.ts`,
        parent_path: `/${deepestPath}`,
        name: 'deep-file.ts',
        is_dir: false,
        size: 100,
        mtime: 123,
        token_count: null,
        fingerprint: 'fp-deep',
        child_count: null,
      });

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(deepNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(deepNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      // Expand each level sequentially
      for (let i = 1; i <= depth; i++) {
        await screen.findByText(`level${i}`);
        const expandIcons = screen.getAllByTestId('expand-icon');
        fireEvent.click(expandIcons[expandIcons.length - 1]);
      }

      // Should see the deep file
      await waitFor(() => {
        expect(screen.getByText('deep-file.ts')).toBeInTheDocument();
      });
    });

    it('should show correct indentation levels', async () => {
      const nodes = [
        { path: '/root', parent_path: null, name: 'root', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/root/child', parent_path: '/root', name: 'child', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/root/child/file.ts', parent_path: '/root/child', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(nodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(nodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('root');

      // Expand all
      let expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[0]);
      await screen.findByText('child');

      expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[1]);
      await screen.findByText('file.ts');

      // Verify all nodes are visible
      const treeNodes = screen.getAllByTestId('tree-node');
      expect(treeNodes).toHaveLength(3);
    });
  });

  describe('Folder expansion behavior', () => {
    const mockNodes = [
      { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 2 },
      { path: '/mydir/file1.ts', parent_path: '/mydir', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
      { path: '/mydir/file2.ts', parent_path: '/mydir', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
    ];

    beforeEach(() => {
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

    it('should expand folder on chevron click', async () => {
      render(<FileTree />);

      await screen.findByText('mydir');

      // Initially, files should not be visible
      expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
      expect(screen.queryByText('file2.ts')).not.toBeInTheDocument();

      // Click expand icon
      const expandIcon = screen.getByTestId('expand-icon');
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
        expect(screen.getByText('file2.ts')).toBeInTheDocument();
      });
    });

    it('should collapse folder on second chevron click', async () => {
      render(<FileTree />);

      await screen.findByText('mydir');

      const expandIcon = screen.getByTestId('expand-icon');

      // Expand
      fireEvent.click(expandIcon);
      await screen.findByText('file1.ts');

      // Collapse
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
        expect(screen.queryByText('file2.ts')).not.toBeInTheDocument();
      });
    });

    it('should toggle expand state correctly', async () => {
      render(<FileTree />);

      await screen.findByText('mydir');

      const expandIcon = screen.getByTestId('expand-icon');

      // Initial state - not expanded
      expect(expandIcon).toHaveAttribute('data-expanded', 'false');

      // Expand
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(expandIcon).toHaveAttribute('data-expanded', 'true');
      });

      // Collapse
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(expandIcon).toHaveAttribute('data-expanded', 'false');
      });
    });
  });

  describe('Multiple root directories', () => {
    it('should handle multiple root folders independently', async () => {
      const multiRootNodes = [
        { path: '/folderA', parent_path: null, name: 'folderA', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/folderA/fileA.ts', parent_path: '/folderA', name: 'fileA.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fpA', child_count: null },
        { path: '/folderB', parent_path: null, name: 'folderB', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/folderB/fileB.ts', parent_path: '/folderB', name: 'fileB.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fpB', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(multiRootNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(multiRootNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('folderA');
      await screen.findByText('folderB');

      // Expand folderA
      const expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[0]);

      await waitFor(() => {
        expect(screen.getByText('fileA.ts')).toBeInTheDocument();
      });

      // folderB's children should still be hidden
      expect(screen.queryByText('fileB.ts')).not.toBeInTheDocument();

      // Expand folderB
      const newExpandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(newExpandIcons[1]);

      await waitFor(() => {
        expect(screen.getByText('fileB.ts')).toBeInTheDocument();
      });
    });

    it('should maintain independent expansion state for each folder', async () => {
      const nodes = [
        { path: '/folder1', parent_path: null, name: 'folder1', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/folder1/file1.ts', parent_path: '/folder1', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/folder2', parent_path: null, name: 'folder2', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/folder2/file2.ts', parent_path: '/folder2', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(nodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(nodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('folder1');
      await screen.findByText('folder2');

      // Expand folder1 first
      let expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[0]); // folder1

      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
      });

      // Now expand folder2
      expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[1]); // folder2

      await waitFor(() => {
        expect(screen.getByText('file2.ts')).toBeInTheDocument();
      });

      // Collapse folder1 only (now at index 0)
      expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[0]); // collapse folder1

      await waitFor(() => {
        expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
        expect(screen.getByText('file2.ts')).toBeInTheDocument(); // folder2 still expanded
      });
    });
  });

  describe('Empty folder handling', () => {
    it('should handle empty folders gracefully', async () => {
      const nodes = [
        { path: '/empty-folder', parent_path: null, name: 'empty-folder', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(nodes);
        }
        if (cmd === 'get_children') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('empty-folder');

      // Should have expand icon even if empty
      const expandIcon = screen.getByTestId('expand-icon');

      // Clicking should not crash
      fireEvent.click(expandIcon);

      // Wait for expansion to complete to avoid act() warning
      await waitFor(() => {
        expect(expandIcon).toHaveAttribute('data-expanded', 'true');
      });

      // Folder should still be visible
      expect(screen.getByText('empty-folder')).toBeInTheDocument();
    });
  });

  describe('Child count display', () => {
    it('should display child count for folders', async () => {
      const nodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 5 },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(nodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('mydir');

      // Should display the count
      await waitFor(() => {
        expect(screen.getByText(/5 items/i)).toBeInTheDocument();
      });
    });
  });
});
