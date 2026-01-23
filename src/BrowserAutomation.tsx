import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

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
    <div className="p-5 mx-auto h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-2">🤖 AI Context Collector - Browser Automation Test</h1>
      <p className="text-muted-foreground mb-8">
        Test Phase 6: Browser automation with Playwright
      </p>

      <div className="mb-5">
        <label className="block mb-2 font-bold text-sm">
          AI Interface:
        </label>
        <select
          value={interface_}
          onChange={(e) => setInterface(e.target.value)}
          className="w-full p-2.5 text-sm rounded-md border border-input bg-background"
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

      <div className="mb-5">
        <label className="block mb-2 font-bold text-sm">
          Prompt Text:
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-2.5 text-sm rounded-md border border-input bg-background min-h-[150px] font-mono"
          placeholder="Enter your prompt here..."
        />
        <div className="text-xs text-muted-foreground mt-1">
          {prompt.length} characters
        </div>
      </div>

      <div className="mb-5">
        <label className="block mb-2 font-bold text-sm">
          Custom URL (optional):
        </label>
        <Input
          type="text"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="Leave empty to use default URL"
        />
      </div>

      <Button
        onClick={launchBrowser}
        disabled={loading}
        className="w-full py-3 text-base font-bold"
        size="lg"
      >
        {loading ? "Launching..." : "🚀 Launch Browser"}
      </Button>

      {status && (
        <div className="mt-5 p-3 bg-green-50 border border-green-200 rounded-md text-green-800">
          {status}
        </div>
      )}

      {error && (
        <div className="mt-5 p-3 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      <div className="mt-10 p-5 bg-muted rounded-lg">
        <h3 className="text-lg font-semibold mb-3">How it works:</h3>
        <ol className="list-decimal list-inside space-y-1 mb-4">
          <li>Select an AI interface (ChatGPT, Claude, etc.)</li>
          <li>Enter your prompt text</li>
          <li>Click "Launch Browser"</li>
          <li>The browser will open and navigate to the AI interface</li>
          <li>The prompt will be automatically filled</li>
          <li>The browser stays open for you to review and submit</li>
        </ol>

        <h3 className="text-lg font-semibold mb-3">Key Features:</h3>
        <ul className="list-disc list-inside space-y-1">
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
