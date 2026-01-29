import React from "react";
import Sidebar, { SidebarTab } from "../Sidebar";
import { useLayout } from "./LayoutContext";

interface AppLayoutProps {
    children: React.ReactNode;
    activeTab: SidebarTab;
    onTabChange: (tab: SidebarTab) => void;
    dragActive: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, activeTab, onTabChange, dragActive }) => {
    const { headerContent, footerContent } = useLayout();

    return (
        <div
            className="flex h-screen w-screen border-t border-white/5 bg-[#010409] text-[#c9d1d9] antialiased overflow-hidden font-sans"
            data-testid="app-container"
        >
            <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

            <div className="flex-1 flex flex-col min-w-0 relative bg-background-dark">
                {headerContent && (
                    <header className="h-10 flex items-center px-3 border-b border-border-dark bg-[#0d1117] min-h-[40px]" data-testid="app-header">
                        {headerContent}
                    </header>
                )}

                <main className="flex-1 flex flex-col overflow-hidden relative" role="main">
                    {children}
                </main>

                {footerContent && (
                    <footer className="p-2 border-t border-border-dark bg-[#0d1117] z-30" role="contentinfo">
                        {footerContent}
                    </footer>
                )}
            </div>

            {/* Drag and drop overlay */}
            {dragActive && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-[#010409]/60 backdrop-blur-sm"
                    role="presentation"
                    aria-label="Drop zone active"
                >
                    <div className="border-2 border-dashed border-primary/50 bg-primary/5 w-80 h-80 flex flex-col items-center justify-center rounded-xl gap-4">
                        {/* We would need to import FolderOpen here or just pass children for this overlay */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary"
                        >
                            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                        </svg>
                        <span className="text-white/80 text-lg font-medium">Drop folder here</span>
                        <span className="text-white/40 text-xs">to add to context</span>
                    </div>
                </div>
            )}
        </div>
    );
};
