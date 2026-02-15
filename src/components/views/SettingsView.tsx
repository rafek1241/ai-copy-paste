import React, { useEffect, useRef, useState, useCallback } from "react";
import Settings, { SettingsRef } from "../Settings";
import { useLayout } from "../layout/LayoutContext";
import { Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsViewProps {
    isActive: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isActive }) => {
    const { setHeaderContent, setFooterContent } = useLayout();
    const settingsRef = useRef<SettingsRef>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = useCallback(async () => {
        await settingsRef.current?.save();
    }, []);

    const handleSavingChange = useCallback((saving: boolean) => {
        setIsSaving(saving);
    }, []);

    useEffect(() => {
        if (isActive) {
            setHeaderContent(
                <div className="w-full h-full flex items-center text-sm font-medium text-white/60">
                    Settings
                </div>
            );
            setFooterContent(
                <footer className="p-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "w-full h-9 rounded font-bold text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary/50",
                            isSaving 
                                ? "bg-white/5 text-white/20 cursor-wait" 
                                : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 active:scale-[0.99]"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Save size={14} aria-hidden="true" />
                        )}
                        {isSaving ? 'SAVING...' : 'SAVE CONFIGURATION'}
                    </button>
                </footer>
            );
        }
    }, [isActive, setHeaderContent, setFooterContent, handleSave, isSaving]);

    if (!isActive) return null;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <Settings ref={settingsRef} onSavingChange={handleSavingChange} />
        </div>
    );
};
