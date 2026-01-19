import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptBuilder } from './PromptBuilder';
import * as promptsService from '../services/prompts';
import * as assemblyService from '../services/assembly';

// Mock services
vi.mock('../services/prompts', () => ({
  getTemplates: vi.fn(),
}));

vi.mock('../services/assembly', () => ({
  assemblePrompt: vi.fn(),
}));

vi.mock('../hooks/useTokenCount', () => ({
  useTokenCount: () => ({ totalTokens: 0, isCalculating: false }),
}));

describe('PromptBuilder', () => {
  const mockTemplates = [
    { id: 'agent', name: 'Agent', description: 'Agent desc', template: '...' },
    { id: 'review', name: 'Review', description: 'Review desc', template: '...' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(promptsService.getTemplates).mockResolvedValue(mockTemplates);
    
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('should load templates on mount', async () => {
    render(<PromptBuilder selectedFileIds={[]} />);
    await waitFor(() => {
      expect(promptsService.getTemplates).toHaveBeenCalled();
      expect(screen.getByText('Agent')).toBeDefined();
    });
  });

  it('should build and copy prompt when button clicked', async () => {
    const mockResponse = {
      prompt: 'Built prompt',
      file_count: 1,
      total_chars: 100,
    };
    vi.mocked(assemblyService.assemblePrompt).mockResolvedValue(mockResponse);

    render(<PromptBuilder selectedFileIds={[1]} />);
    
    await waitFor(() => screen.getByTestId('build-prompt-btn'));
    
    fireEvent.click(screen.getByTestId('build-prompt-btn'));

    await waitFor(() => {
      expect(assemblyService.assemblePrompt).toHaveBeenCalledWith({
        templateId: 'agent',
        fileIds: [1],
        customInstructions: undefined,
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Built prompt');
      expect(screen.getByText(/Copied to Clipboard!/i)).toBeDefined();
    });
  });

  it('should disable build button when no files selected', async () => {
    render(<PromptBuilder selectedFileIds={[]} />);
    await waitFor(() => {
      const btn = screen.getByTestId('build-prompt-btn');
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });

  it('should show error if building fails', async () => {
    vi.mocked(assemblyService.assemblePrompt).mockRejectedValue(new Error('Build failed'));

    render(<PromptBuilder selectedFileIds={[1]} />);
    
    await waitFor(() => screen.getByTestId('build-prompt-btn'));
    fireEvent.click(screen.getByTestId('build-prompt-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Failed to build prompt: Error: Build failed/i)).toBeDefined();
    });
  });
});
