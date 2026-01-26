import { useState, useEffect, useRef, useCallback } from "react";
import { FileTree } from "./components/FileTree";
import { PromptBuilder, PromptBuilderHandle } from "./components/PromptBuilder";
import HistoryPanel from "./components/HistoryPanel";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import MainTabs, { ActiveTab } from "./components/MainTabs";
import Footer from "./components/Footer";
import { SidebarTab } from "./components/Sidebar";
import { listen, emit, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "./components/ui/toast";
import { useConfirmDialog } from "./components/ui/alert-dialog";
import { useAppSettings, useAppCustomInstructions } from "./contexts/AppContext";
import { useSessionPersistence } from "./hooks/useSessionPersistence";
import "./App.css";

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
    <>
      <div
        className="flex h-screen w-screen border-t border-white/5 bg-[#010409] text-[#c9d1d9] antialiased overflow-hidden font-sans"
        data-testid="app-container"
      >
        <Sidebar
          activeTab={currentView === "main" ? activeTab : currentView}
          onTabChange={handleSidebarChange}
        />

        <div className="flex-1 flex flex-col min-w-0 relative bg-background-dark">
          <Header
            onAddFolder={handleAddFolder}
            onSearch={setSearchQuery}
            onClear={handleClearContext}
          />

          {currentView === "main" && (
            <MainTabs activeTab={activeTab} onTabChange={setActiveTab} />
          )}

          <main className="flex-1 flex flex-col overflow-hidden" role="main">
            {currentView === "history" ? (
              <HistoryPanel onRestore={handleHistoryRestore} />
            ) : currentView === "settings" ? (
              <Settings />
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Keep both components mounted but hide inactive one to preserve state */}
                <div className={activeTab === "files" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
                  <FileTree
                    onSelectionChange={handleSelectionChange}
                    searchQuery={searchQuery}
                    initialSelectedPaths={selectedPaths}
                    shouldClearSelection={shouldClearFileTree}
                  />
                </div>
                <div className={activeTab === "prompt" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
                  <PromptBuilder
                    ref={promptBuilderRef}
                    selectedFilePaths={selectedPaths}
                    onPromptBuilt={(prompt) => {
                      console.log("Built prompt:", prompt);
                    }}
                  />
                </div>
              </div>
            )}
          </main>

          {currentView === "main" && (
            <Footer
              onCopy={handleCopyContext}
              tokenCount={tokenCount}
              tokenLimit={settings.tokenLimit}
              version="0.1.0"
            />
          )}
        </div>

        {/* Drag and drop overlay */}
        {dragActive && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#010409]/60 backdrop-blur-sm"
            role="presentation"
            aria-label="Drop zone active"
          >
            <div className="border-2 border-dashed border-primary/50 bg-primary/5 w-80 h-80 flex flex-col items-center justify-center rounded-xl gap-4">
              <span className="material-symbols-outlined text-primary text-5xl">folder_open</span>
              <span className="text-white/80 text-lg font-medium">Drop folder here</span>
              <span className="text-white/40 text-xs">to add to context</span>
            </div>
          </div>
        )}
      </div>

      {/* Render the confirm dialog */}
      <ConfirmDialog />
    </>
  );
}

export default App;
