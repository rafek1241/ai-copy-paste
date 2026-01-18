import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Settings from './Settings';
import { vi, expect, it, describe, beforeEach } from 'vitest';
import { mockInvoke } from '../test/setup';

describe('Settings Component', () => {
  const mockSettings = {
    excluded_extensions: ['.exe', '.dll'],
    token_limit: 150000,
    default_template: 'planning',
    auto_save_history: false,
    cache_size_mb: 50,
  };

  beforeEach(() => {
    mockInvoke.mockImplementation((command, args) => {
      if (command === 'load_settings') {
        return Promise.resolve(mockSettings);
      }
      return Promise.resolve(undefined);
    });
  });

  it('should render and load settings', async () => {
    render(<Settings />);
    
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('.exe')).toBeInTheDocument();
      expect(screen.getByText('.dll')).toBeInTheDocument();
    });

    const tokenInput = screen.getByDisplayValue('150000');
    expect(tokenInput).toBeInTheDocument();
  });

  it('should add an extension', async () => {
    render(<Settings />);
    await screen.findByText('.exe');

    const input = screen.getByPlaceholderText('e.g., .exe or exe');
    const addButton = screen.getByText('Add');

    fireEvent.change(input, { target: { value: 'zip' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('.zip')).toBeInTheDocument();
    });
  });

  it('should call save_settings when Save button is clicked', async () => {
    render(<Settings />);
    await screen.findByText('.exe');

    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_settings', expect.objectContaining({
        settings: expect.objectContaining({
          token_limit: 150000
        })
      }));
    });
  });
});
