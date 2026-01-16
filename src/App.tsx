import { useState } from "react";
import { FileTree } from "./components/FileTree";
import { PromptBuilder } from "./components/PromptBuilder";
import BrowserAutomation from "./BrowserAutomation";
import HistoryPanel from "./components/HistoryPanel";
import Settings from "./components/Settings";
import { Button } from "./components/ui/button";
import { ScrollArea } from "./components/ui/scroll-area";
import "./App.css";

type View = "main" | "browser" | "history" | "settings";

function App() {
  const [currentView, setCurrentView] = useState<View>("main");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);

  const handleSelectionChange = (paths: string[], ids: number[]) => {
    setSelectedPaths(paths);
    setSelectedFileIds(ids);
    console.log('Selected files:', paths);
    console.log('Selected IDs:', ids);
  };

  const handleHistoryRestore = (entry: any) => {
    console.log('Restoring history entry:', entry);
    // TODO: Implement history restore logic
    // This would involve re-indexing the root paths and selecting the files
    alert('History restore functionality will be implemented');
    setCurrentView("main");
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 bg-secondary border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">AI Context Collector</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={currentView === "main" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCurrentView("main")}
          >
            Main
          </Button>
          <Button
            variant={currentView === "browser" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCurrentView("browser")}
          >
            Browser
          </Button>
          <Button
            variant={currentView === "history" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCurrentView("history")}
          >
            History
          </Button>
          <Button
            variant={currentView === "settings" ? "default" : "secondary"}
            size="sm"
            onClick={() => setCurrentView("settings")}
          >
            Settings
          </Button>
          {selectedPaths.length > 0 && currentView === "main" && (
            <span className="ml-4 text-sm text-muted-foreground">
              {selectedPaths.length} file(s) selected
            </span>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {currentView === "browser" ? (
          <BrowserAutomation />
        ) : currentView === "history" ? (
          <HistoryPanel onRestore={handleHistoryRestore} />
        ) : currentView === "settings" ? (
          <Settings />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full overflow-hidden p-5">
            <ScrollArea className="h-full">
              <FileTree onSelectionChange={handleSelectionChange} />
            </ScrollArea>
            <ScrollArea className="h-full">
              <PromptBuilder
                selectedFileIds={selectedFileIds}
                onPromptBuilt={(prompt) => {
                  console.log("Built prompt:", prompt);
                }}
              />
            </ScrollArea>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
