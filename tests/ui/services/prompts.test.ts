import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockInvoke } from '../setup';
import {
  getTemplates,
  buildPromptFromFiles,
  getFileContent,
  getFileContents,
  type PromptTemplate,
  type BuildPromptRequest,
  type BuildPromptResponse,
  type FileContent,
} from '@/services/prompts';

describe('prompts service', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  describe('getTemplates', () => {
    it('should fetch templates from backend', async () => {
      const mockTemplates: PromptTemplate[] = [
        {
          id: 'agent',
          name: 'Agent Task',
          description: 'Task for AI agent',
          template: 'Complete this task: {{INSTRUCTIONS}}',
        },
      ];

      mockInvoke.mockResolvedValue(mockTemplates);

      const result = await getTemplates();

      expect(mockInvoke).toHaveBeenCalledWith('get_templates');
      expect(result).toEqual(mockTemplates);
    });

    it('should handle errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(getTemplates()).rejects.toThrow('Database error');
    });
  });

  describe('buildPromptFromFiles', () => {
    it('should build prompt with file paths', async () => {
      const request: BuildPromptRequest = {
        template_id: 'agent',
        custom_instructions: 'Review this code',
        file_paths: ['/test/file1.ts', '/test/file2.ts', '/test/file3.ts'],
      };

      const mockResponse: BuildPromptResponse = {
        prompt: 'Complete this task: Review this code\n\nFiles:\n...',
        file_count: 3,
        total_chars: 1500,
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const result = await buildPromptFromFiles(request);

      expect(mockInvoke).toHaveBeenCalledWith('build_prompt_from_files', {
        request,
      });
      expect(result).toEqual(mockResponse);
      expect(result.file_count).toBe(3);
    });

    it('should work without custom instructions', async () => {
      const request: BuildPromptRequest = {
        template_id: 'agent',
        file_paths: ['/test/file.ts'],
      };

      mockInvoke.mockResolvedValue({
        prompt: 'Default prompt',
        file_count: 1,
        total_chars: 500,
      });

      const result = await buildPromptFromFiles(request);

      expect(result.file_count).toBe(1);
    });
  });

  describe('getFileContent', () => {
    it('should fetch single file content by path', async () => {
      const mockFile = { path: '/test/file.ts', content: 'test' };
      mockInvoke.mockResolvedValue(mockFile);

      const result = await getFileContent('/test/file.ts');

      expect(mockInvoke).toHaveBeenCalledWith('get_file_content', {
        filePath: '/test/file.ts',
      });
      expect(result).toEqual(mockFile);
    });
  });

  describe('getFileContents', () => {
    it('should fetch multiple file contents by paths', async () => {
      const mockFiles = [
        { path: '/test/file1.ts', content: 'test1' },
        { path: '/test/file2.ts', content: 'test2' },
      ];
      mockInvoke.mockResolvedValue(mockFiles);

      const result = await getFileContents(['/test/file1.ts', '/test/file2.ts']);

      expect(mockInvoke).toHaveBeenCalledWith('get_file_contents', {
        filePaths: ['/test/file1.ts', '/test/file2.ts'],
      });
      expect(result).toEqual(mockFiles);
    });

    it('should handle empty array', async () => {
      mockInvoke.mockResolvedValue([]);
      const result = await getFileContents([]);
      expect(result).toEqual([]);
    });
  });
});
