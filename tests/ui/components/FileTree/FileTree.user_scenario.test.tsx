import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { FileTree } from '@/components/FileTree/FileTree';
import { vi, expect, it, describe, beforeEach, afterEach } from 'vitest';
import { mockInvoke, mockListen, mockEmit } from '../../setup';

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

describe('FileTree User Scenarios', () => {
  let mockNodes: any[] = [];
  const eventCallbacks: Record<string, Function> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockNodes = [];
    
    // Setup event mocks to actually trigger callbacks
    mockListen.mockImplementation((event, cb) => {
      eventCallbacks[event] = cb;
      return Promise.resolve(() => { delete eventCallbacks[event]; });
    });
    mockEmit.mockImplementation((event, payload) => {
      if (eventCallbacks[event]) {
        eventCallbacks[event]({ payload });
      }
      return Promise.resolve();
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should auto-expand parent when new files are added (Scenario 1)', async () => {
    mockNodes = [
      { path: '/a/b/c.txt', parent_path: '/a/b', name: 'c.txt', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
    ];

    mockInvoke.mockImplementation((cmd, args) => {
      if (cmd === 'get_children' && args?.parentPath === null) {
        return Promise.resolve(mockNodes);
      }
      return Promise.resolve([]);
    });

    render(<FileTree />);

    // Root anchor should be /a/b. So b is the root.
    await screen.findByText('b', { selector: '[data-testid="tree-label"]' });
    await screen.findByText('c.txt', { selector: '[data-testid="tree-label"]' });

    // 'b' should be expanded
    const expandIcons = screen.getAllByTestId('expand-icon');
    expect(expandIcons[0]).toHaveAttribute('data-expanded', 'true');
  });

  it('should preserve expansion when root shifts due to grandparent addition (Scenario 2)', async () => {
    // 1. Initial state: project/tracks/refactor/plan.md is added and expanded
    mockNodes = [
      { path: 'E:/project/tracks/refactor/plan.md', parent_path: 'E:/project/tracks/refactor', name: 'plan.md', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
    ];

    mockInvoke.mockImplementation((cmd, args) => {
      if (cmd === 'get_children') {
        if (args?.parentPath === null) return Promise.resolve(mockNodes);
        if (args?.parentPath === 'E:/project/tracks/refactor') return Promise.resolve(mockNodes.filter(n => n.parent_path === 'E:/project/tracks/refactor'));
      }
      return Promise.resolve([]);
    });

    render(<FileTree />);

    await screen.findByText('plan.md', { selector: '[data-testid="tree-label"]' });
    
    // Auto-expanded from initial load
    expect(screen.getByText('refactor', { selector: '[data-testid="tree-label"]' })).toBeInTheDocument();

    // 2. Add grandparent 'E:/project/tracks'
    const newRootNodes = [
      { path: 'E:/project/tracks', parent_path: 'E:/project', name: 'tracks', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
    ];
    const subNodes = [
      { path: 'E:/project/tracks/refactor', parent_path: 'E:/project/tracks', name: 'refactor', is_dir: true, size: null, mtime: null, token_count: null, fingerprint: null, child_count: 1 },
    ];
    const leafNodes = [
      { path: 'E:/project/tracks/refactor/plan.md', parent_path: 'E:/project/tracks/refactor', name: 'plan.md', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
    ];

    mockInvoke.mockImplementation((cmd, args) => {
      if (cmd === 'get_children') {
        if (args?.parentPath === null) return Promise.resolve(newRootNodes);
        if (args?.parentPath === 'E:/project/tracks') return Promise.resolve(subNodes);
        if (args?.parentPath === 'E:/project/tracks/refactor') return Promise.resolve(leafNodes);
      }
      return Promise.resolve([]);
    });

    // Trigger refresh event to simulate indexing completion
    await mockEmit('refresh-file-tree');

    // 'refactor' and 'plan.md' should still be visible because their parent 'tracks' 
    // was an ancestor of previously expanded nodes and should now be expanded.
    await waitFor(() => {
      expect(screen.getByText('tracks', { selector: '[data-testid="tree-label"]' })).toBeInTheDocument();
    }, { timeout: 5000 });

    // If these are in the document, it means their parents are expanded
    expect(await screen.findByText('refactor', { selector: '[data-testid="tree-label"]' })).toBeInTheDocument();
    expect(await screen.findByText('plan.md', { selector: '[data-testid="tree-label"]' })).toBeInTheDocument();

    // Verify at least the visible folders are expanded
    const expandIcons = screen.getAllByTestId('expand-icon');
    for (const icon of expandIcons) {
      expect(icon).toHaveAttribute('data-expanded', 'true');
    }
  });

  it('should auto-expand ancestors of checked files (Scenario 3)', async () => {
    // 1. Initial state: /a/b/c.txt is added and checked
    mockNodes = [
      { path: '/a/b/c.txt', parent_path: '/a/b', name: 'c.txt', is_dir: false, size: 100, mtime: 123, token_count: null, fingerprint: 'fp1', child_count: null },
    ];

    mockInvoke.mockImplementation((cmd, args) => {
      if (cmd === 'get_children' && args?.parentPath === null) {
        return Promise.resolve(mockNodes);
      }
      return Promise.resolve([]);
    });

    const { rerender } = render(<FileTree />);

    // Select the file
    const checkbox = await screen.findByLabelText('Select c.txt');
    fireEvent.click(checkbox);
    
    // 2. Collapse the parent manually
    const expandIcon = screen.getByTestId('expand-icon');
    fireEvent.click(expandIcon);
    expect(expandIcon).toHaveAttribute('data-expanded', 'false');

    // 3. Trigger refresh (e.g. adding another file somewhere else)
    mockNodes.push({ path: '/other/file.txt', parent_path: '/other', name: 'file.txt', is_dir: false, size: 100, mtime: 125, token_count: null, fingerprint: 'fp2', child_count: null });
    
    await mockEmit('refresh-file-tree');

    // The parent of c.txt should be auto-expanded again because the file is checked
    await waitFor(() => {
      const icons = screen.getAllByTestId('expand-icon');
      // Find the icon for the parent of c.txt
      expect(icons.some(icon => icon.getAttribute('data-expanded') === 'true')).toBe(true);
    });

    expect(screen.getByText('c.txt', { selector: '[data-testid="tree-label"]' })).toBeInTheDocument();
  });


});
