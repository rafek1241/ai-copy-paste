import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockInvoke } from '../test/setup';
import {
  getTemplates,
  buildPromptFromFiles,
  getFileContent,
  getFileContents,
  type PromptTemplate,
  type BuildPromptRequest,
  type BuildPromptResponse,
  type FileContent,
} from './prompts';

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
    it('should build prompt with files', async () => {
      const request: BuildPromptRequest = {
        template_id: 'agent',
        custom_instructions: 'Review this code',
        file_ids: [1, 2, 3],
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
        file_ids: [1],
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
    it('should fetch single file content', async () => {
      const mockContent: FileContent = {
        path: '/test/file.txt',
        content: 'File content here',
      };

      mockInvoke.mockResolvedValue(mockContent);

      const result = await getFileContent(1);

      expect(mockInvoke).toHaveBeenCalledWith('get_file_content', {
        fileId: 1,
      });
      expect(result).toEqual(mockContent);
    });
  });

  describe('getFileContents', () => {
    it('should fetch multiple file contents', async () => {
      const mockContents: FileContent[] = [
        { path: '/test/file1.txt', content: 'Content 1' },
        { path: '/test/file2.txt', content: 'Content 2' },
      ];

      mockInvoke.mockResolvedValue(mockContents);

      const result = await getFileContents([1, 2]);

      expect(mockInvoke).toHaveBeenCalledWith('get_file_contents', {
        fileIds: [1, 2],
      });
      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('/test/file1.txt');
    });

    it('should handle empty array', async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await getFileContents([]);

      expect(result).toEqual([]);
    });
  });
});
