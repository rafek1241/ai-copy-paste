import React from "react";
import { cn } from "@/lib/utils";

export type SidebarTab = "files" | "prompt" | "history" | "settings";

interface SidebarProps {
    activeTab?: SidebarTab;
    onTabChange?: (tab: SidebarTab) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab = "files", onTabChange }) => {

    const mainItems: { id: SidebarTab; icon: string; label: string }[] = [
        { id: "files", icon: "folder", label: "Files" },
        { id: "prompt", icon: "list_alt", label: "Prompt" },
        { id: "history", icon: "history", label: "History" },
    ];

    return (
        <aside className="w-10 flex-shrink-0 bg-[#010409] border-r border-border-dark flex flex-col items-center py-2 gap-4 z-40" data-testid="sidebar">
            <div className="text-primary mb-2">
                <span className="material-symbols-outlined text-[20px]">terminal</span>
            </div>

            <div className="flex flex-col gap-4 w-full items-center">
                {mainItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange?.(item.id)}
                        className={cn(
                            "text-white/40 hover:text-white transition-colors",
                            activeTab === item.id && "text-white"
                        )}
                        title={item.label}
                        data-testid={`nav-${item.id}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    </button>
                ))}
            </div>

            <div className="mt-auto flex flex-col gap-4 w-full items-center">
                <button
                    onClick={() => onTabChange?.("settings")}
                    className={cn(
                        "text-white/40 hover:text-white transition-colors",
                        activeTab === "settings" && "text-white"
                    )}
                    title="Settings"
                    data-testid="nav-settings"
                >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
