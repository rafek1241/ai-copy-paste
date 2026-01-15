import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractDocxText } from './extraction';

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
  default: {},
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
  version: '3.0.0',
}));

describe('extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractDocxText', () => {
    it('should extract text from DOCX buffer successfully', async () => {
      const mammoth = await import('mammoth');
      const mockText = 'This is extracted text from DOCX';

      vi.mocked(mammoth.default.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      });

      const buffer = new ArrayBuffer(100);
      const result = await extractDocxText(buffer);

      expect(result.text).toBe(mockText);
      expect(result.error).toBeUndefined();
    });

    it('should handle DOCX extraction errors', async () => {
      const mammoth = await import('mammoth');
      const errorMessage = 'Failed to parse DOCX';

      vi.mocked(mammoth.default.extractRawText).mockRejectedValue(
        new Error(errorMessage)
      );

      const buffer = new ArrayBuffer(100);
      const result = await extractDocxText(buffer);

      expect(result.text).toBe('');
      expect(result.error).toBe(errorMessage);
    });

    it('should handle DOCX extraction with warnings', async () => {
      const mammoth = await import('mammoth');
      const mockText = 'Text with warnings';
      const warnings = [{ message: 'Some warning', type: 'warning' }];

      vi.mocked(mammoth.default.extractRawText).mockResolvedValue({
        value: mockText,
        messages: warnings as any,
      });

      const buffer = new ArrayBuffer(100);
      const result = await extractDocxText(buffer);

      expect(result.text).toBe(mockText);
      expect(result.error).toBeUndefined();
    });
  });
});
