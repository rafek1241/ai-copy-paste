import { invoke } from '@tauri-apps/api/core';

export interface SensitivePattern {
  id: string;
  name: string;
  pattern: string;
  placeholder: string;
  enabled: boolean;
  builtin: boolean;
  category: string;
}

export interface ScanResult {
  path: string;
  has_sensitive_data: boolean;
  matched_patterns: string[];
  match_count: number;
}

export async function getSensitivePatterns(): Promise<SensitivePattern[]> {
  return invoke<SensitivePattern[]>('get_sensitive_patterns');
}

export async function getSensitiveDataEnabled(): Promise<boolean> {
  return invoke<boolean>('get_sensitive_data_enabled');
}

export async function setSensitiveDataEnabled(enabled: boolean): Promise<void> {
  return invoke('set_sensitive_data_enabled', { enabled });
}

export async function getPreventSelection(): Promise<boolean> {
  return invoke<boolean>('get_prevent_selection');
}

export async function setPreventSelection(enabled: boolean): Promise<void> {
  return invoke('set_prevent_selection', { enabled });
}

export async function addCustomPattern(pattern: SensitivePattern): Promise<void> {
  return invoke('add_custom_pattern', { pattern });
}

export async function deleteCustomPattern(patternId: string): Promise<void> {
  return invoke('delete_custom_pattern', { patternId });
}

export async function togglePatternEnabled(patternId: string, enabled: boolean): Promise<void> {
  return invoke('toggle_pattern_enabled', { patternId, enabled });
}

export async function scanFilesSensitive(filePaths: string[]): Promise<ScanResult[]> {
  return invoke<ScanResult[]>('scan_files_sensitive', { filePaths });
}

export async function getSensitiveMarkedPaths(paths: string[]): Promise<string[]> {
  return invoke<string[]>('get_sensitive_marked_paths', { paths });
}

export async function validateRegexPattern(pattern: string): Promise<boolean> {
  return invoke<boolean>('validate_regex_pattern', { pattern });
}

export async function testPattern(pattern: string, testInput: string): Promise<string[]> {
  return invoke<string[]>('test_pattern', { pattern, testInput });
}