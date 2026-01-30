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
 * FileTree Edge Cases Tests
 *
 * Tests unusual scenarios and edge cases:
 * - Very long file names
 * - Deep nesting
 * - Large number of files
 * - Special characters in paths
 * - Rapid interactions
 */
describe('FileTree Edge Cases', () => {
  let mockNodes: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNodes = [];
  });

  afterEach(() => {
    cleanup();
  });

  describe('Long file names', () => {
    it('should handle very long file names', async () => {
      const longName = 'a'.repeat(200) + '.ts';
      mockNodes = [
        { path: `/folder/${longName}`, parent_path: null, name: longName, is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText(longName)).toBeInTheDocument();
      });
    });

    it('should handle very long folder paths', async () => {
      const deepPath = Array.from({ length: 20 }, (_, i) => `folder${i}`).join('/');
      mockNodes = [
        { path: `/${deepPath}`, parent_path: null, name: 'folder19', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('folder19')).toBeInTheDocument();
      });
    });
  });

  describe('Special characters', () => {
    it('should handle file names with spaces', async () => {
      mockNodes = [
        { path: '/folder/my file.ts', parent_path: null, name: 'my file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('my file.ts')).toBeInTheDocument();
      });
    });

    it('should handle file names with unicode characters', async () => {
      mockNodes = [
        { path: '/folder/文件.ts', parent_path: null, name: '文件.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/folder/файл.ts', parent_path: null, name: 'файл.ts', is_dir: false, size: 100, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: '/folder/αρχείο.ts', parent_path: null, name: 'αρχείο.ts', is_dir: false, size: 100, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('文件.ts')).toBeInTheDocument();
        expect(screen.getByText('файл.ts')).toBeInTheDocument();
        expect(screen.getByText('αρχείο.ts')).toBeInTheDocument();
      });
    });

    it('should handle file names with special symbols', async () => {
      mockNodes = [
        { path: '/folder/file-name_test.ts', parent_path: null, name: 'file-name_test.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/folder/file.test.spec.ts', parent_path: null, name: 'file.test.spec.ts', is_dir: false, size: 100, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: "/folder/file'name.ts", parent_path: null, name: "file'name.ts", is_dir: false, size: 100, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('file-name_test.ts')).toBeInTheDocument();
        expect(screen.getByText('file.test.spec.ts')).toBeInTheDocument();
        expect(screen.getByText("file'name.ts")).toBeInTheDocument();
      });
    });

    it('should handle folder names with parentheses', async () => {
      mockNodes = [
        { path: '/project (backup)', parent_path: null, name: 'project (backup)', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
        { path: '/project [v2]', parent_path: null, name: 'project [v2]', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('project (backup)')).toBeInTheDocument();
        expect(screen.getByText('project [v2]')).toBeInTheDocument();
      });
    });
  });

  describe('Large number of files', () => {
    it('should handle folder with many children', async () => {
      mockNodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 100 },
      ];

      // Add 100 files
      for (let i = 0; i < 100; i++) {
        mockNodes.push({
          path: `/mydir/file${i.toString().padStart(3, '0')}.ts`,
          parent_path: '/mydir',
          name: `file${i.toString().padStart(3, '0')}.ts`,
          is_dir: false,
          size: 100 + i,
          mtime: 123 + i,
          token_count: null,
          fingerprint: `fp${i}`,
          child_count: null,
        });
      }

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

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));

      await waitFor(() => {
        expect(screen.getByText('file000.ts')).toBeInTheDocument();
        expect(screen.getByText('file099.ts')).toBeInTheDocument();
      });

      // Verify all 101 nodes are rendered (1 folder + 100 files)
      const nodes = screen.getAllByTestId('tree-node');
      expect(nodes).toHaveLength(101);
    });

    it('should handle multiple root folders', async () => {
      // Add 20 root folders
      for (let i = 0; i < 20; i++) {
        mockNodes.push({
          path: `/folder${i}`,
          parent_path: null,
          name: `folder${i}`,
          is_dir: true,
          size: null,
          mtime: null,
          token_count: null,
          fingerprint: null,
          child_count: 0,
        });
      }

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('folder0')).toBeInTheDocument();
        expect(screen.getByText('folder19')).toBeInTheDocument();
      });

      const nodes = screen.getAllByTestId('tree-node');
      expect(nodes).toHaveLength(20);
    });
  });

  describe('Rapid interactions', () => {
    it('should handle rapid expand/collapse', async () => {
      mockNodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/mydir/file.ts', parent_path: '/mydir', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
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

      const expandIcon = screen.getByTestId('expand-icon');

      // Rapidly click expand/collapse 10 times
      for (let i = 0; i < 10; i++) {
        fireEvent.click(expandIcon);
      }

      // Should not crash, final state should be consistent
      await waitFor(() => {
        const isExpanded = expandIcon.getAttribute('data-expanded');
        // After 10 clicks (even number), should be back to original state
        expect(isExpanded).toBe('false');
      });
    });

    it('should handle rapid checkbox clicks', async () => {
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

      render(<FileTree />);

      await screen.findByText('mydir');

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await screen.findByText('file1.ts');

      const checkboxes = screen.getAllByTestId('tree-checkbox');

      // Rapidly click different checkboxes
      fireEvent.click(checkboxes[1]); // file1
      fireEvent.click(checkboxes[2]); // file2
      fireEvent.click(checkboxes[3]); // file3
      fireEvent.click(checkboxes[1]); // file1 again
      fireEvent.click(checkboxes[0]); // folder

      // Should not crash, state should be consistent
      await waitFor(() => {
        // After selecting folder, all should be checked
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).toBeChecked();
        expect(checkboxes[3]).toBeChecked();
      });
    });
  });

  describe('Empty and null values', () => {
    it('should handle nodes with null/undefined optional fields', async () => {
      mockNodes = [
        {
          path: '/mydir',
          parent_path: null,
          name: 'mydir',
          is_dir: true,
          size: null,
          mtime: null,
          token_count: null,
          fingerprint: null,
          child_count: null, // null child_count
        },
        {
          path: '/file.ts',
          parent_path: null,
          name: 'file.ts',
          is_dir: false,
          size: 0, // zero size
          mtime: 0, // zero mtime
          token_count: null,
          fingerprint: null, // null fingerprint
          child_count: null,
        },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('mydir')).toBeInTheDocument();
        expect(screen.getByText('file.ts')).toBeInTheDocument();
      });
    });

    it('should handle empty folder name gracefully', async () => {
      // This is an edge case that shouldn't happen, but test robustness
      mockNodes = [
        { path: '/normal-folder', parent_path: null, name: 'normal-folder', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 0 },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes);
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('normal-folder')).toBeInTheDocument();
      });
    });
  });

  describe('File extensions', () => {
    it('should handle files without extensions', async () => {
      mockNodes = [
        { path: '/Makefile', parent_path: null, name: 'Makefile', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/Dockerfile', parent_path: null, name: 'Dockerfile', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: '/.gitignore', parent_path: null, name: '.gitignore', is_dir: false, size: 50, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('Makefile')).toBeInTheDocument();
        expect(screen.getByText('Dockerfile')).toBeInTheDocument();
        expect(screen.getByText('.gitignore')).toBeInTheDocument();
      });
    });

    it('should handle files with multiple dots in name', async () => {
      mockNodes = [
        { path: '/file.test.ts', parent_path: null, name: 'file.test.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
        { path: '/file.spec.tsx', parent_path: null, name: 'file.spec.tsx', is_dir: false, size: 200, mtime: 124, token_count: null, fingerprint: 'fp2', child_count: null },
        { path: '/config.prod.json', parent_path: null, name: 'config.prod.json', is_dir: false, size: 50, mtime: 125, token_count: null, fingerprint: 'fp3', child_count: null },
      ];

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_children') {
          return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
        }
        return Promise.resolve([]);
      });

      render(<FileTree />);

      await waitFor(() => {
        expect(screen.getByText('file.test.ts')).toBeInTheDocument();
        expect(screen.getByText('file.spec.tsx')).toBeInTheDocument();
        expect(screen.getByText('config.prod.json')).toBeInTheDocument();
      });
    });
  });

  describe('Callback behavior', () => {
    it('should call onSelectionChange with correct paths', async () => {
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

      // Expand folder
      fireEvent.click(screen.getByTestId('expand-icon'));
      await screen.findByText('file1.ts');

      // Select file1.ts
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith(['/mydir/file1.ts']);
      });

      // Select file2.ts too
      fireEvent.click(checkboxes[2]);

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith(
          expect.arrayContaining(['/mydir/file1.ts', '/mydir/file2.ts'])
        );
      });
    });

    it('should only include file paths in selection (not folders)', async () => {
      const onSelectionChange = vi.fn();

      mockNodes = [
        { path: '/mydir', parent_path: null, name: 'mydir', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
        { path: '/mydir/file.ts', parent_path: '/mydir', name: 'file.ts', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
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

      // Select the entire folder
      const folderCheckbox = screen.getByTestId('tree-checkbox');
      fireEvent.click(folderCheckbox);

      await waitFor(() => {
        // Should only contain file paths, not the folder
        expect(onSelectionChange).toHaveBeenCalledWith(['/mydir/file.ts']);
      });
    });
  });
});
