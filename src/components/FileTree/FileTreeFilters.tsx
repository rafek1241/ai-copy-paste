import { memo } from "react";
import { cn } from "@/lib/utils";
import { FilterType, useFileTree } from "./FileTreeContext";
import { ChevronDown, ChevronsUpDown } from "lucide-react";

const FILTER_OPTIONS: { id: FilterType; label: string }[] = [
  { id: "ALL", label: "ALL" },
  { id: "SRC", label: "SRC" },
  { id: "DOCS", label: "DOCS" },
];

interface FileTreeFiltersProps {
  className?: string;
}

export const FileTreeFilters = memo(function FileTreeFilters({ className }: FileTreeFiltersProps) {
  const { state, setFilter } = useFileTree();

  return (
    <div
      className={cn(
        "h-8 flex items-center px-2 justify-between border-b border-border-dark bg-[#0d1117]",
        className
      )}
      role="toolbar"
      aria-label="File filters"
    >
      {/* Filter buttons */}
      <div className="flex items-center gap-1" role="group" aria-label="File type filter">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
              "focus:outline-none focus:ring-1 focus:ring-primary/50",
              state.filterType === option.id
                ? "bg-primary/20 text-primary"
                : "text-white/40 hover:bg-white/5 hover:text-white/60"
            )}
            aria-pressed={state.filterType === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Sort options */}
      <div className="flex items-center gap-3" role="group" aria-label="Sort options">
        <button
          type="button"
          className="flex items-center gap-0.5 text-[9px] font-medium text-white/50 hover:text-white transition-colors focus:outline-none focus:text-white"
          aria-label="Sort by name"
        >
          <span>Name</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[9px] font-medium text-white/50 hover:text-white transition-colors focus:outline-none focus:text-white"
          aria-label="Sort by size"
        >
          <span>Size</span>
          <ChevronsUpDown size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});
