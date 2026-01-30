import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { FileTree } from '@/components/FileTree/FileTree';
import { vi, expect, it, describe, beforeEach, afterEach } from 'vitest';
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
 * FileTree Indexing Scenarios Tests
 *
 * Tests initial render scenarios with various data structures.
 * Note: Tests for dynamic re-indexing scenarios (adding parent directories
 * after files are indexed, etc.) are covered in E2E tests as they require
 * the full application lifecycle with Tauri events.
 */
describe('FileTree Indexing Scenarios', () => {
  let mockNodes: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNodes = [];
  });

  afterEach(() => {
    cleanup();
  });

  describe('Initial render with various structures', () => {
    it('should render files at root level (orphan files)', async () => {
      mockNodes = [
        { path: '/project/src/file1.ts', parent_path: null, name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/project/src/file2.ts', parent_path: null, name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
        expect(screen.getByText('file2.ts')).toBeInTheDocument();
      });
    });

    it('should render directory with children', async () => {
      mockNodes = [
        { path: '/project/src', parent_path: null, name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 3 },
        { path: '/project/src/file1.ts', parent_path: '/project/src', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/project/src/file2.ts', parent_path: '/project/src', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: '/project/src/file3.ts', parent_path: '/project/src', name: 'file3.ts', is_dir: false, size: 300, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
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

      // Expand to see children
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
        expect(screen.getByText('file2.ts')).toBeInTheDocument();
        expect(screen.getByText('file3.ts')).toBeInTheDocument();
      });
    });

    it('should render nested directory structure', async () => {
      mockNodes = [
        { path: '/project', parent_path: null, name: 'project', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/src', parent_path: '/project', name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/src/components', parent_path: '/project/src', name: 'components', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/src/components/Button.tsx', parent_path: '/project/src/components', name: 'Button.tsx', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
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
      await screen.findByText('project');
      fireEvent.click(screen.getAllByTestId('expand-icon')[0]);

      await screen.findByText('src');
      fireEvent.click(screen.getAllByTestId('expand-icon')[1]);

      await screen.findByText('components');
      fireEvent.click(screen.getAllByTestId('expand-icon')[2]);

      await waitFor(() => {
        expect(screen.getByText('Button.tsx')).toBeInTheDocument();
      });
    });

    it('should render multiple sibling directories', async () => {
      mockNodes = [
        { path: '/project', parent_path: null, name: 'project', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 3 },
        { path: '/project/track1', parent_path: '/project', name: 'track1', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/track1/file1.ts', parent_path: '/project/track1', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/project/track2', parent_path: '/project', name: 'track2', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/track2/file2.ts', parent_path: '/project/track2', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: '/project/track3', parent_path: '/project', name: 'track3', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/track3/file3.ts', parent_path: '/project/track3', name: 'file3.ts', is_dir: false, size: 300, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
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

      await screen.findByText('project');

      // Expand project to see all track folders
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.getByText('track1')).toBeInTheDocument();
        expect(screen.getByText('track2')).toBeInTheDocument();
        expect(screen.getByText('track3')).toBeInTheDocument();
      });
    });
  });

  describe('Mixed content at root', () => {
    it('should render mixed files and folders at root level', async () => {
      mockNodes = [
        { path: '/file1.ts', parent_path: null, name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/mydir/file2.ts', parent_path: '/mydir', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: '/file3.ts', parent_path: null, name: 'file3.ts', is_dir: false, size: 300, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
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

      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
        expect(screen.getByText('mydir')).toBeInTheDocument();
        expect(screen.getByText('file3.ts')).toBeInTheDocument();
      });

      // Expand folder to see its contents
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.getByText('file2.ts')).toBeInTheDocument();
      });
    });
  });

  describe('Lazy loading children', () => {
    it('should load children when folder is expanded', async () => {
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

      render(<FileTree />);

      await screen.findByText('mydir');

      // Children should not be visible initially
      expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
      expect(screen.queryByText('file2.ts')).not.toBeInTheDocument();

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));

      // Children should now be loaded and visible
      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
        expect(screen.getByText('file2.ts')).toBeInTheDocument();
      });

      // Verify get_children was called with correct parent path
      expect(mockInvoke).toHaveBeenCalledWith('get_children', { parentPath: '/mydir' });
    });
  });

  describe('Selection with folder check', () => {
    it('should load and select all children when folder checkbox is clicked', async () => {
      const onSelectionChange = vi.fn();

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

      render(<FileTree onSelectionChange={onSelectionChange} />);

      await screen.findByText('mydir');

      // Click folder checkbox (should load children and select all)
      fireEvent.click(screen.getByTestId('tree-checkbox'));

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith(
          expect.arrayContaining(['/mydir/file1.ts', '/mydir/file2.ts'])
        );
      });
    });
  });

  describe('Root path filtering', () => {
    it('should not show nested paths as roots when parent is a root', async () => {
      // When both parent and child are returned at root level,
      // only the parent should be shown initially
      mockNodes = [
        { path: '/project', parent_path: null, name: 'project', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/src', parent_path: '/project', name: 'src', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes);
        }
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === args.parentPath));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await screen.findByText('project');

      // src should NOT appear at root level - it's nested under project
      expect(screen.queryByText('src')).not.toBeInTheDocument();

      // Expand project
      fireEvent.click(screen.getByTestId('expand-icon'));

      // Now src should be visible
      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
      });
    });
  });
});
