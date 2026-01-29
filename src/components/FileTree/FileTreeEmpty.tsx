import { memo } from "react";
import { FolderOpen, SearchX } from "lucide-react";

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
        <div className="text-white/20" aria-hidden="true">
          {hasSearchQuery ? <SearchX size={24} /> : <FolderOpen size={24} />}
        </div>
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
