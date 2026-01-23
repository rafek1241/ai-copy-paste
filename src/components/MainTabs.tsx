import React from "react";

export type ActiveTab = "files" | "prompt";

interface MainTabsProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

const MainTabs: React.FC<MainTabsProps> = ({ activeTab, onTabChange }) => {
    return (
        <div className="tab-nav h-9 flex items-end px-3 gap-5 border-b border-border-dark bg-[#161b22] sticky top-0 z-20">
            <button
                className={`pb-2 text-[11px] font-medium cursor-pointer border-b-2 transition-all outline-none ${activeTab === "files"
                        ? "text-white border-primary"
                        : "text-white/50 border-transparent hover:text-white"
                    }`}
                onClick={() => onTabChange("files")}
            >
                Files
            </button>
            <button
                className={`pb-2 text-[11px] font-medium cursor-pointer border-b-2 transition-all outline-none ${activeTab === "prompt"
                        ? "text-white border-primary"
                        : "text-white/50 border-transparent hover:text-white"
                    }`}
                onClick={() => onTabChange("prompt")}
            >
                Prompt
            </button>
        </div>
    );
};

export default MainTabs;
