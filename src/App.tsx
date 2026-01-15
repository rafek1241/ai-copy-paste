import { useState } from "react";
import { FileTree } from "./components/FileTree";
import { PromptBuilder } from "./components/PromptBuilder";
import BrowserAutomation from "./BrowserAutomation";
import HistoryPanel from "./components/HistoryPanel";
import Settings from "./components/Settings";
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

  const renderNavButton = (view: View, label: string) => (
    <button
      onClick={() => setCurrentView(view)}
      style={{
        padding: "8px 16px",
        fontSize: "14px",
        backgroundColor: currentView === view ? "#0e639c" : "#3e3e42",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        marginRight: "8px",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>AI Context Collector</h1>
        <div className="selection-info">
          {renderNavButton("main", "Main")}
          {renderNavButton("browser", "Browser")}
          {renderNavButton("history", "History")}
          {renderNavButton("settings", "Settings")}
          {selectedPaths.length > 0 && currentView === "main" && (
            <span style={{ marginLeft: "16px" }}>{selectedPaths.length} file(s) selected</span>
          )}
        </div>
      </header>
      <main className="app-main">
        {currentView === "browser" ? (
          <BrowserAutomation />
        ) : currentView === "history" ? (
          <HistoryPanel onRestore={handleHistoryRestore} />
        ) : currentView === "settings" ? (
          <Settings />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", height: "100%" }}>
            <div>
              <FileTree onSelectionChange={handleSelectionChange} />
            </div>
            <div style={{ overflowY: "auto" }}>
              <PromptBuilder
                selectedFileIds={selectedFileIds}
                onPromptBuilt={(prompt) => {
                  console.log("Built prompt:", prompt);
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
