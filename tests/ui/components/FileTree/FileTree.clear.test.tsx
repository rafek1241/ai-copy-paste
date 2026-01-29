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

// Helper to find node by label text (avoiding icon text collisions)
const findNodeLabel = async (text: string) => {
  await waitFor(() => {
    const labels = screen.getAllByTestId('tree-label');
    expect(labels.some(l => l.textContent === text)).toBe(true);
  });
};

const queryNodeLabel = (text: string) => {
  const labels = screen.queryAllByTestId('tree-label');
  return labels.find(l => l.textContent === text) || null;
};

/**
 * FileTree Clear Context Tests
 *
 * Tests clearing the file tree (removing all indexed content)
 * and handling of empty states
 */
describe('FileTree Clear Context', () => {
  let mockNodes: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNodes = [];
  });

  afterEach(() => {
    cleanup();
  });

  describe('Empty state', () => {
    it('should display empty state when no files are indexed', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        const emptyState = screen.getByTestId('empty-state');
        expect(emptyState).toBeInTheDocument();
        expect(emptyState).toHaveTextContent(/drag and drop/i);
      });
    });

    it('should show search-specific empty message when searching with no results', async () => {
      mockNodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
      ];

      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'get_children' && args?.parentPath === null) {
          return Promise.resolve(mockNodes);
        }
        return Promise.resolve([]);
      });

      render(<FileTree searchQuery="nonexistent-file" />);

      await waitFor(() => {
        const emptyState = screen.getByTestId('empty-state');
        expect(emptyState).toHaveTextContent(/no matching files/i);
      });
    });
  });

  describe('Clear all selections', () => {
    beforeEach(() => {
      mockNodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 3 },
        { path: '/mydir/file1.ts', parent_path: '/mydir', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/mydir/file2.ts', parent_path: '/mydir', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: '/mydir/file3.ts', parent_path: '/mydir', name: 'file3.ts', is_dir: false, size: 300, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
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

    it('should clear all selections when shouldClearSelection prop changes to true', async () => {
      const onSelectionChange = vi.fn();
      const { rerender } = render(
        <FileTree onSelectionChange={onSelectionChange} shouldClearSelection={false} />
      );

      await findNodeLabel('mydir');

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await findNodeLabel('file1.ts');

      // Select all files
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]); // file1.ts
      fireEvent.click(checkboxes[2]); // file2.ts
      fireEvent.click(checkboxes[3]); // file3.ts

      await waitFor(() => {
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).toBeChecked();
        expect(checkboxes[3]).toBeChecked();
      });

      // Clear selections
      rerender(
        <FileTree onSelectionChange={onSelectionChange} shouldClearSelection={true} />
      );

      await waitFor(() => {
        const newCheckboxes = screen.getAllByTestId('tree-checkbox');
        newCheckboxes.forEach(cb => {
          expect(cb).not.toBeChecked();
          expect((cb as HTMLInputElement).indeterminate).toBe(false);
        });
      });

      // onSelectionChange should be called with empty array
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('should clear folder indeterminate state when clearing selections', async () => {
      const { rerender } = render(<FileTree shouldClearSelection={false} />);

      await findNodeLabel('mydir');

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await findNodeLabel('file1.ts');

      // Select only one file (folder should become indeterminate)
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]); // file1.ts

      await waitFor(() => {
        expect((checkboxes[0] as HTMLInputElement).indeterminate).toBe(true);
      });

      // Clear selections
      rerender(<FileTree shouldClearSelection={true} />);

      await waitFor(() => {
        const newCheckboxes = screen.getAllByTestId('tree-checkbox');
        expect(newCheckboxes[0]).not.toBeChecked();
        expect((newCheckboxes[0] as HTMLInputElement).indeterminate).toBe(false);
      });
    });

    it('should clear nested selections and indeterminate states', async () => {
      // Create nested structure
      mockNodes = [
        { path: '/root', parent_path: null, name: 'root', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/root/child', parent_path: '/root', name: 'child', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 2 },
        { path: '/root/child/file1.ts', parent_path: '/root/child', name: 'file1.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/root/child/file2.ts', parent_path: '/root/child', name: 'file2.ts', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
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

      const { rerender } = render(<FileTree shouldClearSelection={false} />);

      await findNodeLabel('root');

      // Expand all
      let expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[0]); // root
      await findNodeLabel('child');

      expandIcons = screen.getAllByTestId('expand-icon');
      fireEvent.click(expandIcons[1]); // child
      await findNodeLabel('file1.ts');

      // Select file1.ts only
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[2]); // file1.ts

      await waitFor(() => {
        expect(checkboxes[2]).toBeChecked();
        expect((checkboxes[1] as HTMLInputElement).indeterminate).toBe(true); // child
        expect((checkboxes[0] as HTMLInputElement).indeterminate).toBe(true); // root
      });

      // Clear all
      rerender(<FileTree shouldClearSelection={true} />);

      await waitFor(() => {
        const newCheckboxes = screen.getAllByTestId('tree-checkbox');
        newCheckboxes.forEach(cb => {
          expect(cb).not.toBeChecked();
          expect((cb as HTMLInputElement).indeterminate).toBe(false);
        });
      });
    });
  });

  describe('Clear entire file tree', () => {
    // Note: Tests for dynamic tree clearing and re-indexing scenarios require
    // the full application lifecycle with Tauri events, so they are covered
    // in E2E tests. Here we test the initial empty state behavior.

    it('should start in empty state when no data exists', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });
  });

  describe('Partial clear', () => {
    // Note: Tests for dynamic partial clearing require the full application
    // lifecycle with Tauri events. This functionality is tested in E2E tests.

    it('should render multiple root directories correctly', async () => {
      mockNodes = [
        { path: '/dir1', parent_path: null, name: 'dir1', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
        { path: '/dir2', parent_path: null, name: 'dir2', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
        { path: '/dir3', parent_path: null, name: 'dir3', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
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
        expect(queryNodeLabel('dir1')).toBeInTheDocument();
        expect(queryNodeLabel('dir2')).toBeInTheDocument();
        expect(queryNodeLabel('dir3')).toBeInTheDocument();
      });
    });

    it('should preserve selection when expanding/collapsing folders', async () => {
      mockNodes = [
        { path: '/dir1', parent_path: null, name: 'dir1', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/dir1/file.ts', parent_path: '/dir1', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
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

      await findNodeLabel('dir1');

      // Expand dir1 and select file
      fireEvent.click(screen.getByTestId('expand-icon'));
      await findNodeLabel('file.ts');

      let checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]); // file.ts

      await waitFor(() => {
        expect(checkboxes[1]).toBeChecked();
      });

      // Collapse and re-expand
      fireEvent.click(screen.getByTestId('expand-icon'));
      await waitFor(() => {
        expect(queryNodeLabel('file.ts')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('expand-icon'));
      await findNodeLabel('file.ts');

      // Selection should be preserved
      checkboxes = screen.getAllByTestId('tree-checkbox');
      expect(checkboxes[1]).toBeChecked();
    });
  });

  describe('Reset and fresh start', () => {
    // Note: Tests for dynamic reset and re-indexing require the full application
    // lifecycle with Tauri events. This functionality is tested in E2E tests.

    it('should start with no selections when rendering fresh', async () => {
      mockNodes = [
        { path: '/project', parent_path: null, name: 'project', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/project/file.ts', parent_path: '/project', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
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

      await findNodeLabel('project');

      // Expand
      fireEvent.click(screen.getByTestId('expand-icon'));
      await findNodeLabel('file.ts');

      // Nothing should be selected initially
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      checkboxes.forEach(cb => {
        expect(cb).not.toBeChecked();
      });
    });
  });
});
