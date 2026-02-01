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

describe('FileTree Selection Propagation', () => {
  const mockNodes = [
    {
      path: '/folder1',
      parent_path: null,
      name: 'folder1',
      is_dir: true,
      size: null,
      mtime: null,
      token_count: null,
      fingerprint: null,
      child_count: 2,
    },
    {
      path: '/folder1/file1.txt',
      parent_path: '/folder1',
      name: 'file1.txt',
      is_dir: false,
      size: 100,
      mtime: 123456,
      token_count: null,
      fingerprint: 'fp1',
      child_count: null,
    },
    {
      path: '/folder1/subfolder',
      parent_path: '/folder1',
      name: 'subfolder',
      is_dir: true,
      size: null,
      mtime: null,
      token_count: null,
      fingerprint: null,
      child_count: 1,
    },
    {
      path: '/folder1/subfolder/file2.txt',
      parent_path: '/folder1/subfolder',
      name: 'file2.txt',
      is_dir: false,
      size: 200,
      mtime: 123457,
      token_count: null,
      fingerprint: 'fp2',
      child_count: null,
    }
  ];

  beforeEach(() => {
    mockInvoke.mockImplementation((command, args) => {
      if (command === 'get_tree_roots') {
        return Promise.resolve(mockNodes.filter(n => n.parent_path === null));
      }
      if (command === 'get_children') {
        const parentPath = args.parentPath;
        return Promise.resolve(mockNodes.filter(n => n.parent_path === parentPath));
      }
      return Promise.resolve([]);
    });
  });

  it('should check all children when parent is checked', async () => {
    render(<FileTree />);

    // Wait for root folder to load
    const folder1Checkbox = await screen.findByTestId('tree-checkbox');
    
    // Expand folder1
    const expandIcon = await screen.findByTestId('expand-icon');
    fireEvent.click(expandIcon);

    // Click checkbox
    fireEvent.click(folder1Checkbox);

    // Verify all children (file1.txt and subfolder) are checked
    await waitFor(() => {
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      expect(checkboxes).toHaveLength(3); // folder1, file1.txt, subfolder
      checkboxes.forEach(cb => {
        expect(cb).toBeChecked();
      });
    });
  });

  it('should apply initial selection in a single update', async () => {
    const selectionNodes = [
      {
        path: '/file1.txt',
        parent_path: null,
        name: 'file1.txt',
        is_dir: false,
        size: 100,
        mtime: 123456,
        token_count: null,
        fingerprint: 'fp1',
        child_count: null,
      },
      {
        path: '/file2.txt',
        parent_path: null,
        name: 'file2.txt',
        is_dir: false,
        size: 200,
        mtime: 123457,
        token_count: null,
        fingerprint: 'fp2',
        child_count: null,
      },
    ];

    mockInvoke.mockImplementation((command, args) => {
      if (command === 'get_children') {
        const parentPath = args.parentPath;
        if (!parentPath) {
          return Promise.resolve(selectionNodes);
        }
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const onSelectionChange = vi.fn();
    render(
      <FileTree
        initialSelectedPaths={['/file1.txt', '/file2.txt']}
        onSelectionChange={onSelectionChange}
      />
    );

    await waitFor(() => {
      const checkboxes = screen.getAllByTestId('tree-checkbox');
      expect(checkboxes).toHaveLength(2);
      checkboxes.forEach(cb => {
        expect(cb).toBeChecked();
      });
    });

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      expect(onSelectionChange).toHaveBeenCalledWith(['/file1.txt', '/file2.txt']);
    });
  });

  it('should set parent to indeterminate when only some children are checked', async () => {
    render(<FileTree />);

    // Expand folder1
    const expandIcon = await screen.findByTestId('expand-icon');
    fireEvent.click(expandIcon);

    // Wait for children to load after expansion
    let checkboxes: HTMLElement[] = [];
    await waitFor(() => {
      checkboxes = screen.getAllByTestId('tree-checkbox');
      expect(checkboxes.length).toBeGreaterThan(1);
    });

    // checkboxes[0] is folder1, [1] is file1.txt, [2] is subfolder

    // Check only file1.txt
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(checkboxes[0]).not.toBeChecked();
      expect((checkboxes[0] as HTMLInputElement).indeterminate).toBe(true);
      expect(checkboxes[1]).toBeChecked();
    });
  });

  it('should propagate indeterminate state up multiple levels', async () => {
    render(<FileTree />);

    // Expand folder1
    fireEvent.click(await screen.findByTestId('expand-icon'));
    
    // Expand subfolder
    let expandIcons: HTMLElement[] = [];
    await waitFor(() => {
      expandIcons = screen.getAllByTestId('expand-icon');
      expect(expandIcons.length).toBeGreaterThan(1);
    });
    fireEvent.click(expandIcons[1]); // subfolder's expand icon

    // Wait for file2.txt to appear
    await screen.findByText('file2.txt');

    let checkboxes: HTMLElement[] = [];
    await waitFor(() => {
      checkboxes = screen.getAllByTestId('tree-checkbox');
      expect(checkboxes.length).toBe(4);
    });

    // [0]: folder1, [1]: file1.txt, [2]: subfolder, [3]: file2.txt

    // Check file2.txt
    fireEvent.click(checkboxes[3]);

    await waitFor(() => {
      // file2.txt is checked
      expect(checkboxes[3]).toBeChecked();
      
      // subfolder should be checked
      expect(checkboxes[2]).toBeChecked();
      
      // folder1 should be indeterminate
      expect(checkboxes[0]).not.toBeChecked();
      expect((checkboxes[0] as HTMLInputElement).indeterminate).toBe(true);
    });
  });

  it('should handle deep nesting propagation correctly', async () => {
    // Create a chain of 5 nested folders (reduced for test reliability)
    const deepNodes: any[] = [];
    
    // Helper to generate path
    const getPath = (index: number) => {
      let p = '';
      for (let i = 1; i <= index; i++) {
        p += `/folder${i}`;
      }
      return p;
    };

    for (let i = 1; i <= 5; i++) {
      const path = getPath(i);
      const parentPath = i === 1 ? null : getPath(i - 1);
      
      deepNodes.push({
        path: path,
        parent_path: parentPath,
        name: `folder${i}`,
        is_dir: true,
        size: null,
        mtime: null,
        token_count: null,
        fingerprint: null,
        child_count: 1,
      });
    }
    
    // Add one file at the bottom
    const lastFolder = deepNodes[4];
    deepNodes.push({
      path: lastFolder.path + '/leaf.txt',
      parent_path: lastFolder.path,
      name: 'leaf.txt',
      is_dir: false,
      size: 100,
      mtime: 123456,
      token_count: null,
      fingerprint: 'fp_leaf',
      child_count: null,
    });

    mockInvoke.mockImplementation((command, args) => {
      if (command === 'get_tree_roots') {
        return Promise.resolve(deepNodes.filter(n => n.parent_path === null));
      }
      if (command === 'get_children') {
        const parentPath = args.parentPath;
        return Promise.resolve(deepNodes.filter(n => n.parent_path === parentPath));
      }
      return Promise.resolve([]);
    });

    render(<FileTree />);

    // Expand all folders by clicking expand icons iteratively
    for (let i = 1; i <= 5; i++) {
      await screen.findByText(`folder${i}`);
      const expandIcons = screen.getAllByTestId('expand-icon');
      // Click the last expand icon (deepest unexpanded folder)
      fireEvent.click(expandIcons[expandIcons.length - 1]);
    }

    // Wait for leaf file to appear
    await screen.findByText('leaf.txt');

    // Get all checkboxes - should have 6 (5 folders + 1 file)
    let checkboxes: HTMLElement[] = [];
    await waitFor(() => {
      checkboxes = screen.getAllByTestId('tree-checkbox');
      expect(checkboxes).toHaveLength(6);
    });

    // Check the leaf (last checkbox)
    fireEvent.click(checkboxes[5]);

    // Verify all checkboxes are checked (since each folder has only one child)
    await waitFor(() => {
      const allCheckboxes = screen.getAllByTestId('tree-checkbox');
      allCheckboxes.forEach(cb => {
        expect(cb).toBeChecked();
      });
    });

    // Uncheck the leaf
    fireEvent.click(checkboxes[5]);

    // Verify all are unchecked
    await waitFor(() => {
      const allCheckboxes = screen.getAllByTestId('tree-checkbox');
      allCheckboxes.forEach(cb => {
        expect(cb).not.toBeChecked();
        expect((cb as HTMLInputElement).indeterminate).toBe(false);
      });
    });
  });
});
