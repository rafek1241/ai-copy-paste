import type { FileEntry, TreeNode } from "../../types";
import type { FlatTreeItem } from "./fileTreeTypes";
import { getCommonAncestorPath } from "./fileTreePathUtils";

export interface NormalizedFileEntry extends FileEntry {
  raw_path: string;
  raw_parent_path: string | null;
}

interface BuildRootTreeParams {
  entries: NormalizedFileEntry[];
  getParentDirectoryPath: (path: string) => string | null;
  getNameFromPath: (path: string) => string;
}

export interface BuildRootTreeResult {
  nodesMap: Record<string, TreeNode>;
  rootPaths: string[];
  rootEntries: NormalizedFileEntry[];
  rootAnchor: string | null;
}

interface ComputePathsToExpandParams {
  prevExpandedPaths: Set<string>;
  prevCheckedFilePaths: Set<string>;
  isReIndex: boolean;
  rootEntries: NormalizedFileEntry[];
  newNodesMap: Record<string, TreeNode>;
  prevNodesMap: Record<string, TreeNode>;
  getParentDirectoryPath: (path: string) => string | null;
}

export function buildFlatTree(
  rootPaths: string[],
  map: Record<string, TreeNode>,
  includeNode: (node: TreeNode) => boolean
): FlatTreeItem[] {
  const result: FlatTreeItem[] = [];

  const traverse = (paths: string[], level: number) => {
    for (const path of paths) {
      const node = map[path];
      if (!node) continue;
      if (!node.is_dir && !includeNode(node)) continue;

      result.push({ path, level });

      if (node.expanded && node.childPaths) {
        traverse(node.childPaths, level + 1);
      }
    }
  };

  traverse(rootPaths, 0);
  return result;
}

export function updateChildrenSelection(
  map: Record<string, TreeNode>,
  nodePath: string,
  checked: boolean
): void {
  const node = map[nodePath];
  if (!node) return;

  map[nodePath] = { ...node, checked, indeterminate: false };

  if (node.childPaths) {
    node.childPaths.forEach((childPath) => {
      updateChildrenSelection(map, childPath, checked);
    });
  }
}

export function updateParentSelection(
  map: Record<string, TreeNode>,
  parentPath: string | null
): void {
  if (parentPath === null) return;

  const parent = map[parentPath];
  if (!parent || !parent.childPaths) return;

  const children = parent.childPaths.map((path) => map[path]).filter(Boolean);
  const checkedCount = children.filter((node) => node.checked).length;
  const indeterminateCount = children.filter((node) => node.indeterminate).length;

  const isAllChecked = checkedCount === children.length && children.length > 0;
  const isIndeterminate = (checkedCount > 0 && !isAllChecked) || indeterminateCount > 0;

  if (parent.checked !== isAllChecked || parent.indeterminate !== isIndeterminate) {
    map[parentPath] = { ...parent, checked: isAllChecked, indeterminate: isIndeterminate };
    updateParentSelection(map, parent.parent_path);
  }
}

export function collectSelectedPaths(map: Record<string, TreeNode>): string[] {
  const selectedPaths: string[] = [];

  for (const node of Object.values(map)) {
    if (node.checked && !node.is_dir) {
      selectedPaths.push(node.path);
    }
  }

  return selectedPaths;
}

export function collectDescendantFilePaths(
  map: Record<string, TreeNode>,
  startPath: string
): string[] {
  const rootNode = map[startPath];
  if (!rootNode) return [];
  if (!rootNode.is_dir) return [startPath];

  const result: string[] = [];
  const stack: string[] = [...(rootNode.childPaths ?? [])];

  while (stack.length > 0) {
    const currentPath = stack.pop()!;
    const currentNode = map[currentPath];
    if (!currentNode) continue;

    if (currentNode.is_dir) {
      if (currentNode.childPaths?.length) {
        stack.push(...currentNode.childPaths);
      }
    } else {
      result.push(currentPath);
    }
  }

  return result;
}

export function clearSelectionMap(
  map: Record<string, TreeNode>
): { map: Record<string, TreeNode>; hasChanges: boolean } {
  const nextMap = { ...map };
  let hasChanges = false;

  Object.keys(nextMap).forEach((path) => {
    const node = nextMap[path];
    if (node && (node.checked || node.indeterminate)) {
      nextMap[path] = { ...node, checked: false, indeterminate: false };
      hasChanges = true;
    }
  });

  return { map: nextMap, hasChanges };
}

