import { buildPromptFromFiles, BuildPromptResponse } from './prompts';

export interface AssemblyRequest {
  templateId: string;
  fileIds: number[];
  customInstructions?: string;
}

/**
 * Orchestrates the assembly of the final prompt.
 * Currently delegates to the backend, but can be expanded to handle 
 * client-side text extraction (PDF, DOCX) in the future.
 */
export async function assemblePrompt(request: AssemblyRequest): Promise<BuildPromptResponse> {
  return await buildPromptFromFiles({
    template_id: request.templateId,
    file_ids: request.fileIds,
    custom_instructions: request.customInstructions,
  });
}
