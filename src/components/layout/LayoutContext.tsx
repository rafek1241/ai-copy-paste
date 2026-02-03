import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface LayoutContextType {
    headerContent: ReactNode;
    footerContent: ReactNode;
    setHeaderContent: (content: ReactNode) => void;
    setFooterContent: (content: ReactNode) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [headerContent, setHeaderContentState] = useState<ReactNode>(null);
    const [footerContent, setFooterContentState] = useState<ReactNode>(null);

    const setHeaderContent = useCallback((content: ReactNode) => {
        setHeaderContentState(content);
    }, []);

    const setFooterContent = useCallback((content: ReactNode) => {
        setFooterContentState(content);
    }, []);

    return (
        <LayoutContext.Provider value={{ headerContent, footerContent, setHeaderContent, setFooterContent }}>
            {children}
        </LayoutContext.Provider>
    );
};

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error("useLayout must be used within a LayoutProvider");
    }
    return context;
};
