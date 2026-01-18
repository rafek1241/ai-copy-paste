export interface FileEntry {
  id: number;
  parent_id: number | null;
  name: string;
  path: string;
  size: number | null;
  mtime: number | null;
  is_dir: boolean;
  token_count: number | null;
  fingerprint: string | null;
}

export interface TreeNode extends FileEntry {
  expanded: boolean;
  checked: boolean;
  indeterminate: boolean;
  children?: TreeNode[];
  childIds?: number[];
  hasChildren?: boolean;
}

export interface IndexProgress {
  processed: number;
  total_estimate: number;
  current_path: string;
  errors: number;
}