import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
    onAddFolder?: () => void;
    onSearch: (query: string) => void;
    onClear?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAddFolder, onSearch, onClear }) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isSearchExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearchExpanded]);

    const handleSearchCheck = () => {
        setIsSearchExpanded(true);
    };

    const handleBlur = () => {
        if (!searchQuery) {
            setIsSearchExpanded(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        onSearch(value);
    };

    return (
        <header className="h-10 flex items-center px-3 border-b border-border-dark bg-[#0d1117]" data-testid="app-header">
            <button
                onClick={onAddFolder}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors group"
                title="Add Folder to Index"
                data-testid="add-folder-btn"
            >
                <span className="material-symbols-outlined text-[16px] text-primary group-hover:text-primary/80">add_box</span>
                <span className="text-[11px] font-semibold text-white/90 group-hover:text-white">Add Context</span>
            </button>
            <button
                onClick={onClear}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors group ml-2"
                title="Clear Context"
                data-testid="clear-context-btn"
            >
                <span className="material-symbols-outlined text-[16px] text-white/40 group-hover:text-white/80">refresh</span>
                <span className="text-[11px] font-semibold text-white/50 group-hover:text-white/90">Clear</span>
            </button>

            <div className={cn(
                "flex items-center transition-all duration-300 ease-in-out relative ml-auto",
                isSearchExpanded ? "w-64" : "w-8"
            )}>
                {isSearchExpanded ? (
                    <div className="w-full relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Search files..."
                            className="w-full h-7 bg-[#161b22] border border-border-dark rounded pl-8 pr-2 text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-primary transition-all"
                            data-testid="file-tree-search"
                        />
                        <span className="material-symbols-outlined text-[14px] text-white/40 absolute left-2 top-1/2 -translate-y-1/2">search</span>
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    onSearch("");
                                    inputRef.current?.focus();
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                                data-testid="clear-search-btn"
                            >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={handleSearchCheck}
                        className="size-7 flex items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Search"
                        data-testid="search-toggle-btn"
                    >
                        <span className="material-symbols-outlined text-[16px]">search</span>
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
