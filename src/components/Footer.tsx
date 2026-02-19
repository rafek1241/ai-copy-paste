import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import type { UpdateStatus } from "@/types";

interface FooterProps {
    onCopy: () => void;
    tokenCount: number;
    tokenLimit: number;
    version: string;
    updateStatus?: UpdateStatus;
}

const Footer: React.FC<FooterProps> = ({ onCopy, tokenCount, tokenLimit, version, updateStatus }) => {
    const percentage = (tokenCount / tokenLimit) * 100;

    const statusColor = useMemo(() => {
        if (percentage >= 100) return 'bg-red-500';
        if (percentage >= 80) return 'bg-orange-500';
        return 'bg-green-500';
    }, [percentage]);

    const formattedCount = new Intl.NumberFormat('en-US').format(tokenCount);
    const formattedLimit = new Intl.NumberFormat('en-US').format(tokenLimit);

    return (
        <footer className="p-2 border-t border-border-dark bg-[#0d1117] z-30" role="contentinfo">
            <button
                onClick={onCopy}
                className="w-full h-9 bg-primary hover:bg-primary/90 text-white font-bold rounded flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
            >
                <Copy size={16} />
                <span className="text-[11px] uppercase tracking-wider">Copy Context</span>
            </button>
            <div className="mt-2 flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    {updateStatus === 'scheduled' && (
                        <div
                            className="flex items-center gap-1.5 text-xs text-green-400/80"
                            data-testid="update-scheduled-badge"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Update will install on exit
                        </div>
                    )}
                    {updateStatus !== 'scheduled' && (
                        <>
                            <div className={cn("size-2 rounded-full", statusColor)}></div>
                            <span className="text-[10px] font-mono text-white/50">
                                {formattedCount} / {formattedLimit} tokens
                            </span>
                        </>
                    )}
                </div>
                <div className="text-[9px] text-white/20">v{version}</div>
            </div>
        </footer>
    );
};

export default Footer;
