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

  it('should build and copy prompt when called via ref', async () => {
    const mockResponse = {
      prompt: 'Built prompt',
      file_count: 1,
      total_chars: 100,
    };
    vi.mocked(assemblyService.assemblePrompt).mockResolvedValue(mockResponse);

    let builderRef: any = null;
    render(
      <PromptBuilder
        selectedFileIds={[1]}
        ref={(ref) => { builderRef = ref; }}
      />
    );

    // Wait for templates to load
    await waitFor(() => expect(promptsService.getTemplates).toHaveBeenCalled());

    // Trigger build
    await builderRef?.buildAndCopy();

    expect(assemblyService.assemblePrompt).toHaveBeenCalledWith({
      templateId: 'custom',
      fileIds: [1],
      customInstructions: "\n\n---CONTEXT:\n\n{{files}}",
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Built prompt');
  });

  it('should show error when no files selected', async () => {
    let builderRef: any = null;
    render(
      <PromptBuilder
        selectedFileIds={[]}
        ref={(ref) => { builderRef = ref; }}
      />
    );

    await builderRef?.buildAndCopy();

    await waitFor(() => {
      expect(screen.getByText(/Please select at least one file/i)).toBeDefined();
    });
  });

  it('should show error if building fails', async () => {
    vi.mocked(assemblyService.assemblePrompt).mockRejectedValue(new Error('Build failed'));

    let builderRef: any = null;
    render(
      <PromptBuilder
        selectedFileIds={[1]}
        ref={(ref) => { builderRef = ref; }}
      />
    );

    // Wait for templates to load
    await waitFor(() => expect(promptsService.getTemplates).toHaveBeenCalled());

    try {
      await builderRef?.buildAndCopy();
    } catch (e) {
      // Expected
    }

    await waitFor(() => {
      expect(screen.getByText(/Failed to build prompt: Error: Build failed/i)).toBeDefined();
    });
  });
});
