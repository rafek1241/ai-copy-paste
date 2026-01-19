import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTokenCount } from './useTokenCount';
import * as promptsService from '../services/prompts';
import * as tokenizerService from '../services/tokenizer';

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
      { id: 1, path: 'file1.txt', content: 'Hello' },
      { id: 2, path: 'file2.txt', content: 'World' },
    ];
    vi.mocked(promptsService.getFileContents).mockResolvedValue(mockFiles);
    
    // Mock tokenizer
    vi.mocked(tokenizerService.countTokens).mockReturnValue(1); // 1 token per file

    const { result } = renderHook(() => useTokenCount([1, 2]));

    // Should be calculating initially
    expect(result.current.isCalculating).toBe(true);

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false);
    });

    expect(result.current.totalTokens).toBe(2);
    expect(promptsService.getFileContents).toHaveBeenCalledWith([1, 2]);
  });

  it('should use cached values for previously counted files', async () => {
    const mockFiles1 = [{ id: 1, path: 'file1.txt', content: 'Hello' }];
    vi.mocked(promptsService.getFileContents).mockResolvedValueOnce(mockFiles1);
    vi.mocked(tokenizerService.countTokens).mockReturnValue(5);

    const { result, rerender } = renderHook(({ ids }) => useTokenCount(ids), {
      initialProps: { ids: [1] },
    });

    await waitFor(() => {
      expect(result.current.totalTokens).toBe(5);
    });

    // Add another file
    const mockFiles2 = [{ id: 2, path: 'file2.txt', content: 'World' }];
    vi.mocked(promptsService.getFileContents).mockResolvedValueOnce(mockFiles2);
    
    rerender({ ids: [1, 2] });

    await waitFor(() => {
      expect(result.current.totalTokens).toBe(10); // 5 + 5
    });

    // Verify getFileContents was called only for the new file
    expect(promptsService.getFileContents).toHaveBeenCalledTimes(2);
    expect(promptsService.getFileContents).toHaveBeenLastCalledWith([2]);
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(promptsService.getFileContents).mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useTokenCount([1]));

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false);
    });

    expect(result.current.totalTokens).toBe(0);
    expect(result.current.error).toBeDefined();
  });
});
