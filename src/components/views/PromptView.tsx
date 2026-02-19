import { useEffect, forwardRef } from "react";
import { PromptBuilder, PromptBuilderHandle } from "../PromptBuilder";
import Footer from "../Footer";
import { useLayout } from "../layout/LayoutContext";
import type { FooterPresentationModel } from "@/services/footerPresentation";

interface PromptViewProps {
    isActive: boolean;
    // PromptBuilder props
    selectedFilePaths: string[];
    onPromptBuilt: (prompt: string, redactionCount: number) => void;
    // Footer props
    onCopy: () => void;
    footerPresentation: FooterPresentationModel;
    version: string;
}

export const PromptView = forwardRef<PromptBuilderHandle, PromptViewProps>(({
    isActive,
    selectedFilePaths,
    onPromptBuilt,
    onCopy,
    footerPresentation,
    version,
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
                    presentation={footerPresentation}
                    version={version}
                />
            );
        }
    }, [
        isActive, 
        setFooterContent, 
        setHeaderContent, 
        onCopy, 
        footerPresentation,
        version,
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
