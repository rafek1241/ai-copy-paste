import { screen, waitFor, fireEvent } from '@testing-library/react';
import { render } from './test-utils';
import App from '@/App';
import { expect, it, describe, beforeEach } from 'vitest';
import { mockInvoke, mockListen } from './setup';

describe('App Global Drop Zone', () => {
  beforeEach(() => {
    mockInvoke.mockImplementation((command, args) => {
      if (command === 'load_settings') {
        return Promise.resolve({
          excluded_extensions: [],
          token_limit: 200000,
          default_template: 'agent',
          auto_save_history: true,
          cache_size_mb: 100,
        });
      }
      if (command === 'get_templates') {
        return Promise.resolve([
          { id: 'agent', name: 'Agent', content: '...' },
          { id: 'planning', name: 'Planning', content: '...' },
        ]);
      }
      if (command === 'get_tree_roots') {
        return Promise.resolve([]);
      }
      if (command === 'get_children') {
        return Promise.resolve([]);
      }
      return Promise.resolve(0);
    });
    mockListen.mockResolvedValue(() => {});
  });

  it('should register a global tauri://drag-drop listener', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('tauri://drag-drop', expect.any(Function));
    });
  });

  it('should call index_folder when a file is dropped', async () => {
    let dropHandler: (event: any) => void = () => {};
    mockListen.mockImplementation((event, handler) => {
      if (event === 'tauri://drag-drop') {
        dropHandler = handler;
      }
      return Promise.resolve(() => {});
    });

    render(<App />);

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('tauri://drag-drop', expect.any(Function));
    });

    // Simulate drop event
    const mockEvent = {
      payload: {
        paths: ['/path/to/dropped/file.txt'],
      },
    };

    await dropHandler(mockEvent);

    expect(mockInvoke).toHaveBeenCalledWith('index_folder', { path: '/path/to/dropped/file.txt' });
  });

  it('should work even when not in main view (e.g., Settings)', async () => {
    let dropHandler: (event: any) => void = () => {};
    mockListen.mockImplementation((event, handler) => {
      if (event === 'tauri://drag-drop') {
        dropHandler = handler;
      }
      return Promise.resolve(() => {});
    });

    const { getByTestId } = render(<App />);

    // Switch to Settings view
    const settingsBtn = getByTestId('nav-settings');
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      // Verify FileTree is NOT rendered (assuming it's only in main view)
      expect(screen.queryByTestId('file-tree-container')).toBeNull();
    });

    // Simulate drop event
    const mockEvent = {
      payload: {
        paths: ['/path/to/dropped/folder'],
      },
    };

    await dropHandler(mockEvent);

    expect(mockInvoke).toHaveBeenCalledWith('index_folder', { path: '/path/to/dropped/folder' });
  });
});
