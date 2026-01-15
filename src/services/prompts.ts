import { invoke } from "@tauri-apps/api/core";

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
}

export interface BuildPromptRequest {
  template_id: string;
  custom_instructions?: string;
  file_ids: number[];
}

export interface BuildPromptResponse {
  prompt: string;
  file_count: number;
  total_chars: number;
}

export interface FileContent {
  path: string;
  content: string;
}

/**
 * Get all available prompt templates
 */
export async function getTemplates(): Promise<PromptTemplate[]> {
  return await invoke<PromptTemplate[]>("get_templates");
}

/**
 * Build a prompt from selected files and template
 */
export async function buildPromptFromFiles(
  request: BuildPromptRequest
): Promise<BuildPromptResponse> {
  return await invoke<BuildPromptResponse>("build_prompt_from_files", {
    request,
  });
}

/**
 * Get content of a single file
 */
export async function getFileContent(fileId: number): Promise<FileContent> {
  return await invoke<FileContent>("get_file_content", { fileId });
}

/**
 * Get content of multiple files
 */
export async function getFileContents(
  fileIds: number[]
): Promise<FileContent[]> {
  return await invoke<FileContent[]>("get_file_contents", { fileIds });
}
