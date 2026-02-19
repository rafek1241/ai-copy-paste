import { useState, useEffect, useRef, useCallback } from "react";
import { PromptBuilderHandle } from "./components/PromptBuilder";
import MainTabs, { ActiveTab } from "./components/MainTabs";
import { SidebarTab } from "./components/Sidebar";
import { listen, emit, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { useToast } from "./components/ui/toast";
import { useConfirmDialog } from "./components/ui/alert-dialog";
import { useAppSettings, useAppCustomInstructions } from "./contexts/AppContext";
import { useSessionPersistence } from "./hooks/useSessionPersistence";
import { useUpdateCheck } from "./hooks/useUpdateCheck";
import "./App.css";

// Layout & Views
import { LayoutProvider } from "./components/layout/LayoutContext";
import { AppLayout } from "./components/layout/AppLayout";
import { FilesView } from "./components/views/FilesView";
import { PromptView } from "./components/views/PromptView";
import { HistoryView } from "./components/views/HistoryView";
import { SettingsView } from "./components/views/SettingsView";
import { UpdateView } from "./components/views/UpdateView";

type View = "main" | "history" | "settings";

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

function App() {
  const [currentView, setCurrentView] = useState<View>("main");
  const [activeTab, setActiveTab] = useState<ActiveTab>("files");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [shouldClearFileTree, setShouldClearFileTree] = useState<boolean>(false);
  const [redactionCount, setRedactionCount] = useState<number>(0);
  const promptBuilderRef = useRef<PromptBuilderHandle>(null);

  const { success, error: showError } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { settings } = useAppSettings();
  const { customInstructions, setCustomInstructions } = useAppCustomInstructions();

  // Session persistence - restores state on mount, saves on change
  const { saveToHistory, clearSession } = useSessionPersistence(
    selectedPaths,
    customInstructions,
    setSelectedPaths,
    setCustomInstructions
  );

  // Update check
  const {
    updateInfo,
    status: updateStatus,
    progress: updateProgress,
    error: updateError,
    updateNow,
    updateOnExit,
    dismissError: dismissUpdateError
  } = useUpdateCheck();

  const [showUpdateView, setShowUpdateView] = useState(true);

  useEffect(() => {
    if (updateStatus === 'scheduled') {
      const timer = setTimeout(() => setShowUpdateView(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [updateStatus]);

  // App version from Tauri config
  const [appVersion, setAppVersion] = useState("0.0.0");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("0.0.0"));
  }, []);

  // Token counting state
  const [tokenCount] = useState<number>(0);

  // Setup drag and drop listeners
  useEffect(() => {
    let unlistenDragEnter: UnlistenFn | undefined;
    let unlistenDragLeave: UnlistenFn | undefined;
    let unlistenDragDrop: UnlistenFn | undefined;
    let isIndexing = false;
    let isMounted = true;

    const setupDragDrop = async () => {
      const uDragEnter = await listen("tauri://drag-enter", () => {
        setDragActive(true);
      });
      if (!isMounted) {
        uDragEnter();
        return;
      }
      unlistenDragEnter = uDragEnter;

      const uDragLeave = await listen("tauri://drag-leave", () => {
        setDragActive(false);
      });
      if (!isMounted) {
        uDragLeave();
        return;
      }
      unlistenDragLeave = uDragLeave;

      const uDragDrop = await listen<DragDropPayload>("tauri://drag-drop", async (event) => {
        setDragActive(false);
        
        if (isIndexing) return;
        isIndexing = true;

        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          for (const path of paths) {
            try {
              await invoke("index_folder", { path });
              await emit("refresh-file-tree");
              success(`Indexing folder: ${path.split(/[\\/]/).pop()}`);
            } catch (err) {
              console.error(`Failed to index dropped path ${path}:`, err);
              showError(`Failed to index: ${path.split(/[\\/]/).pop()}`);
            }
          }
        }
        isIndexing = false;
      });
      if (!isMounted) {
        uDragDrop();
        return;
      }
      unlistenDragDrop = uDragDrop;
    };

    setupDragDrop();

    return () => {
      isMounted = false;
      unlistenDragEnter?.();
      unlistenDragLeave?.();
      unlistenDragDrop?.();
    };
  }, []);

  const handleSelectionChange = useCallback((paths: string[]) => {
    setSelectedPaths(paths);
  }, []);

  const handleSidebarChange = useCallback((tab: SidebarTab) => {
    if (tab === "files" || tab === "prompt") {
      setCurrentView("main");
      setActiveTab(tab);
    } else if (tab === "history" || tab === "settings") {
      setCurrentView(tab);
    }
  }, []);

  const handleHistoryRestore = useCallback((entry: unknown) => {
    console.log("Restoring history entry:", entry);
    setCurrentView("main");
    setActiveTab("prompt");
    success("Session restored");
  }, [success]);

  const handleAddFolder = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected) {
        await invoke("index_folder", { path: selected as string });
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
      description: "Are you sure you want to clear all indexed files? This action cannot be undone.",
      confirmText: "Clear All",
      cancelText: "Cancel",
      variant: "destructive",
      cancelButtonTestId: "confirm-dialog-cancel",
      confirmButtonTestId: "confirm-dialog-confirm",
    });

    if (!confirmed) return;

    try {
      // Save current session to history before clearing
      const saved = await saveToHistory();
      if (saved) {
        console.log("Session saved to history before clearing");
      }

      setShouldClearFileTree(true);
      await invoke("clear_index");
      setSelectedPaths([]);
      setCustomInstructions("");
      clearSession();

      // Emit refresh event instead of reloading the page
      await emit("refresh-file-tree");

      // Reset the clear flag after a short delay
      setTimeout(() => setShouldClearFileTree(false), 100);

      success("Context cleared");
    } catch (err) {
      console.error("Failed to clear index:", err);
      showError("Failed to clear context");
    }
  }, [confirm, success, showError, saveToHistory, clearSession, setCustomInstructions]);

  const handleCopyContext = useCallback(async () => {
    if (promptBuilderRef.current) {
      try {
        await promptBuilderRef.current.buildAndCopy();
        success("Context copied to clipboard");
      } catch (err) {
        console.error("Failed to copy context:", err);
        showError("Failed to copy context");
      }
    }
  }, [success, showError]);

  return (
    <LayoutProvider>
      {updateInfo && showUpdateView && updateStatus !== 'idle' && updateStatus !== 'checking' && (
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
          tokenCount={tokenCount}
          tokenLimit={settings.tokenLimit}
          version={appVersion}
          redactionCount={redactionCount}
          updateStatus={updateStatus}
        />

        <PromptView
          ref={promptBuilderRef}
          isActive={currentView === "main" && activeTab === "prompt"}
          selectedFilePaths={selectedPaths}
          onPromptBuilt={(prompt, redaction) => {
            console.log("Built prompt:", prompt);
            setRedactionCount(redaction);
          }}
          onCopy={handleCopyContext}
          tokenCount={tokenCount}
          tokenLimit={settings.tokenLimit}
          version={appVersion}
          redactionCount={redactionCount}
          updateStatus={updateStatus}
        />

        <HistoryView
          isActive={currentView === "history"}
          onRestore={handleHistoryRestore}
        />

        <SettingsView
          isActive={currentView === "settings"}
        />
      </AppLayout>
      <ConfirmDialog />
    </LayoutProvider>
  );
}

export default App;
