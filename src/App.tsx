import { useState } from "react";
import { FileTree } from "./components/FileTree";
import { PromptBuilder } from "./components/PromptBuilder";
import "./App.css";

function App() {
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
          {selectedPaths.length > 0 && (
            <span>{selectedPaths.length} file(s) selected</span>
          )}
        </div>
      </header>
      <main className="app-main">
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
      </main>
    </div>
  );
}

export default App;
