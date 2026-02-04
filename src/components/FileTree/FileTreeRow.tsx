import React, { memo, useCallback } from "react";
import { TreeNode } from "../../types";
import { useFileTreeActions } from "./FileTreeContext";
import { FileTreeRowView } from "@/components/ui/file-tree-row";

interface FileTreeRowProps {
  node: TreeNode;
  level: number;
  offsetTop: number;
  onCopyPath?: (path: string) => void;
  showFullPath?: boolean;
  highlightQuery?: string;
}

export const FileTreeRow = memo(function FileTreeRow({
  node,
  level,
  offsetTop,
  onCopyPath,
  showFullPath = false,
  highlightQuery = "",
}: FileTreeRowProps) {
  const { toggleExpand, toggleCheck } = useFileTreeActions();
  const isFolder = node.is_dir;

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

  const checkboxRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) {
        el.indeterminate = node.indeterminate;
      }
    },
    [node.indeterminate]
  );

  const handleFolderKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    },
    [handleRowClick, node.expanded, node.path, toggleExpand]
  );

  const handleFileKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleRowClick();
      }
    },
    [handleRowClick]
  );

  return (
    <FileTreeRowView
      node={node}
      level={level}
      offsetTop={offsetTop}
      onRowClick={handleRowClick}
      onExpandClick={handleExpandClick}
      onCheckboxChange={handleCheckboxChange}
      onPathClick={handlePathClick}
      onKeyDown={isFolder ? handleFolderKeyDown : handleFileKeyDown}
      checkboxRef={checkboxRef}
      showFullPath={showFullPath}
      highlightQuery={highlightQuery}
    />
  );
});
