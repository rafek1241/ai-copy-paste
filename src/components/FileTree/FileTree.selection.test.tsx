import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileTree } from './FileTree';
import { vi, expect, it, describe, beforeEach } from 'vitest';
import { mockInvoke } from '../../test/setup';

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
      id: 1,
      parent_id: null,
      name: 'folder1',
      path: '/folder1',
      is_dir: true,
      size: null,
      mtime: null,
      token_count: null,
      fingerprint: null,
    },
    {
      id: 2,
      parent_id: 1,
      name: 'file1.txt',
      path: '/folder1/file1.txt',
      is_dir: false,
      size: 100,
      mtime: 123456,
      token_count: null,
      fingerprint: 'fp1',
    },
    {
      id: 3,
      parent_id: 1,
      name: 'subfolder',
      path: '/folder1/subfolder',
      is_dir: true,
      size: null,
      mtime: null,
      token_count: null,
      fingerprint: null,
    },
    {
      id: 4,
      parent_id: 3,
      name: 'file2.txt',
      path: '/folder1/subfolder/file2.txt',
      is_dir: false,
      size: 200,
      mtime: 123457,
      token_count: null,
      fingerprint: 'fp2',
    }
  ];

  beforeEach(() => {
    mockInvoke.mockImplementation((command, args) => {
      if (command === 'get_children') {
        const parentId = args.parentId;
        return Promise.resolve(mockNodes.filter(n => n.parent_id === parentId));
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
    // Create a chain of 10 nested folders
    const deepNodes = [];
    for (let i = 1; i <= 10; i++) {
      deepNodes.push({
        id: i,
        parent_id: i === 1 ? null : i - 1,
        name: `folder${i}`,
        path: `/` + Array.from({length: i}, (_, j) => `folder${j+1}`).join('/'),
        is_dir: true,
        size: null,
        mtime: null,
        token_count: null,
        fingerprint: null,
      });
    }
    // Add one file at the bottom
    deepNodes.push({
      id: 11,
      parent_id: 10,
      name: 'leaf.txt',
      path: deepNodes[9].path + '/leaf.txt',
      is_dir: false,
      size: 100,
      mtime: 123456,
      token_count: null,
      fingerprint: 'fp_leaf',
    });

    mockInvoke.mockImplementation((command, args) => {
      if (command === 'get_children') {
        const parentId = args.parentId;
        return Promise.resolve(deepNodes.filter(n => n.parent_id === parentId));
      }
      return Promise.resolve([]);
    });

    render(<FileTree />);

    // Expand all folders
    for (let i = 1; i <= 10; i++) {
      const nodePath = deepNodes[i-1].path;
      const nodeRow = await screen.findByTitle(nodePath);
      const expandIcon = nodeRow.closest('div')?.querySelector('[data-testid="expand-icon"]');
      if (expandIcon) {
        fireEvent.click(expandIcon);
      }
    }

    // Find the leaf checkbox
    const leafCheckbox = await screen.findByTitle(deepNodes[10].path);
    const checkbox = leafCheckbox.closest('div')?.querySelector('input[type="checkbox"]');
    if (!checkbox) throw new Error('Checkbox not found');

    // Check the leaf
    fireEvent.click(checkbox);

    // Verify all parents are checked (since they only have one child)
    await waitFor(() => {
      const allCheckboxes = screen.getAllByTestId('tree-checkbox');
      expect(allCheckboxes).toHaveLength(11);
      allCheckboxes.forEach(cb => {
        expect(cb).toBeChecked();
      });
    });

    // Uncheck the leaf
    fireEvent.click(checkbox);

    // Verify all parents are unchecked
    await waitFor(() => {
      const allCheckboxes = screen.getAllByTestId('tree-checkbox');
      allCheckboxes.forEach(cb => {
        expect(cb).not.toBeChecked();
        expect((cb as HTMLInputElement).indeterminate).toBe(false);
      });
    });
  });
});
