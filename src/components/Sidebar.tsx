import React from "react";

const Sidebar: React.FC = () => {
    return (
        <aside className="w-10 flex-shrink-0 bg-[#010409] border-r border-border-dark flex flex-col items-center py-2 gap-4">
            <div className="text-primary mb-2">
                <span className="material-symbols-outlined text-[20px]">terminal</span>
            </div>

            <button className="text-white/40 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">folder</span>
            </button>

            <button className="text-white/40 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">list_alt</span>
            </button>

            <button className="text-white/40 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">history</span>
            </button>

            <div className="mt-auto flex flex-col gap-4">
                <button className="text-white/40 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
