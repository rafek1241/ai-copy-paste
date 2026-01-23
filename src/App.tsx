import { useState, useEffect, useRef } from "react";
import { FileTree } from "./components/FileTree";
import { PromptBuilder, PromptBuilderHandle } from "./components/PromptBuilder";
import HistoryPanel from "./components/HistoryPanel";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import MainTabs, { ActiveTab } from "./components/MainTabs";
import Footer from "./components/Footer";
import { SidebarTab } from "./components/Sidebar";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type View = "main" | "history" | "settings";

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

function App() {
  const [currentView, setCurrentView] = useState<View>("main");
  const [activeTab, setActiveTab] = useState<ActiveTab>("files");
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [shouldClearFileTree, setShouldClearFileTree] = useState<boolean>(false);
  const promptBuilderRef = useRef<PromptBuilderHandle>(null);

  // TODO: Add real token counting logic. For now, using a placeholder or calculating based on file size approximation if possible, 
  // or simple mock to satisfy the UI requirement until backend integration.
  // Assuming a rough estimate or 0 for now until calculated by PromptBuilder or backend.
  const [tokenCount] = useState<number>(0);
  const tokenLimit = 120000; // Example limit, should probably come from implementation

  useEffect(() => {
    let unlistenDragDrop: any;
    let unlistenDragEnter: any;
    let unlistenDragLeave: any;

    const setupDragDrop = async () => {
      unlistenDragEnter = await listen("tauri://drag-enter", () => {
        setDragActive(true);
      });

      unlistenDragLeave = await listen("tauri://drag-leave", () => {
        setDragActive(false);
      });

      unlistenDragDrop = await listen<DragDropPayload>("tauri://drag-drop", async (event) => {
        setDragActive(false);
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          for (const path of paths) {
            try {
              await invoke("index_folder", { path });
            } catch (error) {
              console.error(`Failed to index dropped path ${path}:`, error);
            }
          }
        }
      });
    };

    setupDragDrop();

    return () => {
      if (unlistenDragEnter) unlistenDragEnter();
      if (unlistenDragLeave) unlistenDragLeave();
      if (unlistenDragDrop) unlistenDragDrop();
    };
  }, []);

  const handleSelectionChange = (paths: string[], ids: number[]) => {
    setSelectedFileIds(ids);
    setSelectedPaths(paths);
  };

  const handleSidebarChange = (tab: SidebarTab) => {
    if (tab === "files" || tab === "prompt") {
      setCurrentView("main");
      setActiveTab(tab);
    } else if (tab === "history" || tab === "settings") {
      setCurrentView(tab);
    }
  };

  const handleHistoryRestore = (entry: any) => {
    console.log('Restoring history entry:', entry);
    setCurrentView("main");
    setActiveTab("prompt");
  };

  const handleAddFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected) {
        await invoke('index_folder', { path: selected as string });
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  };

  const handleClearContext = async () => {
    try {
      setShouldClearFileTree(true);
      await invoke('clear_index');
      setSelectedFileIds([]);
      setSelectedPaths([]);
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear index:', error);
    }
  };

  const handleCopyContext = async () => {
    if (promptBuilderRef.current) {
      await promptBuilderRef.current.buildAndCopy();
    }
  };

  return (
    <div className="flex h-screen w-screen border-t border-white/5 bg-[#010409] text-[#c9d1d9] antialiased overflow-hidden font-sans" data-testid="app-container">
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

        <main className="flex-1 flex flex-col overflow-hidden">
          {currentView === "history" ? (
            <HistoryPanel onRestore={handleHistoryRestore} />
          ) : currentView === "settings" ? (
            <Settings />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab === "files" ? (
                <FileTree
                  onSelectionChange={handleSelectionChange}
                  searchQuery={searchQuery}
                  initialSelectedPaths={selectedPaths}
                  shouldClearSelection={shouldClearFileTree}
                />
              ) : (
                <PromptBuilder
                  ref={promptBuilderRef}
                  selectedFileIds={selectedFileIds}
                  onPromptBuilt={(prompt) => {
                    console.log("Built prompt:", prompt);
                  }}
                />
              )}
            </div>
          )}
        </main>

        {currentView === "main" && (
          <Footer
            onCopy={handleCopyContext}
            tokenCount={tokenCount}
            tokenLimit={tokenLimit}
            version="0.1.0"
          />
        )}
      </div>

      {dragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#010409]/50 backdrop-blur-sm">
          <div className="border-2 border-dashed border-[#c9d1d9] w-96 h-96 flex items-center justify-center rounded-lg">
            <span className="text-[#c9d1d9] text-2xl font-medium">Drop here</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
