import React, { useState, useEffect } from "react";
import {
  getTemplates,
  buildPromptFromFiles,
  PromptTemplate,
  BuildPromptResponse,
} from "../services/prompts";
import { TokenCounter } from "./TokenCounter";
import { ModelName } from "../services/tokenizer";

interface PromptBuilderProps {
  selectedFileIds: number[];
  onPromptBuilt?: (prompt: string) => void;
}

export const PromptBuilder: React.FC<PromptBuilderProps> = ({
  selectedFileIds,
  onPromptBuilt,
}) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("agent");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [builtPrompt, setBuiltPrompt] = useState<string>("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string>("");
  const [buildResponse, setBuildResponse] = useState<BuildPromptResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelName>("gpt-4o");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const templateList = await getTemplates();
      setTemplates(templateList);
    } catch (err) {
      setError(`Failed to load templates: ${err}`);
    }
  };

  const handleBuildPrompt = async () => {
    if (selectedFileIds.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setIsBuilding(true);
    setError("");

    try {
      const response = await buildPromptFromFiles({
        template_id: selectedTemplate,
        custom_instructions: customInstructions || undefined,
        file_ids: selectedFileIds,
      });

      setBuiltPrompt(response.prompt);
      setBuildResponse(response);

      // Copy to clipboard automatically
      await navigator.clipboard.writeText(response.prompt);

      if (onPromptBuilt) {
        onPromptBuilt(response.prompt);
      }
    } catch (err) {
      setError(`Failed to build prompt: ${err}`);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(builtPrompt);
      alert("Prompt copied to clipboard!");
    } catch (err) {
      setError(`Failed to copy to clipboard: ${err}`);
    }
  };

  const selectedTemplateObj = templates.find((t) => t.id === selectedTemplate);

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }} data-testid="prompt-builder">
      <h2 style={{ marginBottom: "20px" }} data-testid="prompt-builder-title">Prompt Builder</h2>

      {/* Template Selection */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>
          Select Template:
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          data-testid="template-select"
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "14px",
            borderRadius: "4px",
            border: "1px solid #ddd",
          }}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        {selectedTemplateObj && (
          <div style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "#666",
            fontStyle: "italic"
          }} data-testid="template-description">
            {selectedTemplateObj.description}
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>
          Target AI Model:
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as ModelName)}
          data-testid="model-select"
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "14px",
            borderRadius: "4px",
            border: "1px solid #ddd",
          }}
        >
          <option value="gpt-4o">GPT-4o (128K tokens)</option>
          <option value="gpt-4o-mini">GPT-4o Mini (128K tokens)</option>
          <option value="gpt-4-turbo">GPT-4 Turbo (128K tokens)</option>
          <option value="gpt-4">GPT-4 (8K tokens)</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo (16K tokens)</option>
          <option value="claude-3-opus">Claude 3 Opus (200K tokens)</option>
          <option value="claude-3-sonnet">Claude 3 Sonnet (200K tokens)</option>
          <option value="claude-3-haiku">Claude 3 Haiku (200K tokens)</option>
          <option value="gemini-pro">Gemini Pro (32K tokens)</option>
        </select>
      </div>

      {/* Custom Instructions */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>
          Custom Instructions (optional):
        </label>
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="Add any specific instructions or context..."
          data-testid="custom-instructions"
          style={{
            width: "100%",
            minHeight: "100px",
            padding: "10px",
            fontSize: "14px",
            borderRadius: "4px",
            border: "1px solid #ddd",
            fontFamily: "monospace",
            resize: "vertical",
          }}
        />
      </div>

      {/* File Selection Info */}
      <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "#f0f0f0", borderRadius: "4px" }} data-testid="selected-files-info">
        <strong>Selected Files:</strong> {selectedFileIds.length}
        {buildResponse && (
          <span style={{ marginLeft: "20px", color: "#666" }} data-testid="build-response-info">
            ({buildResponse.file_count} files, {buildResponse.total_chars.toLocaleString()} characters)
          </span>
        )}
      </div>

      {/* Build Button */}
      <button
        onClick={handleBuildPrompt}
        disabled={isBuilding || selectedFileIds.length === 0}
        data-testid="build-prompt-btn"
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          fontWeight: "bold",
          backgroundColor: isBuilding ? "#ccc" : "#28a745",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: isBuilding ? "not-allowed" : "pointer",
          width: "100%",
          marginBottom: "20px",
        }}
      >
        {isBuilding ? "Building..." : "Build & Copy to Clipboard"}
      </button>

      {/* Error Display */}
      {error && (
        <div
          data-testid="error-display"
          style={{
            padding: "12px",
            backgroundColor: "#ffebee",
            color: "#c62828",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* Token Counter */}
      {builtPrompt && (
        <div style={{ marginBottom: "20px" }} data-testid="token-counter-wrapper">
          <TokenCounter text={builtPrompt} modelName={selectedModel} />
        </div>
      )}

      {/* Prompt Preview */}
      {builtPrompt && (
        <div style={{ marginBottom: "20px" }} data-testid="prompt-preview-section">
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px"
          }}>
            <h3 style={{ margin: 0 }}>Prompt Preview:</h3>
            <button
              onClick={handleCopyToClipboard}
              data-testid="copy-clipboard-btn"
              style={{
                padding: "8px 16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              Copy to Clipboard
            </button>
          </div>
          <div
            data-testid="prompt-preview"
            style={{
              padding: "16px",
              backgroundColor: "#f8f9fa",
              border: "1px solid #ddd",
              borderRadius: "4px",
              maxHeight: "500px",
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: "13px",
              whiteSpace: "pre-wrap",
              lineHeight: "1.5",
            }}
          >
            {builtPrompt}
          </div>
        </div>
      )}
    </div>
  );
};