export function buildRootTreeState({
  entries,
  getParentDirectoryPath,
  getNameFromPath,
}: BuildRootTreeParams): BuildRootTreeResult {
  const rootEntries = entries;
  const rootDirs = rootEntries.filter((entry) => entry.is_dir);
  const rootFiles = rootEntries.filter((entry) => !entry.is_dir);

  let rootAnchor: string | null = null;
  if (rootDirs.length > 0 && rootFiles.length === 0) {
    rootAnchor = getCommonAncestorPath(rootDirs.map((entry) => entry.path));
  } else if (rootFiles.length > 0 && rootDirs.length === 0) {
    const parentPaths = rootFiles.map((entry) => entry.parent_path).filter((path): path is string => !!path);
    if (parentPaths.length === rootFiles.length) {
      const uniqueParents = new Set(parentPaths);
      if (uniqueParents.size === 1 && parentPaths.length > 0) {
        rootAnchor = parentPaths[0];
      } else {
        const commonFileAncestor = getCommonAncestorPath(rootFiles.map((entry) => entry.path));
        if (commonFileAncestor) {
          rootAnchor = getParentDirectoryPath(commonFileAncestor) ?? commonFileAncestor;
        }
      }
    }
  } else if (rootEntries.length > 0) {
    const commonMixedAncestor = getCommonAncestorPath(rootEntries.map((entry) => entry.path));
    if (commonMixedAncestor) {
      rootAnchor = getParentDirectoryPath(commonMixedAncestor) ?? commonMixedAncestor;
    }
  }

  const newNodesMap: Record<string, TreeNode> = {};

  for (const entry of rootEntries) {
    newNodesMap[entry.path] = {
      ...entry,
      expanded: false,
      checked: false,
      indeterminate: false,
      hasChildren: entry.is_dir,
      childPaths: [],
    };
  }

  const ensureSyntheticNode = (path: string, parentPath: string | null) => {
    if (newNodesMap[path]) return;

    newNodesMap[path] = {
      path,
      parent_path: parentPath,
      raw_path: path,
      raw_parent_path: parentPath,
      name: getNameFromPath(path),
      size: null,
      mtime: null,
      is_dir: true,
      token_count: null,
      fingerprint: null,
      child_count: null,
      expanded: false,
      checked: false,
      indeterminate: false,
      hasChildren: true,
      childPaths: [],
    };
  };

  const ensureAncestorChain = (startPath: string | null) => {
    let currentPath = startPath;

    while (currentPath) {
      const parentPath = getParentDirectoryPath(currentPath);
      const isRoot = rootAnchor ? currentPath === rootAnchor : parentPath === null;
      ensureSyntheticNode(currentPath, isRoot ? null : parentPath);
      if (isRoot) break;
      currentPath = parentPath;
    }
  };

  for (const entry of rootEntries) {
    ensureAncestorChain(entry.parent_path ?? null);
  }

  if (rootAnchor) {
    ensureSyntheticNode(rootAnchor, null);
  }

  const allNodes = Object.values(newNodesMap);

  for (const node of allNodes) {
    if (node.is_dir) {
      node.childPaths = [];
    }
  }

  const childPathSets = new Map<string, Set<string>>();
  for (const node of allNodes) {
    const parentPath = node.parent_path;
    if (!parentPath || !newNodesMap[parentPath]) continue;

    const parent = newNodesMap[parentPath];
    if (!parent.is_dir) continue;

    let childSet = childPathSets.get(parentPath);
    if (!childSet) {
      childSet = new Set(parent.childPaths);
      childPathSets.set(parentPath, childSet);
    }

    if (!childSet.has(node.path)) {
      childSet.add(node.path);
      parent.childPaths!.push(node.path);
    }
  }

  for (const node of allNodes) {
    if (node.is_dir && node.childPaths) {
      node.hasChildren = node.childPaths.length > 0 || node.hasChildren;
    }
  }

  const rootPaths: string[] = [];
  if (rootAnchor) {
    rootPaths.push(rootAnchor);
  } else {
    const seenRoots = new Set<string>();
    Object.values(newNodesMap).forEach((node) => {
      const parentPath = node.parent_path;
      if (!parentPath || !newNodesMap[parentPath]) {
        if (!seenRoots.has(node.path)) {
          seenRoots.add(node.path);
          rootPaths.push(node.path);
        }
      }
    });
  }

  return {
    nodesMap: newNodesMap,
    rootPaths,
    rootEntries,
    rootAnchor,
  };
}

export function computePathsToExpand({
  prevExpandedPaths,
  prevCheckedFilePaths,
  isReIndex,
  rootEntries,
  newNodesMap,
  prevNodesMap,
  getParentDirectoryPath,
}: ComputePathsToExpandParams): Set<string> {
  const pathsToExpand = new Set<string>(prevExpandedPaths);

  const addAncestorsToExpand = (path: string | null) => {
    let currentPath = path;
    while (currentPath) {
      pathsToExpand.add(currentPath);
      currentPath = getParentDirectoryPath(currentPath);
    }
  };

  Array.from(prevExpandedPaths).forEach(addAncestorsToExpand);
  Array.from(prevCheckedFilePaths).forEach(addAncestorsToExpand);

  if (isReIndex) {
    Object.keys(newNodesMap).forEach((path) => {
      if (!prevNodesMap[path]) {
        const node = newNodesMap[path];
        if (node.is_dir) {
          pathsToExpand.add(path);
        }
        addAncestorsToExpand(node.parent_path);
      }
    });
  } else if (rootEntries.length > 0) {
    rootEntries.forEach((entry) => {
      if (!entry.is_dir) {
        addAncestorsToExpand(entry.parent_path);
      }
    });

    const rootEntryPaths = new Set(rootEntries.map((entry) => entry.path));
    Object.values(newNodesMap).forEach((node) => {
      if (node.is_dir && !rootEntryPaths.has(node.path)) {
        pathsToExpand.add(node.path);
      }
    });
  }

  return pathsToExpand;
}
