import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { PlusSquare, Eraser, Search, X } from "lucide-react";

interface HeaderProps {
    onAddFolder?: () => void;
    onSearch: (query: string) => void;
    onClear?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAddFolder, onSearch, onClear }) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSearchClick = () => {
        setIsSearchExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 100);
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

    const clearSearch = () => {
        setSearchQuery("");
        onSearch("");
        inputRef.current?.focus();
    };

    return (
        <header className="flex-1 flex items-center h-full" data-testid="app-header-content">
            <button
                onClick={onAddFolder}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors group"
                title="Add Folder to Index"
                data-testid="add-folder-btn"
            >
                <PlusSquare size={16} className="text-primary group-hover:text-primary/80" />
                <span className="text-[11px] font-semibold text-white/90 group-hover:text-white">Add Context</span>
            </button>
            <button
                onClick={onClear}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors group ml-2"
                title="Clear Context"
                data-testid="clear-context-btn"
            >
                <Eraser size={16} className="text-white/40 group-hover:text-white/80" />
                <span className="text-[11px] font-semibold text-white/50 group-hover:text-white/90">Clear</span>
            </button>

            <div className={cn(
                "flex items-center transition-all duration-300 ease-in-out relative ml-auto",
                isSearchExpanded ? "w-64" : "w-8"
            )}>
                {isSearchExpanded ? (
                    <div className="relative w-full flex items-center">
                        <Search size={14} className="absolute left-2 text-white/40" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full bg-[#161b22] border border-white/10 rounded-md py-1 pl-8 pr-6 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            data-testid="search-input"
                        />
                        {searchQuery && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-2 text-white/20 hover:text-white transition-colors"
                                data-testid="clear-search-btn"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={handleSearchClick}
                        className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors ml-auto"
                        title="Search"
                        data-testid="search-toggle"
                    >
                        <Search size={16} />
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
