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
 * FileTree Path-Based Behavior Tests
 *
 * Tests that paths are the source of truth (not folder IDs)
 * and that the file tree behaves like a file explorer
 */
describe('FileTree Path-Based Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Paths as unique identifiers', () => {
    it('should use path as unique identifier for nodes', async () => {
      const mockNodes = [
        { path: '/project/src', parent_path: null, name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/src/index.ts', parent_path: '/project/src', name: 'index.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
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

      // Wait for the folder to appear
      await screen.findByText('src');

      // Expand to see children
      const expandIcon = screen.getByTestId('expand-icon');
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(screen.getByText('index.ts')).toBeInTheDocument();
      });

      // Verify nodes are rendered with correct paths
      const nodes = screen.getAllByTestId('tree-node');
      expect(nodes).toHaveLength(2);
    });

    it('should handle Windows-style paths correctly', async () => {
      const windowsNodes = [
        { path: 'C:\\Users\\project\\src', parent_path: null, name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: 'C:\\Users\\project\\src\\app.ts', parent_path: 'C:\\Users\\project\\src', name: 'app.ts', is_dir: false, size: 200, mtime: 456, token_count: null, fingerprint: 'fp2', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(windowsNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(windowsNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('src');

      const expandIcon = screen.getByTestId('expand-icon');
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(screen.getByText('app.ts')).toBeInTheDocument();
      });
    });

    it('should handle Unix-style paths correctly', async () => {
      const unixNodes = [
        { path: '/home/user/project/lib', parent_path: null, name: 'lib', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 2 },
        { path: '/home/user/project/lib/utils.ts', parent_path: '/home/user/project/lib', name: 'utils.ts', is_dir: false, size: 150, mtime: 789, token_count: null, fingerprint: 'fp3', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(unixNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(unixNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('lib');

      const expandIcon = screen.getByTestId('expand-icon');
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(screen.getByText('utils.ts')).toBeInTheDocument();
      });
    });

    it('should handle paths with special characters', async () => {
      const specialNodes = [
        { path: '/project/src (v2)', parent_path: null, name: 'src (v2)', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/src (v2)/file-name_test.ts', parent_path: '/project/src (v2)', name: 'file-name_test.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp4', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(specialNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(specialNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('src (v2)');

      const expandIcon = screen.getByTestId('expand-icon');
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(screen.getByText('file-name_test.ts')).toBeInTheDocument();
      });
    });
  });

  describe('Path hierarchy detection', () => {
    it('should correctly identify parent-child relationships via path', async () => {
      const hierarchyNodes = [
        { path: '/root', parent_path: null, name: 'root', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/root/child', parent_path: '/root', name: 'child', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/root/child/grandchild.ts', parent_path: '/root/child', name: 'grandchild.ts', is_dir: false, size: 50, mtime: 111, token_count: null, fingerprint: 'fp5', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(hierarchyNodes.filter(n => n.parent_path === null));
        }
        if (cmd === 'get_children') {
          return Promise.resolve(hierarchyNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      // Should show root first
      await screen.findByText('root');

      // Expand root to see child
      let expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[0]);

      await screen.findByText('child');

      // Expand child to see grandchild
      expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[1]);

      await waitFor(() => {
        expect(screen.getByText('grandchild.ts')).toBeInTheDocument();
      });
    });

    it('should handle multiple root paths (different drives/directories)', async () => {
      const multiRootNodes = [
        { path: '/home/user/project1', parent_path: null, name: 'project1', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
        { path: '/home/user/project2', parent_path: null, name: 'project2', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
        { path: 'D:\\work\\project3', parent_path: null, name: 'project3', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(multiRootNodes);
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('project1')).toBeInTheDocument();
        expect(screen.getByText('project2')).toBeInTheDocument();
        expect(screen.getByText('project3')).toBeInTheDocument();
      });
    });

    it('should not show nested paths as roots when parent is already a root', async () => {
      // When a parent and its child are both returned at root level,
      // only the parent should be shown as root
      const nestedNodes = [
        { path: '/project', parent_path: null, name: 'project', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/src', parent_path: '/project', name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(nestedNodes);
        }
        if (cmd === 'get_children') {
          return Promise.resolve(nestedNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      // Should only show project at root level initially
      await screen.findByText('project');

      // src should NOT be visible until project is expanded
      expect(screen.queryByText('src')).not.toBeInTheDocument();

      // Expand project
      const expandIcon = screen.getByTestId('expand-icon');
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
      });
    });
  });

  describe('Path-based node lookup', () => {
    it('should correctly select file nodes by their path', async () => {
      const nodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/mydir/file.ts', parent_path: '/mydir', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
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

      await screen.findByText('mydir');

      // Expand folder
      const expandIcon = screen.getByTestId('expand-icon');
      fireEvent.click(expandIcon);

      await waitFor(() => {
        expect(screen.getByText('file.ts')).toBeInTheDocument();
      });

      // Select the file
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      const fileCheckbox = checkboxes[1]; // Second checkbox is for the file
      fireEvent.click(fileCheckbox);

      await waitFor(() => {
        expect(fileCheckbox).toBeChecked();
      });
    });
  });
});
