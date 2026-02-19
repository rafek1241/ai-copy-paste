import React, { useEffect } from "react";
import { FileTree } from "../FileTree";
import Header from "../Header";
import Footer from "../Footer";
import { useLayout } from "../layout/LayoutContext";
import type { FooterPresentationModel } from "@/services/footerPresentation";

interface FilesViewProps {
    isActive: boolean;
    // FileTree props
    onSelectionChange: (paths: string[]) => void;
    searchQuery: string;
    initialSelectedPaths: string[];
    shouldClearSelection: boolean;
    // Header props
    onAddFolder: () => void;
    onClear: () => void;
    onSearch: (query: string) => void;
    // Footer props
    onCopy: () => void;
    footerPresentation: FooterPresentationModel;
    version: string;
}

export const FilesView: React.FC<FilesViewProps> = ({
    isActive,
    onSelectionChange,
    searchQuery,
    initialSelectedPaths,
    shouldClearSelection,
    onAddFolder,
    onClear,
    onSearch,
    onCopy,
    footerPresentation,
    version,
}) => {
    const { setHeaderContent, setFooterContent } = useLayout();

    useEffect(() => {
        if (isActive) {
            setHeaderContent(
                <Header
                    onAddFolder={onAddFolder}
                    onClear={onClear}
                    onSearch={onSearch}
                />
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
        setHeaderContent, 
        setFooterContent, 
        onAddFolder, 
        onClear, 
        onSearch, 
        onCopy, 
        footerPresentation,
        version,
    ]);

    return (
        <div className={isActive ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
            <FileTree
                onSelectionChange={onSelectionChange}
                searchQuery={searchQuery}
                initialSelectedPaths={initialSelectedPaths}
                shouldClearSelection={shouldClearSelection}
            />
        </div>
    );
};
