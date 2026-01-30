import React, { useEffect } from "react";
import Settings from "../Settings";
import { useLayout } from "../layout/LayoutContext";

interface SettingsViewProps {
    isActive: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isActive }) => {
    const { setHeaderContent, setFooterContent } = useLayout();

    useEffect(() => {
        if (isActive) {
            setHeaderContent(
                <div className="w-full h-full flex items-center text-sm font-medium text-white/60">
                    Settings
                </div>
            );
            setFooterContent(null);
        }
    }, [isActive, setHeaderContent, setFooterContent]);

    if (!isActive) return null;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <Settings />
        </div>
    );
};
