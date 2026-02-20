import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveTab } from "@/components/MainTabs";
import type { SidebarTab } from "@/components/Sidebar";

export type MainView = "main" | "history" | "settings";

interface UseMainViewStateOptions {
  onHistoryRestored?: () => void;
}

interface PromptBuiltPayload {
  prompt: string;
  redactionCount: number;
}

export function useMainViewState({ onHistoryRestored }: UseMainViewStateOptions = {}) {
  const [currentView, setCurrentView] = useState<MainView>("main");
  const [activeTab, setActiveTab] = useState<ActiveTab>("files");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [shouldClearFileTree, setShouldClearFileTree] = useState(false);
  const [redactionCount, setRedactionCount] = useState(0);
  const clearFileTreeTimerRef = useRef<number | null>(null);

  const handleSelectionChange = useCallback((paths: string[]) => {
    setSelectedPaths(paths);
  }, []);

  const handleSidebarChange = useCallback((tab: SidebarTab) => {
    if (tab === "files" || tab === "prompt") {
      setCurrentView("main");
      setActiveTab(tab);
      return;
    }

    setCurrentView(tab);
  }, []);

  const handleHistoryRestore = useCallback(
    (entry: unknown) => {
      console.log("Restoring history entry:", entry);
      setCurrentView("main");
      setActiveTab("prompt");
      onHistoryRestored?.();
    },
    [onHistoryRestored]
  );

  const handlePromptBuilt = useCallback(({ prompt, redactionCount: redactions }: PromptBuiltPayload) => {
    console.log("Built prompt:", prompt);
    setRedactionCount(redactions);
  }, []);

  const pulseClearFileTree = useCallback(() => {
    setShouldClearFileTree(true);

    if (clearFileTreeTimerRef.current !== null) {
      window.clearTimeout(clearFileTreeTimerRef.current);
    }

    clearFileTreeTimerRef.current = window.setTimeout(() => {
      setShouldClearFileTree(false);
      clearFileTreeTimerRef.current = null;
    }, 100);
  }, []);

  useEffect(() => {
    return () => {
      if (clearFileTreeTimerRef.current !== null) {
        window.clearTimeout(clearFileTreeTimerRef.current);
      }
    };
  }, []);

  return {
    currentView,
    activeTab,
    selectedPaths,
    searchQuery,
    shouldClearFileTree,
    redactionCount,
    setActiveTab,
    setSelectedPaths,
    setSearchQuery,
    handleSelectionChange,
    handleSidebarChange,
    handleHistoryRestore,
    handlePromptBuilt,
    pulseClearFileTree,
  };
}
