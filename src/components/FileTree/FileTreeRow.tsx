import React, { memo, useCallback } from "react";
import { TreeNode } from "../../types";
import { cn } from "@/lib/utils";
import { useFileTree } from "./FileTreeContext";
import {
  ChevronRight,
  FileArchive,
  FileCode2,
  FileImage,
  FileJson,
  FileMusic,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType2,
  FileVideo,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FileTreeRowProps {
  node: TreeNode & { level: number };
  style: React.CSSProperties;
  onCopyPath?: (path: string) => void;
}

const fileIconMap: Record<string, { Icon: LucideIcon; className: string }> = {
  js: { Icon: FileCode2, className: "text-yellow-300" },
  jsx: { Icon: FileCode2, className: "text-cyan-300" },
  ts: { Icon: FileCode2, className: "text-blue-400" },
  tsx: { Icon: FileCode2, className: "text-blue-300" },
  mjs: { Icon: FileCode2, className: "text-yellow-300" },
  cjs: { Icon: FileCode2, className: "text-yellow-300" },
  json: { Icon: FileJson, className: "text-amber-300" },
  md: { Icon: FileText, className: "text-purple-300" },
  txt: { Icon: FileText, className: "text-white/60" },
  log: { Icon: FileText, className: "text-white/50" },
  html: { Icon: FileCode2, className: "text-orange-300" },
  htm: { Icon: FileCode2, className: "text-orange-300" },
  css: { Icon: FileType2, className: "text-sky-300" },
  scss: { Icon: FileType2, className: "text-pink-300" },
  less: { Icon: FileType2, className: "text-indigo-300" },
  yml: { Icon: FileJson, className: "text-amber-300" },
  yaml: { Icon: FileJson, className: "text-amber-300" },
  png: { Icon: FileImage, className: "text-emerald-300" },
  jpg: { Icon: FileImage, className: "text-emerald-300" },
  jpeg: { Icon: FileImage, className: "text-emerald-300" },
  gif: { Icon: FileImage, className: "text-emerald-300" },
  webp: { Icon: FileImage, className: "text-emerald-300" },
  svg: { Icon: FileImage, className: "text-emerald-300" },
  ico: { Icon: FileImage, className: "text-emerald-300" },
  mp3: { Icon: FileMusic, className: "text-fuchsia-300" },
  wav: { Icon: FileMusic, className: "text-fuchsia-300" },
  flac: { Icon: FileMusic, className: "text-fuchsia-300" },
  ogg: { Icon: FileMusic, className: "text-fuchsia-300" },
  mp4: { Icon: FileVideo, className: "text-rose-300" },
  mov: { Icon: FileVideo, className: "text-rose-300" },
  mkv: { Icon: FileVideo, className: "text-rose-300" },
  avi: { Icon: FileVideo, className: "text-rose-300" },
  webm: { Icon: FileVideo, className: "text-rose-300" },
  zip: { Icon: FileArchive, className: "text-yellow-400" },
  rar: { Icon: FileArchive, className: "text-yellow-400" },
  "7z": { Icon: FileArchive, className: "text-yellow-400" },
  tar: { Icon: FileArchive, className: "text-yellow-400" },
  gz: { Icon: FileArchive, className: "text-yellow-400" },
  bz2: { Icon: FileArchive, className: "text-yellow-400" },
  csv: { Icon: FileSpreadsheet, className: "text-green-400" },
  xls: { Icon: FileSpreadsheet, className: "text-green-400" },
  xlsx: { Icon: FileSpreadsheet, className: "text-green-400" },
  sh: { Icon: FileTerminal, className: "text-emerald-200" },
  bash: { Icon: FileTerminal, className: "text-emerald-200" },
  zsh: { Icon: FileTerminal, className: "text-emerald-200" },
  ps1: { Icon: FileTerminal, className: "text-emerald-200" },
  bat: { Icon: FileTerminal, className: "text-emerald-200" },
  cmd: { Icon: FileTerminal, className: "text-emerald-200" },
};

const defaultFileIcon = { Icon: FileText, className: "text-white/60" };

function getFileIconMeta(name: string) {
  const parts = name.toLowerCase().split(".");
  if (parts.length < 2) {
    return defaultFileIcon;
  }
  const extension = parts.pop() || "";
  return fileIconMap[extension] || defaultFileIcon;
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
          <ChevronRight
            size={14}
            className={cn(
              "text-white/40 transition-transform select-none",
              node.expanded && "rotate-90"
            )}
          />
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
        <div
          className="mr-2 select-none text-yellow-600/70"
          aria-hidden="true"
          data-testid="tree-icon"
        >
          {node.expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
        </div>

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
  const { Icon, className } = getFileIconMeta(node.name);

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
      <div className="mr-1 invisible select-none w-[14px] h-[14px]">
        <ChevronRight size={14} />
      </div>

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
          className="select-none flex-shrink-0"
          aria-hidden="true"
          data-testid="tree-icon"
        >
          <Icon size={13} className={cn("text-white/70", className)} />
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
