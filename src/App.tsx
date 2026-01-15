import { useState } from "react";
import { FileTree } from "./components/FileTree";
import "./App.css";

interface IndexProgress {
  processed: number;
  total_estimate: number;
  current_path: string;
  errors: number;
}

function App() {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  const handleSelectionChange = (paths: string[]) => {
    setSelectedPaths(paths);
    console.log('Selected files:', paths);
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
        <FileTree onSelectionChange={handleSelectionChange} />
      </main>
    </div>
  );
}

export default App;
