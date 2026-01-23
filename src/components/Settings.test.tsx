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
    respect_gitignore: true,
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

    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();

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

    const input = screen.getByPlaceholderText('e.g. .exe');
    const addButton = screen.getByText('ADD');

    fireEvent.change(input, { target: { value: 'zip' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('.zip')).toBeInTheDocument();
    });
  });

  it('should call save_settings when Save button is clicked', async () => {
    render(<Settings />);
    await screen.findByText('.exe');

    const saveButton = screen.getByText('SAVE CONFIGURATION');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_settings', expect.objectContaining({
        settings: expect.objectContaining({
          token_limit: 150000
        })
      }));
    });
  });

  it('should render gitignore toggle', async () => {
    render(<Settings />);
    await screen.findByText('.exe');

    expect(screen.getByText('Respect .gitignore Rules')).toBeInTheDocument();
    expect(screen.getByText(/Automatically exclude files matching .gitignore patterns/i)).toBeInTheDocument();
  });

  it('should toggle gitignore setting', async () => {
    render(<Settings />);
    await screen.findByText('.exe');

    const gitignoreToggle = screen.getByText('Respect .gitignore Rules').closest('label')?.querySelector('input');
    expect(gitignoreToggle).toBeTruthy();

    if (gitignoreToggle) {
      expect(gitignoreToggle).toBeChecked();
      fireEvent.click(gitignoreToggle);
      expect(gitignoreToggle).not.toBeChecked();
    }
  });

  it('should save gitignore setting correctly', async () => {
    render(<Settings />);
    await screen.findByText('.exe');

    const saveButton = screen.getByText('SAVE CONFIGURATION');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_settings', expect.objectContaining({
        settings: expect.objectContaining({
          respect_gitignore: true
        })
      }));
    });
  });
});
