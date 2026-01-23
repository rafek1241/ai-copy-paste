import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assemblePrompt } from './assembly';
import * as promptsService from './prompts';
import * as extractionService from './extraction';

vi.mock('./prompts', () => ({
  getFileContents: vi.fn(),
  buildPromptFromFiles: vi.fn(),
}));

vi.mock('./extraction', () => ({
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
      fileIds: [1, 2],
      customInstructions: 'test',
    });

    expect(promptsService.buildPromptFromFiles).toHaveBeenCalledWith({
      template_id: 'agent',
      file_ids: [1, 2],
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
