import { useState } from "react";
import { FileTree } from "./components/FileTree";
import { PromptBuilder } from "./components/PromptBuilder";
import BrowserAutomation from "./BrowserAutomation";
import "./App.css";

type View = "main" | "browser";

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

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>AI Context Collector</h1>
        <div className="selection-info">
          <button
            onClick={() => setCurrentView(currentView === "main" ? "browser" : "main")}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              backgroundColor: currentView === "browser" ? "#28a745" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginRight: "10px",
            }}
          >
            {currentView === "main" ? "Browser Automation" : "Back to Main"}
          </button>
          {selectedPaths.length > 0 && currentView === "main" && (
            <span>{selectedPaths.length} file(s) selected</span>
          )}
        </div>
      </header>
      <main className="app-main">
        {currentView === "browser" ? (
          <BrowserAutomation />
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
