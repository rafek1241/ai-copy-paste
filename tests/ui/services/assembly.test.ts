import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assemblePrompt } from '@/services/assembly';
import * as promptsService from '@/services/prompts';
import * as extractionService from '@/services/extraction';

vi.mock('@/services/prompts', () => ({
  getFileContents: vi.fn(),
  buildPromptFromFiles: vi.fn(),
}));

vi.mock('@/services/extraction', () => ({
  extractText: vi.fn(),
}));

describe('assembly service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should assemble prompt for plain text files using backend', async () => {
    const mockResponse = {
      prompt: 'Assembled prompt',
      file_count: 2,
      total_chars: 100,
    };
    vi.mocked(promptsService.buildPromptFromFiles).mockResolvedValue(mockResponse);

    const result = await assemblePrompt({
      templateId: 'agent',
      filePaths: ['/test/1', '/test/2'],
      customInstructions: 'test',
    });

    expect(promptsService.buildPromptFromFiles).toHaveBeenCalledWith({
      template_id: 'agent',
      file_paths: ['/test/1', '/test/2'],
      custom_instructions: 'test',
    });
    expect(result.prompt).toBe('Assembled prompt');
  });

  // Future test for PDF/DOCX integration
  /*
  it('should handle PDF files by extracting text in frontend', async () => {
    // ...
  });
  */
});
