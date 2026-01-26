import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTokenCount } from '@/hooks/useTokenCount';
import * as promptsService from '@/services/prompts';
import * as tokenizerService from '@/services/tokenizer';

// Mock services
vi.mock('../services/prompts', () => ({
  getFileContents: vi.fn(),
}));

vi.mock('../services/tokenizer', () => ({
  countTokens: vi.fn(),
  countTotalTokens: vi.fn(),
}));

describe('useTokenCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with zero tokens', () => {
    const { result } = renderHook(() => useTokenCount([]));
    expect(result.current.totalTokens).toBe(0);
    expect(result.current.isCalculating).toBe(false);
  });

  it('should count tokens for selected files', async () => {
    // Mock file contents
    const mockFiles = [
      { path: 'file1.txt', content: 'Hello' },
      { path: 'file2.txt', content: 'World' },
    ];
    vi.mocked(promptsService.getFileContents).mockResolvedValue(mockFiles);
    
    // Mock tokenizer
    vi.mocked(tokenizerService.countTokens).mockReturnValue(1); // 1 token per file

    const { result } = renderHook(() => useTokenCount(['file1.txt', 'file2.txt']));

    // Should be calculating initially
    expect(result.current.isCalculating).toBe(true);

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false);
    });

    expect(result.current.totalTokens).toBe(2);
    expect(promptsService.getFileContents).toHaveBeenCalledWith(['file1.txt', 'file2.txt']);
  });

  it('should use cached values for previously counted files', async () => {
    const mockFiles1 = [{ path: 'file1.txt', content: 'Hello' }];
    vi.mocked(promptsService.getFileContents).mockResolvedValueOnce(mockFiles1);
    vi.mocked(tokenizerService.countTokens).mockReturnValue(5);

    const { result, rerender } = renderHook(({ paths }) => useTokenCount(paths), {
      initialProps: { paths: ['file1.txt'] },
    });

    await waitFor(() => {
      expect(result.current.totalTokens).toBe(5);
    });

    // Add another file
    const mockFiles2 = [{ path: 'file2.txt', content: 'World' }];
    vi.mocked(promptsService.getFileContents).mockResolvedValueOnce(mockFiles2);
    
    rerender({ paths: ['file1.txt', 'file2.txt'] });

    await waitFor(() => {
      expect(result.current.totalTokens).toBe(10); // 5 + 5
    });

    // Verify getFileContents was called only for the new file
    expect(promptsService.getFileContents).toHaveBeenCalledTimes(2);
    expect(promptsService.getFileContents).toHaveBeenLastCalledWith(['file2.txt']);
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(promptsService.getFileContents).mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useTokenCount(['error.txt']));

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false);
    });

    expect(result.current.totalTokens).toBe(0);
    expect(result.current.error).toBeDefined();
  });
});
