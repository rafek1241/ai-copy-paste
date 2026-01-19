import { useState, useEffect } from "react";
import { FileTree } from "./components/FileTree";
import { PromptBuilder } from "./components/PromptBuilder";
import { TokenCounter } from "./components/TokenCounter";
import BrowserAutomation from "./BrowserAutomation";
import HistoryPanel from "./components/HistoryPanel";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type View = "main" | "browser" | "history" | "settings";
type ActiveTab = "files" | "prompt";

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

function App() {
  const [currentView, setCurrentView] = useState<View>("main");
  const [activeTab, setActiveTab] = useState<ActiveTab>("files");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);

  useEffect(() => {
    let unlisten: any;

    const setupDragDrop = async () => {
      const unlistenFn = await listen<DragDropPayload>("tauri://drag-drop", async (event) => {
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          for (const path of paths) {
            try {
              await invoke("index_folder", { path });
            } catch (error) {
              console.error(`Failed to index dropped path ${path}:`, error);
            }
          }
          // Note: emit is naturally available or imported if needed, but here we focus on layout
        }
      });
      unlisten = unlistenFn;
    };

    setupDragDrop();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleSelectionChange = (paths: string[], ids: number[]) => {
    setSelectedPaths(paths);
    setSelectedFileIds(ids);
  };

  const handleHistoryRestore = (entry: any) => {
    console.log('Restoring history entry:', entry);
    setCurrentView("main");
  };

  return (
    <div className="flex h-screen w-screen border-t border-white/5 bg-background-dark text-[#c9d1d9] antialiased overflow-hidden" data-testid="app-container">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-10 flex items-center justify-between px-3 border-b border-border-dark bg-[#0d1117]">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">Project:</span>
            <span className="truncate font-semibold text-white">backend-api-v2</span>
            <span className="material-symbols-outlined text-[12px] text-white/30">expand_more</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/40">1,452 tokens</span>
            <button className="size-6 flex items-center justify-center rounded hover:bg-white/10">
              <span className="material-symbols-outlined text-[16px]">search</span>
            </button>
          </div>
        </header>

        <div className="tab-nav h-9 flex items-end px-3 gap-5 border-b border-border-dark bg-[#161b22] sticky top-0 z-20">
          <label
            className={`pb-2 text-[11px] font-medium cursor-pointer border-b-2 transition-all ${activeTab === "files" ? "text-white border-primary" : "text-white/50 border-transparent hover:text-white"}`}
            onClick={() => setActiveTab("files")}
          >
            Files
          </label>
          <label
            className={`pb-2 text-[11px] font-medium cursor-pointer border-b-2 transition-all ${activeTab === "prompt" ? "text-white border-primary" : "text-white/50 border-transparent hover:text-white"}`}
            onClick={() => setActiveTab("prompt")}
          >
            Prompt
          </label>
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          {currentView === "browser" ? (
            <BrowserAutomation />
          ) : currentView === "history" ? (
            <HistoryPanel onRestore={handleHistoryRestore} />
          ) : currentView === "settings" ? (
            <Settings />
          ) : (
            <>
              {activeTab === "files" ? (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
                  <FileTree onSelectionChange={handleSelectionChange} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-[#0d1117] p-3">
                  <PromptBuilder
                    selectedFileIds={selectedFileIds}
                    onPromptBuilt={(prompt) => {
                      console.log("Built prompt:", prompt);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </main>

        <footer className="p-2 border-t border-border-dark bg-[#0d1117] z-30">
          <button className="w-full h-9 bg-primary hover:bg-primary/90 text-white font-bold rounded flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-all active:scale-[0.98]">
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            <span className="text-[11px] uppercase tracking-wider">Copy Context</span>
          </button>
          <div className="mt-2 flex justify-between items-center px-1">
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[9px] font-medium text-white/40 uppercase">Ready to Paste</span>
            </div>
            <div className="text-[9px] text-white/20">v0.1.0</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
