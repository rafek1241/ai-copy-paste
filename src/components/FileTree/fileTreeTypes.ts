import type React from "react";
import type { TreeNode } from "../../types";

export type FilterType = "ALL" | "SRC" | "DOCS";

export interface FileTreeState {
  nodesMap: Record<string, TreeNode>;
  rootPaths: string[];
  filterType: FilterType;
  isLoading: boolean;
}

export interface FlatTreeItem {
  path: string;
  level: number;
}

export type FileTreeAction =
  | { type: "SET_NODES"; payload: { map: Record<string, TreeNode>; rootPaths: string[] } }
  | { type: "UPDATE_NODE"; payload: TreeNode }
  | { type: "UPDATE_NODES_MAP"; payload: Record<string, TreeNode> }
  | { type: "SET_FILTER"; payload: FilterType }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_ALL" };

export interface FileTreeStateContextValue {
  state: FileTreeState;
  flatTree: FlatTreeItem[];
}

export interface FileTreeActionsContextValue {
  dispatch: React.Dispatch<FileTreeAction>;
  loadRootEntries: () => Promise<void>;
  loadChildren: (nodePath: string) => Promise<TreeNode[]>;
  toggleExpand: (nodePath: string) => Promise<void>;
  toggleCheck: (nodePath: string, checked: boolean) => Promise<void>;
  clearSelection: () => void;
  setFilter: (filter: FilterType) => void;
  clearAll: () => void;
  getSelectedPaths: () => string[];
  applyInitialSelection: (paths: string[]) => void;
}
