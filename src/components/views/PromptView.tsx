import { useEffect, forwardRef } from "react";
import { PromptBuilder, PromptBuilderHandle } from "../PromptBuilder";
import Footer from "../Footer";
import { useLayout } from "../layout/LayoutContext";
import type { UpdateStatus } from "@/types";

interface PromptViewProps {
    isActive: boolean;
    // PromptBuilder props
    selectedFilePaths: string[];
    onPromptBuilt: (prompt: string, redactionCount: number) => void;
    // Footer props
    onCopy: () => void;
    tokenCount: number;
    tokenLimit: number;
    version: string;
    redactionCount?: number;
    updateStatus?: UpdateStatus;
}

export const PromptView = forwardRef<PromptBuilderHandle, PromptViewProps>(({
    isActive,
    selectedFilePaths,
    onPromptBuilt,
    onCopy,
    tokenCount,
    tokenLimit,
    version,
    redactionCount = 0,
    updateStatus
}, ref) => {
    const { setFooterContent, setHeaderContent } = useLayout();

    useEffect(() => {
        if (isActive) {
            setHeaderContent(
                <div className="w-full h-full flex items-center text-sm font-medium text-white/60">
                    Prompt Builder
                </div>
            );

            setFooterContent(
                <Footer
                    onCopy={onCopy}
                    tokenCount={tokenCount}
                    tokenLimit={tokenLimit}
                    version={version}
                    redactionCount={redactionCount}
                    updateStatus={updateStatus}
                />
            );
        }
    }, [
        isActive, 
        setFooterContent, 
        setHeaderContent, 
        onCopy, 
        tokenCount, 
        tokenLimit, 
        version,
        redactionCount,
        updateStatus
    ]);

    return (
        <div className={isActive ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
            <PromptBuilder
                ref={ref}
                selectedFilePaths={selectedFilePaths}
                onPromptBuilt={onPromptBuilt}
            />
        </div>
    );
});

PromptView.displayName = "PromptView";
