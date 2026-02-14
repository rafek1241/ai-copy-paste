import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  getTemplates,
  PromptTemplate,
} from "../services/prompts";
import { assemblePrompt } from "../services/assembly";
import { cn } from "@/lib/utils";
import { useAppCustomInstructions } from "../contexts/AppContext";
import { PlusCircle, Bot, PencilRuler, Bug, BookOpen, Shield, FileText } from "lucide-react";

interface PromptBuilderProps {
  selectedFilePaths: string[];
  onPromptBuilt?: (prompt: string, redactionCount: number) => void;
}

export interface PromptBuilderHandle {
  buildAndCopy: () => Promise<void>;
}

export const PromptBuilder = forwardRef<PromptBuilderHandle, PromptBuilderProps>(({
  selectedFilePaths,
  onPromptBuilt,
}, ref) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const { customInstructions, setCustomInstructions } = useAppCustomInstructions();
  const [error, setError] = useState<string>("");

  console.log('PromptBuilder render error:', error);

  useImperativeHandle(ref, () => ({
    buildAndCopy: handleBuildPrompt
  }));

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const templateList = await getTemplates();
      setTemplates(templateList.filter(t => t.id !== 'custom'));
    } catch (err) {
      setError(`Failed to load templates: ${err}`);
    }
  };

  const handleBuildPrompt = async () => {
    if (selectedFilePaths.length === 0 && !customInstructions.trim()) {
      setError("Please select files or enter custom instructions");
      return;
    }

    setError("");

    try {
      const trimmedInstructions = customInstructions.trim();

      // If only custom instructions (no files), just copy directly without backend call
      if (selectedFilePaths.length === 0 && trimmedInstructions) {
        await navigator.clipboard.writeText(trimmedInstructions);
        if (onPromptBuilt) {
          onPromptBuilt(trimmedInstructions, 0);
        }
        return;
      }

      // Build prompt with files
      let finalInstructions = trimmedInstructions;

      // Only add context section if files are selected
      if (selectedFilePaths.length > 0) {
        if (finalInstructions && !finalInstructions.includes("{{files}}")) {
          finalInstructions += "\n\n---CONTEXT:\n\n{{files}}";
        } else if (!finalInstructions) {
          finalInstructions = "---CONTEXT:\n\n{{files}}";
        }
      }

      const response = await assemblePrompt({
        templateId: "custom",
        customInstructions: finalInstructions,
        filePaths: selectedFilePaths,
      });

      // Copy to clipboard automatically
      await navigator.clipboard.writeText(response.prompt);

      if (onPromptBuilt) {
        onPromptBuilt(response.prompt, response.redaction_count);
      }
    } catch (err) {
      console.log('PromptBuilder error caught:', err);
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

        </div>
      </div>

      {/* Templates */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Templates</label>


        <div className="grid grid-cols-2 gap-2" data-testid="templates-grid">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                setSelectedTemplate(template.id);
                setCustomInstructions(template.template);
              }}
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
                <span className="text-[16px]">{getTemplateIcon(template.id)}</span>
                <span className="text-[10px] font-semibold text-white/90">{template.name}</span>
              </div>
              <p className="text-[9px] text-white/40 line-clamp-2">{template.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-2 p-2 rounded border border-dashed border-border-dark flex items-center justify-center gap-2 text-white/30 hover:text-white/50 hover:border-white/20 cursor-pointer transition-colors">
          <PlusCircle size={14} />
          <span className="text-[10px]">Create New Template</span>
        </div>
      </div>

      {
        error && (
          <div className="p-2 bg-red-900/20 border border-red-900/50 text-red-200 rounded text-[10px]" data-testid="error-display">
            {error}
          </div>
        )
      }
    </div >
  );
});

function getTemplateIcon(id: string): React.ReactNode {
  switch (id) {
    case 'agent': return <Bot size={16} />;
    case 'refactor': return <PencilRuler size={16} />;
    case 'fix': return <Bug size={16} />; // Assuming 'Find Bugs' maps to 'fix'
    case 'explain': return <BookOpen size={16} />;
    case 'audit': return <Shield size={16} />; // Security audit
    default: return <FileText size={16} />;
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
