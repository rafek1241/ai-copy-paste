import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { PlusSquare, Eraser, Search, X } from "lucide-react";

interface HeaderProps {
    onAddFolder?: () => void;
    onSearch: (query: string) => void;
    onClear?: () => void;
}

type TooltipState = 'visible' | 'hidden' | 'ready';

const TOOLTIP_CONTENT = `Advanced search:
\u2022 file:name - fuzzy match filename
\u2022 dir:name - filter by directory
\u2022 /pattern$/ - auto-detected regex
\u2022 Combine: file:App dir:src (AND logic)`;

const Header: React.FC<HeaderProps> = ({ onAddFolder, onSearch, onClear }) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [tooltipState, setTooltipState] = useState<TooltipState>('visible');
    const inputRef = useRef<HTMLInputElement>(null);
    const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isSearchExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearchExpanded]);

    // Clean up tooltip timeout on unmount
    useEffect(() => {
        return () => {
            if (tooltipTimeoutRef.current) {
                clearTimeout(tooltipTimeoutRef.current);
            }
        };
    }, []);

    // Handle tooltip visibility based on search state
    const updateTooltipVisibility = useCallback((query: string) => {
        // Clear any existing timeout
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }

        if (query) {
            // Hide tooltip immediately when typing
            setTooltipState('hidden');

            // Set timer to show tooltip after 3 seconds of inactivity
            tooltipTimeoutRef.current = setTimeout(() => {
                setTooltipState('ready');
            }, 3000);
        } else {
            // Show tooltip when query is empty
            setTooltipState('visible');
        }
    }, []);

    const handleSearchClick = () => {
        setIsSearchExpanded(true);
        setTooltipState('visible');
    };

    const handleBlur = () => {
        if (!searchQuery) {
            setIsSearchExpanded(false);
        }
        // Reset tooltip state when input loses focus
        if (!searchQuery) {
            setTooltipState('visible');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        onSearch(value);
        updateTooltipVisibility(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            // Blur the input to mark search as "done"
            inputRef.current?.blur();
        }
    };

    const handleMouseEnter = () => {
        // Show tooltip on hover when ready or visible
        if (tooltipState === 'ready' || (tooltipState === 'visible' && !searchQuery)) {
            setTooltipState('visible');
        }
    };

    const handleMouseLeave = () => {
        // Keep tooltip visible if empty, otherwise set to ready
        if (!searchQuery) {
            setTooltipState('visible');
        } else if (tooltipState === 'visible') {
            setTooltipState('ready');
        }
    };

    const clearSearch = () => {
        setSearchQuery("");
        onSearch("");
        setTooltipState('visible');
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
                    <div
                        className="relative w-full flex items-center"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <Search size={14} className="absolute left-2 text-white/40" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full bg-[#161b22] border border-white/10 rounded-md py-1 pl-8 pr-6 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                            placeholder={searchQuery ? "Search files..." : "Search files... (? for help)"}
                            value={searchQuery}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
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
                        {/* Tooltip */}
                        {tooltipState === 'visible' && !searchQuery && (
                            <div
                                className="absolute top-full left-0 mt-2 p-3 bg-[#1c2128] border border-white/10 rounded-lg shadow-lg z-50 text-[10px] text-white/70 whitespace-pre-line w-64"
                                data-testid="search-tooltip"
                            >
                                {TOOLTIP_CONTENT}
                            </div>
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
