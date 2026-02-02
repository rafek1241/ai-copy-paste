import React, { useEffect } from "react";
import HistoryPanel from "../HistoryPanel";
import { useLayout } from "../layout/LayoutContext";

interface HistoryViewProps {
    isActive: boolean;
    onRestore: (entry: unknown) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ isActive, onRestore }) => {
    const { setHeaderContent, setFooterContent } = useLayout();

    useEffect(() => {
        if (isActive) {
            setHeaderContent(
                <div className="w-full h-full flex items-center text-sm font-medium text-white/60">
                    History
                </div>
            );
            setFooterContent(null);
        }
    }, [isActive, setHeaderContent, setFooterContent]);

    if (!isActive) return null;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <HistoryPanel onRestore={onRestore} />
        </div>
    );
};
