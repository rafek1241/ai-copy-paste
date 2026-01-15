import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

interface IndexProgress {
  processed: number;
  total_estimate: number;
  current_path: string;
  errors: number;
}

function App() {
  const [folderPath, setFolderPath] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [result, setResult] = useState("");

  useEffect(() => {
    // Listen for indexing progress events
    const unlisten = listen<IndexProgress>("indexing-progress", (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function indexFolder() {
    if (!folderPath) {
      setResult("Please enter a folder path");
      return;
    }

    setIndexing(true);
    setProgress(null);
    setResult("");

    try {
      const count = await invoke<number>("index_folder", { path: folderPath });
      setResult(`Successfully indexed ${count} files and folders!`);
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setIndexing(false);
    }
  }

  return (
    <main className="container">
      <h1>AI Context Collector - Phase 2</h1>
      <p>Parallel file indexing with progress reporting</p>

      <div className="card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            indexFolder();
          }}
        >
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="Enter folder path to index..."
            disabled={indexing}
            style={{ width: "100%", marginBottom: "10px" }}
          />
          <button type="submit" disabled={indexing}>
            {indexing ? "Indexing..." : "Index Folder"}
          </button>
        </form>

        {progress && (
          <div style={{ marginTop: "20px" }}>
            <h3>Indexing Progress:</h3>
            <p>Processed: {progress.processed} files</p>
            <p>Current: {progress.current_path}</p>
            <p>Errors: {progress.errors}</p>
            <div
              style={{
                width: "100%",
                height: "20px",
                backgroundColor: "#e0e0e0",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(
                    (progress.processed / progress.total_estimate) * 100,
                    100
                  )}%`,
                  height: "100%",
                  backgroundColor: "#4caf50",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {result && (
          <div
            style={{
              marginTop: "20px",
              padding: "10px",
              backgroundColor: result.startsWith("Error")
                ? "#ffebee"
                : "#e8f5e9",
              borderRadius: "5px",
            }}
          >
            <p>{result}</p>
          </div>
        )}

        <div style={{ marginTop: "30px", textAlign: "left" }}>
          <h3>Test Examples:</h3>
          <ul style={{ fontSize: "0.9em" }}>
            <li>
              <strong>Small:</strong> ./src (few hundred files)
            </li>
            <li>
              <strong>Medium:</strong> ./node_modules (10k-50k files)
            </li>
            <li>
              <strong>Large:</strong> System folder (platform-specific)
            </li>
          </ul>
          <p style={{ fontSize: "0.8em", color: "#666" }}>
            <strong>Note:</strong> Progress events are throttled to max 10/sec
            for performance. Check the browser console for detailed logs.
          </p>
        </div>
      </div>

      <div style={{ marginTop: "30px", fontSize: "0.8em", color: "#888" }}>
        <p>
          <strong>Phase 2 Features:</strong> Parallel traversal with walkdir +
          rayon • Batch SQLite inserts (1000/transaction) • Progress reporting
          • Error recovery • Symlink skipping
        </p>
      </div>
    </main>
  );
}

export default App;
