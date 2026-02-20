export function normalizePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (/^[A-Za-z]:\/$/.test(normalized)) {
    return normalized.slice(0, 2);
  }
  return normalized;
}

export function getParentDirectoryPath(filePath: string): string | null {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return null;
  return normalized.substring(0, lastSlash);
}

export function getNameFromPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  if (/^[A-Za-z]:$/.test(normalized)) {
    return normalized;
  }
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
}

export function getCommonAncestorPath(paths: string[]): string | null {
  if (paths.length === 0) return null;

  const splitPaths = paths.map((path) => normalizePath(path).split("/"));
  let commonSegments = splitPaths[0];

  for (let index = 1; index < splitPaths.length; index += 1) {
    const segments = splitPaths[index];
    let shared = 0;

    while (
      shared < commonSegments.length &&
      shared < segments.length &&
      commonSegments[shared] === segments[shared]
    ) {
      shared += 1;
    }

    commonSegments = commonSegments.slice(0, shared);
    if (commonSegments.length === 0) {
      return null;
    }
  }

  return commonSegments.join("/");
}
