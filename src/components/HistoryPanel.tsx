import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '@/lib/utils';
import { useToast } from './ui/toast';
import { useConfirmDialog } from './ui/alert-dialog';

interface HistoryEntry {
  id: number;
  created_at: number;
  root_paths: string[];
  selected_paths: string[];
  template_id: string | null;
  custom_prompt: string | null;
}

interface ValidationResult {
  valid: boolean;
  missing_paths: string[];
}

interface HistoryPanelProps {
  onRestore?: (entry: HistoryEntry) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onRestore }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationResults, setValidationResults] = useState<Map<number, ValidationResult>>(new Map());
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  const { success, error: showError } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await invoke<HistoryEntry[]>('load_history');
      setHistory(entries);

      // Validate all entries
      for (const entry of entries) {
        if (entry.id) {
          await validateEntry(entry.id, entry.selected_paths);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      showError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const validateEntry = async (id: number, paths: string[]) => {
    try {
      const result = await invoke<ValidationResult>('validate_history_paths', { paths });
      setValidationResults(prev => new Map(prev).set(id, result));
    } catch (error) {
      console.error('Failed to validate paths:', error);
    }
  };

  const handleRestore = useCallback(async (entry: HistoryEntry) => {
    const result = validationResults.get(entry.id);

    if (result && !result.valid) {
      const missingCount = result.missing_paths.length;
      const confirmed = await confirm({
        title: 'Missing Files Detected',
        description: `${missingCount} file(s) no longer exist. Do you want to restore this session anyway?`,
        confirmText: 'Restore Anyway',
        cancelText: 'Cancel',
        variant: 'default',
      });

      if (!confirmed) {
        return;
      }
    }

    if (onRestore) {
      onRestore(entry);
    }
  }, [validationResults, confirm, onRestore]);

  const handleDelete = useCallback(async (id: number) => {
    const confirmed = await confirm({
      title: 'Delete Entry',
      description: 'Are you sure you want to delete this history entry?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await invoke('delete_history', { id });
      await loadHistory();
      success('History entry deleted');
    } catch (error) {
      console.error('Failed to delete history entry:', error);
      showError('Failed to delete history entry');
    }
  }, [confirm, loadHistory, success, showError]);

  const handleClearAll = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Clear All History',
      description: 'Are you sure you want to clear all history? This action cannot be undone.',
      confirmText: 'Clear All',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await invoke('clear_history');
      await loadHistory();
      success('All history cleared');
    } catch (error) {
      console.error('Failed to clear history:', error);
      showError('Failed to clear history');
    }
  }, [confirm, loadHistory, success, showError]);

  const toggleExpanded = useCallback((id: number) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading && history.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d1117] text-white/40" role="status">
        <span className="material-symbols-outlined animate-spin mr-2" aria-hidden="true">progress_activity</span>
        <span className="text-[11px] font-medium uppercase tracking-widest">Loading History...</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex-1 flex flex-col bg-[#0d1117] h-full overflow-y-auto custom-scrollbar"
        data-testid="history-view"
        role="region"
        aria-label="Session history"
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-2">
            <h2 className="text-[14px] font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">history</span>
              Session History
            </h2>
            {history.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 h-7 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded text-[10px] font-bold text-red-500 transition-all flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                aria-label="Clear all history"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">delete_sweep</span>
                CLEAR ALL
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="size-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <span className="material-symbols-outlined text-white/20 text-[24px]" aria-hidden="true">history_toggle_off</span>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">No entries found</p>
                <p className="text-[10px] text-white/20">Your recent context sessions will appear here.</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2" role="list" aria-label="History entries">
              {history.map((entry) => {
                const validation = validationResults.get(entry.id);
                const isExpanded = expandedEntries.has(entry.id);

                return (
                  <li
                    key={entry.id}
                    className={cn(
                      "border rounded-md transition-all overflow-hidden",
                      isExpanded ? "bg-white/5 border-white/20 shadow-lg" : "bg-white/[0.02] border-white/5 hover:border-white/10"
                    )}
                  >
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-3 cursor-pointer select-none text-left focus:outline-none focus:ring-1 focus:ring-primary/50 focus:ring-inset"
                      onClick={() => toggleExpanded(entry.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`history-details-${entry.id}`}
                    >
                      <div className={cn(
                        "size-8 rounded flex items-center justify-center flex-shrink-0",
                        validation?.valid ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                      )}>
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          {validation?.valid ? 'check_circle' : 'warning'}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-white tracking-tight">{formatDate(entry.created_at)}</span>
                          {!validation?.valid && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/20 rounded text-[8px] font-bold text-yellow-500 uppercase tracking-tighter">
                              MISSING ASSETS
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-white/30 truncate mt-0.5">
                          {entry.selected_paths.length} files • {entry.root_paths.length} root directories
                        </div>
                      </div>

                      <span
                        className={cn(
                          "material-symbols-outlined text-[18px] text-white/20 transition-transform duration-300 flex-shrink-0",
                          isExpanded && "rotate-180"
                        )}
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                    </button>

                    {isExpanded && (
                      <div
                        id={`history-details-${entry.id}`}
                        className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h3 className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Selected Files</h3>
                            <div className="max-h-32 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                              {entry.selected_paths.slice(0, 50).map((path, idx) => {
                                const isMissing = validation?.missing_paths.includes(path);
                                return (
                                  <div
                                    key={idx}
                                    className={cn(
                                      "text-[10px] truncate p-1 rounded",
                                      isMissing ? "bg-red-500/5 text-red-400/80 line-through" : "text-white/60"
                                    )}
                                  >
                                    {path.split(/[\\/]/).pop()}
                                    <span className="text-[8px] text-white/10 ml-2">{path}</span>
                                  </div>
                                );
                              })}
                              {entry.selected_paths.length > 50 && (
                                <div className="text-[10px] text-primary italic pt-1">+ {entry.selected_paths.length - 50} more files</div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <h3 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">Instructions</h3>
                              <div className="p-2 bg-black/40 border border-white/5 rounded text-[10px] text-white/50 min-h-[40px] italic">
                                {entry.template_id || 'Custom'} Template • {entry.custom_prompt?.substring(0, 100) || 'No custom instructions'}...
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestore(entry);
                                }}
                                className="flex-1 h-8 bg-primary hover:bg-primary/90 text-white text-[10px] font-bold rounded shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                              >
                                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">history_edu</span>
                                RESTORE SESSION
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(entry.id);
                                }}
                                className="px-3 h-8 bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-red-400 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-red-400/50"
                                aria-label="Delete this entry"
                              >
                                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <ConfirmDialog />
    </>
  );
};

export default HistoryPanel;
