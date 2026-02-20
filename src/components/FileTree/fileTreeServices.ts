import { invoke } from "@tauri-apps/api/core";
import type { FileEntry, SearchResult } from "../../types";

export function getChildrenEntries(parentPath: string | null): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("get_children", { parentPath });
}

export function searchIndexedPaths(pattern: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_path", { pattern });
}

export async function getSensitivePreventionSettings(): Promise<{
  sensitiveEnabled: boolean;
  preventSelectionEnabled: boolean;
}> {
  const [sensitiveEnabled, preventSelectionEnabled] = await Promise.all([
    invoke<boolean>("get_sensitive_data_enabled"),
    invoke<boolean>("get_prevent_selection"),
  ]);

  return { sensitiveEnabled, preventSelectionEnabled };
}

export function getSensitiveMarkedPaths(paths: string[]): Promise<string[]> {
  return invoke<string[]>("get_sensitive_marked_paths", { paths });
}
