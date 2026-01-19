import React, { useState, useEffect } from "react";
import {
  getTemplates,
  buildPromptFromFiles,
  PromptTemplate,
  BuildPromptResponse,
} from "../services/prompts";
import { TokenCounter } from "./TokenCounter";
import { ModelName } from "../services/tokenizer";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

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
    <div className="p-5 max-w-7xl mx-auto space-y-5" data-testid="prompt-builder">
      <h2 className="text-xl font-semibold mb-5" data-testid="prompt-builder-title">Prompt Builder</h2>

      {/* Template Selection */}
      <div className="space-y-2">
        <label className="block font-semibold text-sm">
          Select Template:
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="template-select"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        {selectedTemplateObj && (
          <div className="mt-2 text-xs text-muted-foreground italic" data-testid="template-description">
            {selectedTemplateObj.description}
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="block font-semibold text-sm">
          Target AI Model:
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as ModelName)}
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="model-select"
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
      <div className="space-y-2">
        <label className="block font-semibold text-sm">
          Custom Instructions (optional):
        </label>
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="Add any specific instructions or context..."
          className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="custom-instructions"
        />
      </div>

      {/* Token Counter */}
      <div data-testid="token-counter-wrapper">
        <TokenCounter 
          text={builtPrompt || customInstructions} 
          selectedFileIds={builtPrompt ? [] : selectedFileIds} 
          modelName={selectedModel} 
        />
      </div>

      {/* File Selection Info */}
      <Card data-testid="selected-files-info">
        <CardContent className="pt-6">
          <span className="font-semibold">Selected Files:</span> {selectedFileIds.length}
          {buildResponse && (
            <span className="ml-5 text-muted-foreground" data-testid="build-response-info">
              ({buildResponse.file_count} files, {buildResponse.total_chars.toLocaleString()} characters)
            </span>
          )}
        </CardContent>
      </Card>

      {/* Build Button */}
      <Button
        onClick={handleBuildPrompt}
        disabled={isBuilding || selectedFileIds.length === 0}
        className="w-full"
        size="lg"
        data-testid="build-prompt-btn"
      >
        {isBuilding ? "Building..." : "Build & Copy to Clipboard"}
      </Button>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm" data-testid="error-display">
          {error}
        </div>
      )}

      {/* Prompt Preview */}
      {builtPrompt && (
        <Card data-testid="prompt-preview-section">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Prompt Preview</CardTitle>
              <Button
                onClick={handleCopyToClipboard}
                variant="default"
                size="sm"
                data-testid="copy-clipboard-btn"
              >
                Copy to Clipboard
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed" data-testid="prompt-preview">
                {builtPrompt}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
