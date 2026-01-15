import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * BrowserAutomation component - Test interface for Phase 6 browser automation
 * 
 * This component allows testing the browser automation sidecar by:
 * 1. Selecting an AI interface
 * 2. Entering prompt text
 * 3. Launching the browser with the prompt filled
 */
function BrowserAutomation() {
  const [interface_, setInterface] = useState<string>("chatgpt");
  const [prompt, setPrompt] = useState<string>("Explain how React hooks work in simple terms.");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [availableInterfaces, setAvailableInterfaces] = useState<string[]>([]);

  // Load available interfaces on mount
  useEffect(() => {
    invoke<string[]>("get_available_interfaces")
      .then((interfaces) => {
        setAvailableInterfaces(interfaces);
      })
      .catch((err) => {
        console.error("Failed to load interfaces:", err);
        setAvailableInterfaces(["chatgpt", "claude", "gemini", "aistudio"]);
      });
  }, []);

  async function launchBrowser() {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setLoading(true);
    setStatus("Launching browser...");
    setError("");

    try {
      await invoke("launch_browser", {
        interface: interface_,
        text: prompt,
        customUrl: customUrl || null,
      });

      setStatus("✓ Browser launched successfully! Check your browser window.");
      setLoading(false);
    } catch (err) {
      setError(`Failed to launch browser: ${err}`);
      setStatus("");
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "20px", margin: "0 auto", height: "100%", overflowY: "auto" }}>
      <h1>🤖 AI Context Collector - Browser Automation Test</h1>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        Test Phase 6: Browser automation with Playwright
      </p>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          AI Interface:
        </label>
        <select
          value={interface_}
          onChange={(e) => setInterface(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "14px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        >
          {availableInterfaces.length > 0 ? (
            availableInterfaces.map((iface) => (
              <option key={iface} value={iface}>
                {iface.charAt(0).toUpperCase() + iface.slice(1)}
              </option>
            ))
          ) : (
            <>
              <option value="chatgpt">ChatGPT</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="aistudio">AI Studio</option>
            </>
          )}
        </select>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Prompt Text:
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "14px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            minHeight: "150px",
            fontFamily: "monospace",
          }}
          placeholder="Enter your prompt here..."
        />
        <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
          {prompt.length} characters
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Custom URL (optional):
        </label>
        <input
          type="text"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "14px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
          placeholder="Leave empty to use default URL"
        />
      </div>

      <button
        onClick={launchBrowser}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "16px",
          fontWeight: "bold",
          backgroundColor: loading ? "#ccc" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Launching..." : "🚀 Launch Browser"}
      </button>

      {status && (
        <div
          style={{
            marginTop: "20px",
            padding: "12px",
            backgroundColor: "#d4edda",
            border: "1px solid #c3e6cb",
            borderRadius: "4px",
            color: "#155724",
          }}
        >
          {status}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: "20px",
            padding: "12px",
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "4px",
            color: "#721c24",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: "40px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
        <h3>How it works:</h3>
        <ol>
          <li>Select an AI interface (ChatGPT, Claude, etc.)</li>
          <li>Enter your prompt text</li>
          <li>Click "Launch Browser"</li>
          <li>The browser will open and navigate to the AI interface</li>
          <li>The prompt will be automatically filled</li>
          <li>The browser stays open for you to review and submit</li>
        </ol>

        <h3 style={{ marginTop: "20px" }}>Key Features:</h3>
        <ul>
          <li>✓ Browser remains open after automation</li>
          <li>✓ Multiple fallback selectors for robustness</li>
          <li>✓ Anti-automation detection mitigations</li>
          <li>✓ Persistent context maintains login sessions</li>
        </ul>
      </div>
    </div>
  );
}

export default BrowserAutomation;
