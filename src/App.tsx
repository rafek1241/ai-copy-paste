import { useState, useEffect, useRef, useCallback } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import MainTabs from "./components/MainTabs";
import { PromptBuilderHandle } from "./components/PromptBuilder";
import { useToast } from "./components/ui/toast";
import { useConfirmDialog } from "./components/ui/alert-dialog";
import { useAppSettings, useAppCustomInstructions } from "./contexts/AppContext";
import { useSessionComposition } from "./hooks/useSessionComposition";
import { useUpdatePresentationState } from "./hooks/useUpdatePresentationState";
import { useMainViewState } from "./hooks/useMainViewState";
import { useDragDropIndexer } from "./hooks/useDragDropIndexer";
import { useFooterPresentation } from "./hooks/useFooterPresentation";
import "./App.css";

import { LayoutProvider } from "./components/layout/LayoutContext";
import { AppLayout } from "./components/layout/AppLayout";
import { FilesView } from "./components/views/FilesView";
import { PromptView } from "./components/views/PromptView";
import { HistoryView } from "./components/views/HistoryView";
import { SettingsView } from "./components/views/SettingsView";
import { UpdateView } from "./components/views/UpdateView";

function getPathLabel(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function App() {
  const promptBuilderRef = useRef<PromptBuilderHandle>(null);

  const { success, error: showError } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { settings } = useAppSettings();
  const { customInstructions, setCustomInstructions } = useAppCustomInstructions();

  const {
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
  } = useMainViewState({
    onHistoryRestored: () => {
      success("Session restored");
    },
  });

  const { saveToHistory, clearSession } = useSessionComposition({
    selectedPaths,
    customInstructions,
    setSelectedPaths,
    setCustomInstructions,
  });

  const {
    updateInfo,
    status: updateStatus,
    progress: updateProgress,
    error: updateError,
    updateNow,
    updateOnExit,
    dismissError: dismissUpdateError,
    shouldShowUpdateView,
  } = useUpdatePresentationState();

  const [appVersion, setAppVersion] = useState("0.0.0");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("0.0.0"));
  }, []);

  const [tokenCount] = useState<number>(0);

  const footerPresentation = useFooterPresentation({
    tokenCount,
    tokenLimit: settings.tokenLimit,
    redactionCount,
    updateStatus,
  });

  const { dragActive } = useDragDropIndexer({
    onIndexed: (path) => {
      success(`Indexing folder: ${getPathLabel(path)}`);
    },
    onIndexError: (path) => {
      showError(`Failed to index: ${getPathLabel(path)}`);
    },
  });

  const handleAddFolder = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
      });

      const selectedPath = typeof selected === "string" ? selected : null;

      if (selectedPath) {
        await invoke("index_folder", { path: selectedPath });
        await emit("refresh-file-tree");
        success("Folder added to index");
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
      showError("Failed to add folder");
    }
  }, [success, showError]);

  const handleClearContext = useCallback(async () => {
    const confirmed = await confirm({
      title: "Clear Context",
      description:
        "Are you sure you want to clear all indexed files? This action cannot be undone.",
      confirmText: "Clear All",
      cancelText: "Cancel",
      variant: "destructive",
      cancelButtonTestId: "confirm-dialog-cancel",
      confirmButtonTestId: "confirm-dialog-confirm",
    });

    if (!confirmed) {
      return;
    }

    try {
      const saved = await saveToHistory();
      if (saved) {
        console.log("Session saved to history before clearing");
      }

      pulseClearFileTree();
      await invoke("clear_index");
      setSelectedPaths([]);
      setCustomInstructions("");
      clearSession();

      await emit("refresh-file-tree");

      success("Context cleared");
    } catch (err) {
      console.error("Failed to clear index:", err);
      showError("Failed to clear context");
    }
  }, [
    confirm,
    success,
    showError,
    saveToHistory,
    pulseClearFileTree,
    setSelectedPaths,
    setCustomInstructions,
    clearSession,
  ]);

  const handleCopyContext = useCallback(async () => {
    if (!promptBuilderRef.current) {
      return;
    }

    try {
      await promptBuilderRef.current.buildAndCopy();
      success("Context copied to clipboard");
    } catch (err) {
      console.error("Failed to copy context:", err);
      showError("Failed to copy context");
    }
  }, [success, showError]);

  return (
    <LayoutProvider>
      {shouldShowUpdateView && updateInfo && (
        <UpdateView
          updateInfo={updateInfo}
          status={updateStatus}
          progress={updateProgress}
          error={updateError}
          onUpdateNow={updateNow}
          onUpdateOnExit={updateOnExit}
          onDismissError={dismissUpdateError}
        />
      )}

      <AppLayout
        activeTab={currentView === "main" ? activeTab : currentView}
        onTabChange={handleSidebarChange}
        dragActive={dragActive}
      >
        {currentView === "main" && (
          <MainTabs activeTab={activeTab} onTabChange={setActiveTab} />
        )}

        <FilesView
          isActive={currentView === "main" && activeTab === "files"}
          onSelectionChange={handleSelectionChange}
          searchQuery={searchQuery}
          initialSelectedPaths={selectedPaths}
          shouldClearSelection={shouldClearFileTree}
          onAddFolder={handleAddFolder}
          onClear={handleClearContext}
          onSearch={setSearchQuery}
          onCopy={handleCopyContext}
          footerPresentation={footerPresentation}
          version={appVersion}
        />

        <PromptView
          ref={promptBuilderRef}
          isActive={currentView === "main" && activeTab === "prompt"}
          selectedFilePaths={selectedPaths}
          onPromptBuilt={(prompt, redactionCount) => {
            handlePromptBuilt({ prompt, redactionCount });
          }}
          onCopy={handleCopyContext}
          footerPresentation={footerPresentation}
          version={appVersion}
        />

        <HistoryView
          isActive={currentView === "history"}
          onRestore={handleHistoryRestore}
        />

        <SettingsView isActive={currentView === "settings"} />
      </AppLayout>
      <ConfirmDialog />
    </LayoutProvider>
  );
}

export default App;
