import React from "react";
import { cn } from "@/lib/utils";
import { Copy, Shield } from "lucide-react";
import type { FooterPresentationModel } from "@/services/footerPresentation";

interface FooterProps {
    onCopy: () => void;
    version: string;
    presentation: FooterPresentationModel;
}

const Footer: React.FC<FooterProps> = ({ onCopy, version, presentation }) => {
    return (
        <footer className="p-2 border-t border-border-dark bg-[#0d1117] z-30" role="contentinfo">
            <button
                onClick={onCopy}
                data-testid="copy-btn"
                className="w-full h-9 bg-primary hover:bg-primary/90 text-white font-bold rounded flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
            >
                <Copy size={16} />
                <span className="text-[11px] uppercase tracking-wider">Copy Context</span>
            </button>
            <div className="mt-2 flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    {presentation.showUpdateScheduledBadge && (
                        <div
                            className="flex items-center gap-1.5 text-xs text-green-400/80"
                            data-testid="update-scheduled-badge"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            {presentation.updateScheduledText}
                        </div>
                    )}
                    {presentation.showTokenUsage && (
                        <>
                            <div className={cn("size-2 rounded-full", presentation.tokenStatusClassName)}></div>
                            <span className="text-[10px] font-mono text-white/50">
                                {presentation.tokenUsageText}
                            </span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {presentation.redactionText && (
                        <div className="flex items-center gap-1 text-amber-400" title={presentation.redactionTitle ?? undefined}>
                            <Shield size={10} />
                            <span className="text-[9px]">{presentation.redactionText}</span>
                        </div>
                    )}
                    <div className="text-[9px] text-white/20">v{version}</div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
