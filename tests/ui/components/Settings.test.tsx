import { screen, waitFor, fireEvent } from '@testing-library/react';
import { render } from '../test-utils';
import Settings from '@/components/Settings';
import { expect, it, describe, beforeEach, vi } from 'vitest';
import { mockInvoke } from '../setup';

describe('Settings Component', () => {
  const mockSettings = {
    excluded_extensions: ['.exe', '.dll'],
    token_limit: 150000,
    default_template: 'planning',
    auto_save_history: false,
    cache_size_mb: 50,
    respect_gitignore: true,
  };

  let settingsRef: { save: () => Promise<void>; isSaving: boolean } | null = null;

  beforeEach(() => {
    mockInvoke.mockImplementation((command, args) => {
      if (command === 'load_settings') {
        return Promise.resolve(mockSettings);
      }
      return Promise.resolve(undefined);
    });
    settingsRef = null;
  });

  it('should render and load settings', async () => {
    const handleSavingChange = vi.fn();
    render(<Settings onSavingChange={handleSavingChange} />);

    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('.exe')).toBeInTheDocument();
      expect(screen.getByText('.dll')).toBeInTheDocument();
    });

    const tokenInput = screen.getByDisplayValue('150000');
    expect(tokenInput).toBeInTheDocument();
  });

  it('should add an extension', async () => {
    const handleSavingChange = vi.fn();
    render(<Settings onSavingChange={handleSavingChange} />);
    await screen.findByText('.exe');

    const input = screen.getByPlaceholderText('e.g. .exe');
    const addButton = screen.getByText('ADD');

    fireEvent.change(input, { target: { value: 'zip' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('.zip')).toBeInTheDocument();
    });
  });

  it('should render gitignore toggle', async () => {
    const handleSavingChange = vi.fn();
    render(<Settings onSavingChange={handleSavingChange} />);
    await screen.findByText('.exe');

    expect(screen.getByText('Respect .gitignore Rules')).toBeInTheDocument();
    expect(screen.getByText(/Automatically exclude files matching .gitignore patterns/i)).toBeInTheDocument();
  });

  it('should toggle gitignore setting', async () => {
    const handleSavingChange = vi.fn();
    render(<Settings onSavingChange={handleSavingChange} />);
    await screen.findByText('.exe');

    const gitignoreToggle = screen.getByText('Respect .gitignore Rules').closest('label')?.querySelector('input');
    expect(gitignoreToggle).toBeTruthy();

    if (gitignoreToggle) {
      expect(gitignoreToggle).toBeChecked();
      fireEvent.click(gitignoreToggle);
      expect(gitignoreToggle).not.toBeChecked();
    }
  });
});
