import React from "react";
import { cn } from "@/lib/utils";
import { Folder, FileText, History, Settings, Terminal } from "lucide-react";

export type SidebarTab = "files" | "prompt" | "history" | "settings";

interface SidebarProps {
    activeTab?: SidebarTab;
    onTabChange?: (tab: SidebarTab) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab = "files", onTabChange }) => {

    const mainItems: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
        { id: "files", icon: <Folder size={18} />, label: "Files" },
        { id: "prompt", icon: <FileText size={18} />, label: "Prompt" },
        { id: "history", icon: <History size={18} />, label: "History" },
    ];

    return (
        <aside className="w-10 flex-shrink-0 bg-[#010409] border-r border-border-dark flex flex-col items-center py-2 gap-4 z-40" data-testid="sidebar">
            <div className="text-primary mb-2">
                <Terminal size={20} />
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
                        {item.icon}
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
                    <Settings size={18} />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
