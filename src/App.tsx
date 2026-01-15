import { useState } from "react";
import { PromptBuilder } from "./components/PromptBuilder";
import "./App.css";

function App() {
  // Demo: In a real app, these would come from file tree selection
  const [selectedFileIds] = useState<number[]>([]);
  const [showDemo, setShowDemo] = useState(false);

  return (
    <main className="container" style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px" }}>
      <h1>AI Context Collector - Phase 5</h1>
      <p style={{ fontSize: "16px", color: "#666", marginBottom: "30px" }}>
        Token counting and prompt building demonstration
      </p>

      <div style={{ 
        padding: "20px", 
        backgroundColor: "#f0f8ff", 
        borderRadius: "8px",
        marginBottom: "30px",
        border: "1px solid #b0d4ff"
      }}>
        <h3 style={{ marginTop: 0 }}>Phase 5 Features Implemented:</h3>
        <ul style={{ lineHeight: "1.8", fontSize: "14px" }}>
          <li>✅ Token counting using <code>gpt-tokenizer</code></li>
          <li>✅ Real-time token counter with visual indicators</li>
          <li>✅ Support for multiple AI models (GPT-4o, Claude, Gemini, etc.)</li>
          <li>✅ Token limit warnings (color-coded progress bar)</li>
          <li>✅ Six built-in prompt templates (Agent, Planning, Debugging, Review, Documentation, Testing)</li>
          <li>✅ Prompt building from selected files</li>
          <li>✅ Custom instructions support</li>
          <li>✅ Prompt preview with syntax highlighting</li>
          <li>✅ Copy to clipboard functionality</li>
        </ul>
      </div>

      <div style={{ 
        padding: "15px", 
        backgroundColor: "#fff3cd", 
        borderRadius: "8px",
        marginBottom: "30px",
        border: "1px solid #ffc107"
      }}>
        <strong>Note:</strong> To use the prompt builder, first index a folder using the indexing commands,
        then select files from the tree view. This demo shows the UI components without actual file selection.
        <button
          onClick={() => setShowDemo(!showDemo)}
          style={{
            marginLeft: "20px",
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          {showDemo ? "Hide Demo" : "Show Demo UI"}
        </button>
      </div>

      {showDemo && (
        <PromptBuilder 
          selectedFileIds={selectedFileIds}
          onPromptBuilt={(prompt) => {
            console.log("Built prompt:", prompt);
          }}
        />
      )}

      <div style={{ 
        marginTop: "40px",
        padding: "20px",
        backgroundColor: "#f9f9f9",
        borderRadius: "8px",
        border: "1px solid #ddd"
      }}>
        <h3>Backend Commands Available:</h3>
        <div style={{ fontFamily: "monospace", fontSize: "13px", lineHeight: "1.8" }}>
          <div>• <code>get_templates()</code> - Get all prompt templates</div>
          <div>• <code>get_file_content(file_id)</code> - Get content of a single file</div>
          <div>• <code>get_file_contents(file_ids)</code> - Get content of multiple files</div>
          <div>• <code>build_prompt_from_files(request)</code> - Build prompt from template and files</div>
        </div>
      </div>

      <div style={{ 
        marginTop: "20px",
        padding: "15px",
        backgroundColor: "#e8f5e9",
        borderRadius: "8px",
        border: "1px solid #4caf50"
      }}>
        <h3 style={{ marginTop: 0, color: "#2e7d32" }}>Next Steps:</h3>
        <p style={{ fontSize: "14px", margin: 0 }}>
          Phase 5 is complete! The next phase (Phase 6) will implement browser automation 
          with Playwright to automatically fill AI chat interfaces.
        </p>
      </div>
    </main>
  );
}

export default App;
