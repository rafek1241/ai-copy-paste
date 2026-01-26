import React, { memo, useCallback } from "react";
import { TreeNode } from "../../types";
import { cn } from "@/lib/utils";
import { useFileTree } from "./FileTreeContext";

interface FileTreeRowProps {
  node: TreeNode & { level: number };
  style: React.CSSProperties;
  onCopyPath?: (path: string) => void;
}

// File icon mapping
function getFileIconName(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "terminal";
    case ".js":
    case ".jsx":
      return "javascript";
    case ".py":
      return "code";
    case ".go":
      return "description";
    case ".css":
      return "css";
    case ".json":
      return "data_object";
    case ".md":
      return "article";
    case ".html":
      return "html";
    default:
      return "description";
  }
}

// File icon color mapping
function getFileIconColor(name: string): string {
  if (name.endsWith(".go")) return "text-blue-400";
  if (name.endsWith(".py")) return "text-yellow-500";
  if (name.endsWith(".json")) return "text-green-400";
  if (name.endsWith(".css")) return "text-blue-400";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "text-blue-500";
  if (name.endsWith(".md")) return "text-white/60";
  return "text-white/40";
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Get parent path for display
function getParentPath(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return lastSlash > 0 ? path.substring(0, lastSlash) : "";
}

export const FileTreeRow = memo(function FileTreeRow({
  node,
  style,
  onCopyPath,
}: FileTreeRowProps) {
  const { toggleExpand, toggleCheck } = useFileTree();
  const isFolder = node.is_dir;
  const paddingLeft = node.level * 12 + 8;

  const handleRowClick = useCallback(() => {
    toggleCheck(node.path, !node.checked);
  }, [node.path, node.checked, toggleCheck]);

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpand(node.path);
    },
    [node.path, toggleExpand]
  );

  const handleCheckboxChange = useCallback(() => {
    toggleCheck(node.path, !node.checked);
  }, [node.path, node.checked, toggleCheck]);

  const handlePathClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCopyPath?.(node.path);
    },
    [node.path, onCopyPath]
  );

  // Set indeterminate state on checkbox
  const checkboxRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) {
        el.indeterminate = node.indeterminate;
      }
    },
    [node.indeterminate]
  );

  if (isFolder) {
    return (
      <div
        className="flex items-center px-2 py-1 sticky z-10 w-full bg-[#161b22]/90 backdrop-blur-sm border-b border-border-dark"
        style={{ ...style, paddingLeft }}
        onClick={handleRowClick}
        data-testid="tree-node"
        data-node-type="folder"
        role="treeitem"
        aria-expanded={node.expanded}
        aria-selected={node.checked}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleRowClick();
          }
          if (e.key === "ArrowRight" && !node.expanded) {
            e.preventDefault();
            toggleExpand(node.path);
          }
          if (e.key === "ArrowLeft" && node.expanded) {
            e.preventDefault();
            toggleExpand(node.path);
          }
        }}
      >
        {/* Expand button */}
        <button
          type="button"
          className={cn(
            "p-0.5 -ml-0.5 mr-0.5 rounded hover:bg-white/10 transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-primary/50"
          )}
          onClick={handleExpandClick}
          aria-label={node.expanded ? "Collapse folder" : "Expand folder"}
          data-testid="expand-icon"
          data-expanded={node.expanded}
        >
          <span
            className={cn(
              "material-symbols-outlined text-[14px] text-white/40 transition-transform select-none",
              node.expanded && "rotate-90"
            )}
          >
            chevron_right
          </span>
        </button>

        {/* Checkbox */}
        <div className="w-5 flex justify-center mr-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={checkboxRef}
            type="checkbox"
            className="custom-checkbox appearance-none border border-border-dark checked:bg-primary checked:border-transparent relative after:content-[''] after:absolute after:inset-0 after:m-auto after:block after:w-1.5 after:h-1.5 after:rounded-[1px] checked:after:bg-white cursor-pointer size-2.5 rounded-sm bg-transparent text-primary focus:ring-1 focus:ring-primary/50 focus:ring-offset-0 select-none"
            checked={node.checked}
            onChange={handleCheckboxChange}
            aria-label={`Select ${node.name}`}
            data-testid="tree-checkbox"
          />
        </div>

        {/* Folder icon */}
        <span
          className="material-symbols-outlined text-[14px] text-yellow-600/70 mr-2 select-none"
          aria-hidden="true"
          data-testid="tree-icon"
        >
          folder
        </span>

        {/* Folder name */}
        <span className="text-[10px] font-medium text-white/70 flex-shrink-0" data-testid="tree-label">
          {node.name}
        </span>

        {/* Item count */}
        <span className="text-[9px] text-white/30 ml-2 flex-1 whitespace-nowrap">
          ({node.child_count ?? node.childPaths?.length ?? 0} items)
        </span>

        {/* Path (clickable to copy) */}
        <span
          className="text-white/20 text-[9px] pr-2 ml-2 cursor-pointer hover:text-white/40 transition-colors select-none min-w-0 truncate"
          style={{ direction: "rtl", textAlign: "left" }}
          onClick={handlePathClick}
          title="Click to copy path"
        >
          {getParentPath(node.path)}
        </span>
      </div>
    );
  }

  // File row
  return (
    <div
      className="flex items-center px-2 py-0.5 min-h-[22px] border-b border-border-dark/30 hover:bg-white/[0.02] transition-colors"
      style={{ ...style, paddingLeft }}
      onClick={handleRowClick}
      data-testid="tree-node"
      data-node-type="file"
      role="treeitem"
      aria-selected={node.checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleRowClick();
        }
      }}
    >
      {/* Invisible spacer to align with folders */}
      <span className="material-symbols-outlined text-[14px] mr-1 invisible select-none" aria-hidden="true">
        chevron_right
      </span>

      {/* Checkbox */}
      <div className="w-5 flex justify-center mr-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={checkboxRef}
          type="checkbox"
          className="custom-checkbox appearance-none border border-border-dark checked:bg-primary checked:border-transparent relative after:content-[''] after:absolute after:inset-0 after:m-auto after:block after:w-1.5 after:h-1.5 after:rounded-[1px] checked:after:bg-white cursor-pointer size-2.5 rounded-sm bg-transparent text-primary focus:ring-1 focus:ring-primary/50 focus:ring-offset-0 select-none"
          checked={node.checked}
          onChange={handleCheckboxChange}
          aria-label={`Select ${node.name}`}
          data-testid="tree-checkbox"
        />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {/* File icon */}
        <span
          className={cn("material-symbols-outlined text-[13px] select-none flex-shrink-0", getFileIconColor(node.name))}
          aria-hidden="true"
          data-testid="tree-icon"
        >
          {getFileIconName(node.path)}
        </span>

        {/* File name */}
        <span className="text-white text-[11px] flex-1 shrink-0" data-testid="tree-label">
          {node.name}
        </span>

        {/* Path (clickable to copy) */}
        <span
          className="text-white/20 text-[9px] pr-2 cursor-pointer hover:text-white/40 transition-colors select-none min-w-0 truncate"
          style={{ direction: "rtl", textAlign: "left" }}
          onClick={handlePathClick}
          title="Click to copy path"
        >
          {getParentPath(node.path)}
        </span>
      </div>

      {/* File size */}
      <div className="px-2 select-none">
        <span className="text-[9px] font-mono text-white/30">{formatFileSize(node.size || 0)}</span>
      </div>
    </div>
  );
});
