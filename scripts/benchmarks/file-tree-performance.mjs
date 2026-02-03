import { performance } from "node:perf_hooks";

function generateTree(levels, breadth) {
  const nodesMap = {};
  const rootPaths = [];

  function addNode(path, parentPath, level) {
    nodesMap[path] = {
      path,
      parent_path: parentPath,
      name: path.split("/").pop() || path,
      size: level % 2 === 0 ? 1024 : 2048,
      mtime: 1700000000 + level,
      is_dir: level < levels,
      token_count: null,
      fingerprint: null,
      child_count: null,
      expanded: true,
      checked: false,
      indeterminate: false,
      hasChildren: level < levels,
      childPaths: [],
    };
  }

  function buildLevel(prefix, level) {
    if (level > levels) return;
    for (let i = 0; i < breadth; i++) {
      const path = `${prefix}/node-${level}-${i}`;
      addNode(path, prefix === "" ? null : prefix, level);
      if (prefix === "") {
        rootPaths.push(path);
      } else {
        nodesMap[prefix].childPaths.push(path);
      }
      buildLevel(path, level + 1);
    }
  }

  buildLevel("", 1);
  return { nodesMap, rootPaths };
}

function legacyBuildFlatTree(paths, map, level = 0, result = []) {
  for (const path of paths) {
    const node = map[path];
    if (!node) continue;
    result.push({ ...node, level });
    if (node.expanded && node.childPaths) {
      legacyBuildFlatTree(node.childPaths, map, level + 1, result);
    }
  }
  return result;
}

function optimizedBuildFlatTree(paths, map, level = 0, result = []) {
  for (const path of paths) {
    const node = map[path];
    if (!node) continue;
    result.push({ path, level });
    if (node.expanded && node.childPaths) {
      optimizedBuildFlatTree(node.childPaths, map, level + 1, result);
    }
  }
  return result;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function measure(label, fn, iterations) {
  const times = [];
  const memories = [];
  let sink = 0;

  for (let i = 0; i < iterations; i++) {
    if (global.gc) {
      global.gc();
    }
    const beforeMem = process.memoryUsage().heapUsed;
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const afterMem = process.memoryUsage().heapUsed;

    sink += Array.isArray(result) ? result.length : 0;
    times.push(end - start);
    memories.push(Math.max(0, afterMem - beforeMem));
  }

  return {
    label,
    avgTimeMs: average(times),
    avgMemBytes: average(memories),
    sink,
  };
}

const { nodesMap, rootPaths } = generateTree(4, 20);
const iterations = 6;

const legacy = measure("legacy", () => legacyBuildFlatTree(rootPaths, nodesMap), iterations);
const optimized = measure("optimized", () => optimizedBuildFlatTree(rootPaths, nodesMap), iterations);

const timeImprovement = ((legacy.avgTimeMs - optimized.avgTimeMs) / legacy.avgTimeMs) * 100;
const memImprovement = legacy.avgMemBytes === 0
  ? 0
  : ((legacy.avgMemBytes - optimized.avgMemBytes) / legacy.avgMemBytes) * 100;

console.log("FileTree flatTree benchmark");
console.log(`Legacy avg time: ${legacy.avgTimeMs.toFixed(2)} ms`);
console.log(`Optimized avg time: ${optimized.avgTimeMs.toFixed(2)} ms`);
console.log(`Legacy avg memory: ${(legacy.avgMemBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`Optimized avg memory: ${(optimized.avgMemBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`Time improvement: ${timeImprovement.toFixed(2)}%`);
console.log(`Memory improvement: ${memImprovement.toFixed(2)}%`);
