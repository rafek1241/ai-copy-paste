import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  getTemplates,
  PromptTemplate,
} from "../services/prompts";
import { assemblePrompt } from "../services/assembly";
import { cn } from "@/lib/utils";

interface PromptBuilderProps {
  selectedFileIds: number[];
  onPromptBuilt?: (prompt: string) => void;
}

export interface PromptBuilderHandle {
  buildAndCopy: () => Promise<void>;
}

export const PromptBuilder = forwardRef<PromptBuilderHandle, PromptBuilderProps>(({
  selectedFileIds,
  onPromptBuilt,
}, ref) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("agent");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [error, setError] = useState<string>("");

  useImperativeHandle(ref, () => ({
    buildAndCopy: handleBuildPrompt
  }));

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

    setError("");

    try {
      const response = await assemblePrompt({
        templateId: selectedTemplate,
        customInstructions: customInstructions || undefined,
        fileIds: selectedFileIds,
      });

      // Copy to clipboard automatically
      await navigator.clipboard.writeText(response.prompt);

      if (onPromptBuilt) {
        onPromptBuilt(response.prompt);
      }
    } catch (err) {
      setError(`Failed to build prompt: ${err}`);
      throw err;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-[#0d1117] p-3 gap-4" data-testid="prompt-builder">
      {/* Custom Instructions */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Custom Instructions</label>
        <div className="relative">
          <textarea
            className="w-full h-32 bg-[#161b22] border border-border-dark rounded-md p-3 text-white/90 placeholder-white/20 font-mono text-[11px] leading-relaxed resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            placeholder="Describe how the context should be processed..."
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            data-testid="custom-instructions"
          ></textarea>
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white" title="Insert Variable">
              <span className="material-symbols-outlined text-[14px]">data_object</span>
            </button>
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Templates</label>
          <button className="text-[10px] text-primary hover:text-primary/80">Manage</button>
        </div>

        <div className="grid grid-cols-2 gap-2" data-testid="templates-grid">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={cn(
                "flex flex-col gap-1 p-2 rounded border transition-all text-left group",
                selectedTemplate === template.id
                  ? "bg-[#161b22] border-primary/50 ring-1 ring-primary/20"
                  : "border-border-dark bg-[#161b22]/50 hover:bg-[#161b22] hover:border-white/20"
              )}
            >
              <div className={cn(
                "flex items-center gap-1.5 group-hover:text-blue-300",
                getTemplateColor(template.id)
              )}>
                <span className="material-symbols-outlined text-[16px]">{getTemplateIcon(template.id)}</span>
                <span className="text-[10px] font-semibold text-white/90">{template.name}</span>
              </div>
              <p className="text-[9px] text-white/40 line-clamp-2">{template.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-2 p-2 rounded border border-dashed border-border-dark flex items-center justify-center gap-2 text-white/30 hover:text-white/50 hover:border-white/20 cursor-pointer transition-colors">
          <span className="material-symbols-outlined text-[14px]">add_circle</span>
          <span className="text-[10px]">Create New Template</span>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-900/20 border border-red-900/50 text-red-200 rounded text-[10px]" data-testid="error-display">
          {error}
        </div>
      )}
    </div>
  );
});

function getTemplateIcon(id: string): string {
  switch (id) {
    case 'agent': return 'smart_toy';
    case 'refactor': return 'architecture';
    case 'fix': return 'bug_report'; // Assuming 'Find Bugs' maps to 'fix'
    case 'explain': return 'menu_book';
    case 'audit': return 'security'; // Security audit
    default: return 'description';
  }
}

function getTemplateColor(id: string): string {
  switch (id) {
    case 'agent': return 'text-blue-400';
    case 'refactor': return 'text-green-400';
    case 'fix': return 'text-red-400';
    case 'explain': return 'text-purple-400';
    case 'audit': return 'text-yellow-400';
    default: return 'text-blue-400';
  }
}
