import { describe, expect, it } from "vitest";
import { fileTreeReducer, initialFileTreeState } from "@/components/FileTree/fileTreeReducer";
import { matchesExtensionFilter } from "@/components/FileTree/fileTreeFilterUtils";
import { getNameFromPath, getParentDirectoryPath, normalizePath } from "@/components/FileTree/fileTreePathUtils";
import {
  buildFlatTree,
  buildRootTreeState,
  clearSelectionMap,
  computePathsToExpand,
  collectDescendantFilePaths,
  collectSelectedPaths,
  updateChildrenSelection,
  updateParentSelection,
} from "@/components/FileTree/fileTreeTreeUtils";
import type { TreeNode } from "@/types";

const makeNode = (overrides: Partial<TreeNode>): TreeNode => ({
  path: "/node",
  parent_path: null,
  name: "node",
  size: null,
  mtime: null,
  is_dir: false,
  token_count: null,
  fingerprint: null,
  child_count: null,
  expanded: false,
  checked: false,
  indeterminate: false,
  childPaths: [],
  hasChildren: false,
  ...overrides,
});

describe("fileTreeReducer", () => {
  it("handles SET_NODES and CLEAR_ALL", () => {
    const file = makeNode({ path: "/root/file.ts", parent_path: "/root", name: "file.ts" });
    const dir = makeNode({ path: "/root", is_dir: true, name: "root", hasChildren: true, childPaths: [file.path] });

    const updated = fileTreeReducer(initialFileTreeState, {
      type: "SET_NODES",
      payload: {
        map: { [dir.path]: dir, [file.path]: file },
        rootPaths: [dir.path],
      },
    });

    expect(updated.rootPaths).toEqual(["/root"]);
    expect(Object.keys(updated.nodesMap)).toHaveLength(2);

    const cleared = fileTreeReducer(updated, { type: "CLEAR_ALL" });
    expect(cleared).toEqual(initialFileTreeState);
  });

  it("updates filter and loading state", () => {
    const withFilter = fileTreeReducer(initialFileTreeState, { type: "SET_FILTER", payload: "SRC" });
    const withLoading = fileTreeReducer(withFilter, { type: "SET_LOADING", payload: true });

    expect(withFilter.filterType).toBe("SRC");
    expect(withLoading.isLoading).toBe(true);
  });
});

