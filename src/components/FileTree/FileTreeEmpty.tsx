import { memo } from "react";

interface FileTreeEmptyProps {
  hasSearchQuery: boolean;
}

export const FileTreeEmpty = memo(function FileTreeEmpty({ hasSearchQuery }: FileTreeEmptyProps) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-8 text-center select-none"
      data-testid="empty-state"
      role="status"
    >
      <div className="size-16 mb-4 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
        <span className="material-symbols-outlined text-white/20 text-2xl" aria-hidden="true">
          {hasSearchQuery ? "search_off" : "folder_open"}
        </span>
      </div>
      <p className="text-xs font-medium text-white/40 mb-1">
        {hasSearchQuery ? "No matching files found" : "No files indexed"}
      </p>
      <p className="text-[10px] text-white/25">
        {hasSearchQuery
          ? "Try adjusting your search query"
          : "Drag and drop a folder to start"}
      </p>
    </div>
  );
});
