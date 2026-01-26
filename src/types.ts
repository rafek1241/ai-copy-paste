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
  children?: TreeNode[];
  childPaths?: string[];  // Child paths instead of IDs
  hasChildren?: boolean;
}

export interface IndexProgress {
  processed: number;
  total_estimate: number;
  current_path: string;
  errors: number;
}