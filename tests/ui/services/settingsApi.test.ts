import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockInvoke } from '../setup';
import { settingsApi } from '@/services/settingsApi';

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}));

const fsMocks = vi.hoisted(() => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: dialogMocks.open,
  save: dialogMocks.save,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: fsMocks.readTextFile,
  writeTextFile: fsMocks.writeTextFile,
}));

describe('settingsApi service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads settings through invoke', async () => {
    const mockSettings = {
      excluded_extensions: ['.tmp'],
      token_limit: 123,
      default_template: 'agent',
      auto_save_history: true,
      cache_size_mb: 50,
      respect_gitignore: true,
    };

    mockInvoke.mockResolvedValue(mockSettings);

    const result = await settingsApi.loadSettings();

    expect(mockInvoke).toHaveBeenCalledWith('load_settings');
    expect(result).toEqual(mockSettings);
  });

  it('saves settings through invoke', async () => {
    const payload = {
      excluded_extensions: [],
      token_limit: 200000,
      default_template: 'agent',
      auto_save_history: true,
      cache_size_mb: 100,
      respect_gitignore: true,
    };

    await settingsApi.saveSettings(payload);

    expect(mockInvoke).toHaveBeenCalledWith('save_settings', { settings: payload });
  });

  it('exports settings via invoke + save dialog + fs write', async () => {
    mockInvoke.mockResolvedValue('{"token_limit": 1000}');
    dialogMocks.save.mockResolvedValue('/tmp/settings.json');

    const result = await settingsApi.exportSettings();

    expect(result).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('export_settings');
    expect(dialogMocks.save).toHaveBeenCalled();
    expect(fsMocks.writeTextFile).toHaveBeenCalledWith('/tmp/settings.json', '{"token_limit": 1000}');
  });

  it('returns false when export is canceled', async () => {
    mockInvoke.mockResolvedValue('{"token_limit": 1000}');
    dialogMocks.save.mockResolvedValue(null);

    const result = await settingsApi.exportSettings();

    expect(result).toBe(false);
    expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
  });

  it('imports settings via open dialog + fs read + invoke', async () => {
    dialogMocks.open.mockResolvedValue('/tmp/settings.json');
    fsMocks.readTextFile.mockResolvedValue('{"token_limit": 777}');

    const result = await settingsApi.importSettings();

    expect(result).toBe(true);
    expect(dialogMocks.open).toHaveBeenCalled();
    expect(fsMocks.readTextFile).toHaveBeenCalledWith('/tmp/settings.json');
    expect(mockInvoke).toHaveBeenCalledWith('import_settings', { jsonData: '{"token_limit": 777}' });
  });

  it('returns false when import is canceled', async () => {
    dialogMocks.open.mockResolvedValue(null);

    const result = await settingsApi.importSettings();

    expect(result).toBe(false);
    expect(fsMocks.readTextFile).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith('import_settings', expect.anything());
  });

  it('resets settings through invoke', async () => {
    await settingsApi.resetSettings();

    expect(mockInvoke).toHaveBeenCalledWith('reset_settings');
  });
});