describe("path/filter/tree utils", () => {
  it("normalizes Windows paths and derives parent/name", () => {
    expect(normalizePath("C:\\Users\\Me\\project\\file.ts")).toBe("C:/Users/Me/project/file.ts");
    expect(normalizePath("C:/")).toBe("C:");
    expect(getParentDirectoryPath("C:\\Users\\Me\\project\\file.ts")).toBe("C:/Users/Me/project");
    expect(getNameFromPath("C:\\Users\\Me\\project\\file.ts")).toBe("file.ts");
  });

  it("matches extension filter with O(1) set lookups", () => {
    const srcNode = makeNode({ path: "/root/file.ts", name: "file.ts" });
    const docsNode = makeNode({ path: "/root/readme.md", name: "readme.md" });
    const dirNode = makeNode({ path: "/root", name: "root", is_dir: true });

    expect(matchesExtensionFilter(srcNode, "SRC")).toBe(true);
    expect(matchesExtensionFilter(srcNode, "DOCS")).toBe(false);
    expect(matchesExtensionFilter(docsNode, "DOCS")).toBe(true);
    expect(matchesExtensionFilter(dirNode, "DOCS")).toBe(true);
  });

  it("builds memoizable flat tree honoring expansion and filter predicate", () => {
    const root = makeNode({ path: "/root", is_dir: true, name: "root", expanded: true, childPaths: ["/root/a.ts", "/root/readme.md"] });
    const src = makeNode({ path: "/root/a.ts", parent_path: "/root", name: "a.ts" });
    const docs = makeNode({ path: "/root/readme.md", parent_path: "/root", name: "readme.md" });

    const all = buildFlatTree([root.path], { [root.path]: root, [src.path]: src, [docs.path]: docs }, () => true);
    const onlySrc = buildFlatTree([root.path], { [root.path]: root, [src.path]: src, [docs.path]: docs }, (node) => node.path.endsWith(".ts"));

    expect(all.map((item) => item.path)).toEqual(["/root", "/root/a.ts", "/root/readme.md"]);
    expect(onlySrc.map((item) => item.path)).toEqual(["/root", "/root/a.ts"]);
  });

  it("propagates selection and computes indeterminate state", () => {
    const root = makeNode({ path: "/root", is_dir: true, name: "root", childPaths: ["/root/a.ts", "/root/b.ts"] });
    const a = makeNode({ path: "/root/a.ts", parent_path: "/root", name: "a.ts" });
    const b = makeNode({ path: "/root/b.ts", parent_path: "/root", name: "b.ts" });
    const map: Record<string, TreeNode> = { [root.path]: root, [a.path]: a, [b.path]: b };

    updateChildrenSelection(map, root.path, true);
    expect(map[root.path].checked).toBe(true);
    expect(map[a.path].checked).toBe(true);
    expect(map[b.path].checked).toBe(true);

    map[b.path] = { ...map[b.path], checked: false };
    updateParentSelection(map, root.path);

    expect(map[root.path].checked).toBe(false);
    expect(map[root.path].indeterminate).toBe(true);
    expect(collectSelectedPaths(map)).toEqual(["/root/a.ts"]);
  });

  it("clears map selection and collects descendant files", () => {
    const root = makeNode({ path: "/root", is_dir: true, name: "root", childPaths: ["/root/sub", "/root/a.ts"], checked: true });
    const sub = makeNode({ path: "/root/sub", parent_path: "/root", is_dir: true, name: "sub", childPaths: ["/root/sub/b.ts"], checked: true });
    const a = makeNode({ path: "/root/a.ts", parent_path: "/root", name: "a.ts", checked: true });
    const b = makeNode({ path: "/root/sub/b.ts", parent_path: "/root/sub", name: "b.ts", checked: true });
    const map: Record<string, TreeNode> = { [root.path]: root, [sub.path]: sub, [a.path]: a, [b.path]: b };

    expect(collectDescendantFilePaths(map, root.path).sort()).toEqual(["/root/a.ts", "/root/sub/b.ts"]);

    const cleared = clearSelectionMap(map);
    expect(cleared.hasChanges).toBe(true);
    expect(Object.values(cleared.map).every((node) => !node.checked && !node.indeterminate)).toBe(true);
  });

  it("builds root tree state and computes expansion restoration paths", () => {
    const entries = [
      {
        path: "/repo/src",
        parent_path: "/repo",
        raw_path: "/repo/src",
        raw_parent_path: "/repo",
        name: "src",
        is_dir: true,
        size: null,
        mtime: null,
        token_count: null,
        fingerprint: null,
        child_count: null,
      },
      {
        path: "/repo/src/index.ts",
        parent_path: "/repo/src",
        raw_path: "/repo/src/index.ts",
        raw_parent_path: "/repo/src",
        name: "index.ts",
        is_dir: false,
        size: 1,
        mtime: 1,
        token_count: null,
        fingerprint: "f",
        child_count: null,
      },
    ];

    const built = buildRootTreeState({
      entries,
      getParentDirectoryPath,
      getNameFromPath,
    });

    expect(built.rootPaths).toEqual(["/repo"]);
    expect(built.nodesMap["/repo"]).toBeDefined();
    expect(built.nodesMap["/repo/src"].parent_path).toBe("/repo");

    const toExpand = computePathsToExpand({
      prevExpandedPaths: new Set<string>(["/repo/src"]),
      prevCheckedFilePaths: new Set<string>(["/repo/src/index.ts"]),
      isReIndex: true,
      rootEntries: built.rootEntries,
      newNodesMap: built.nodesMap,
      prevNodesMap: {
        "/repo": built.nodesMap["/repo"],
        "/repo/src": built.nodesMap["/repo/src"],
        "/repo/src/index.ts": built.nodesMap["/repo/src/index.ts"],
      },
      getParentDirectoryPath,
    });

    expect(toExpand.has("/repo")).toBe(true);
    expect(toExpand.has("/repo/src")).toBe(true);
  });
});
