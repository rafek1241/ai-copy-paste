import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '@/services/clipboard';

const pluginMocks = vi.hoisted(() => ({
  writeText: vi.fn(),
  readText: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: pluginMocks.writeText,
  readText: pluginMocks.readText,
}));

describe('clipboard service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (window as any).__TAURI__ = {
      core: {},
      event: {},
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it('falls back to navigator clipboard when Tauri plugin write fails', async () => {
    const pluginError = new Error('plugin write failed');
    const fallbackWrite = vi.fn().mockResolvedValue(undefined);

    pluginMocks.writeText.mockRejectedValue(pluginError);
    Object.assign(navigator, {
      clipboard: {
        writeText: fallbackWrite,
      },
    });

    await expect(copyToClipboard('hello world')).resolves.toBeUndefined();

    expect(pluginMocks.writeText).toHaveBeenCalledWith('hello world');
    expect(fallbackWrite).toHaveBeenCalledWith('hello world');
  });

  it('includes plugin and fallback errors when both writes fail in Tauri runtime', async () => {
    pluginMocks.writeText.mockRejectedValue(new Error('plugin fail'));

    const fallbackError = new Error('fallback fail');
    const fallbackWrite = vi.fn().mockRejectedValue(fallbackError);
    Object.assign(navigator, {
      clipboard: {
        writeText: fallbackWrite,
      },
    });

    const thrown = await copyToClipboard('hello world').catch((error) => error as Error);

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toContain('Clipboard write failed in Tauri runtime');
    expect(thrown.message).toContain('plugin: Error: plugin fail');
    expect(thrown.message).toContain('browser fallback: Error: fallback fail');
    expect(pluginMocks.writeText).toHaveBeenCalledWith('hello world');
    expect(fallbackWrite).toHaveBeenCalledWith('hello world');
  });
});