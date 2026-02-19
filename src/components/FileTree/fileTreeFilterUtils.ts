import type { TreeNode } from "../../types";
import type { FilterType } from "./fileTreeTypes";

export const SRC_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".c", ".cpp", ".h",
  ".java", ".rb", ".php", ".css", ".html", ".sh", ".yaml", ".json",
];

export const DOCS_EXTENSIONS = [
  ".md", ".txt", ".pdf", ".docx", ".doc", ".odt", ".rtf",
];

const SRC_EXTENSION_SET = new Set(SRC_EXTENSIONS);
const DOCS_EXTENSION_SET = new Set(DOCS_EXTENSIONS);

export function matchesExtensionFilter(node: TreeNode, filterType: FilterType): boolean {
  if (filterType === "ALL") return true;
  if (node.is_dir) return true;

  const dotIndex = node.path.lastIndexOf(".");
  const extension = dotIndex >= 0 ? node.path.substring(dotIndex).toLowerCase() : "";

  if (filterType === "SRC") return SRC_EXTENSION_SET.has(extension);
  if (filterType === "DOCS") return DOCS_EXTENSION_SET.has(extension);

  return true;
}
