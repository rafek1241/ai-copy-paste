export interface FileEntry {
  path: string;  // Primary key
  parent_path: string | null;
  name: string;
  size: number | null;
  mtime: number | null;
  is_dir: boolean;
  token_count: number | null;
  fingerprint: string | null;
  child_count: number | null;
}

export interface TreeNode extends FileEntry {
  expanded: boolean;
  checked: boolean;
  indeterminate: boolean;
  raw_path?: string;
  raw_parent_path?: string | null;
  children?: TreeNode[];
  childPaths?: string[];  // Child paths instead of IDs
  hasChildren?: boolean;
}

export interface SearchResult extends FileEntry {
  score: number;
}

export interface IndexProgress {
  processed: number;
  total_estimate: number;
  current_path: string;
  errors: number;
}

export interface UpdateInfo {
  version: string;
  current_version: string;
  release_notes: string;
  pub_date: string;
  download_url: string;
  is_portable: boolean;
  update_available: boolean;
}

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error'
  | 'scheduled';

