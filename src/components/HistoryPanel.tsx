import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const validateEntry = async (id: number, paths: string[]) => {
    try {
      const result = await invoke<ValidationResult>('validate_history_paths', { paths });
      setValidationResults(prev => new Map(prev).set(id, result));
    } catch (error) {
      console.error('Failed to validate paths:', error);
    }
  };

  const handleRestore = (entry: HistoryEntry) => {
    const result = validationResults.get(entry.id!);

    if (result && !result.valid) {
      const confirmRestore = window.confirm(
        `Warning: ${result.missing_paths.length} path(s) no longer exist:\n\n${result.missing_paths.slice(0, 5).join('\n')}${result.missing_paths.length > 5 ? '\n...' : ''}\n\nDo you want to restore this session anyway?`
      );

      if (!confirmRestore) {
        return;
      }
    }

    if (onRestore) {
      onRestore(entry);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this history entry?')) {
      return;
    }

    try {
      await invoke('delete_history', { id });
      await loadHistory();
    } catch (error) {
      console.error('Failed to delete history entry:', error);
      alert('Failed to delete history entry');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all history?')) {
      return;
    }

    try {
      await invoke('clear_history');
      await loadHistory();
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Failed to clear history');
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusIcon = (id: number) => {
    const result = validationResults.get(id);
    if (!result) return '⏳';
    return result.valid ? '✓' : '⚠️';
  };

  const getStatusText = (id: number) => {
    const result = validationResults.get(id);
    if (!result) return 'Validating...';
    if (result.valid) return 'All paths valid';
    return `${result.missing_paths.length} path(s) missing`;
  };

  if (loading && history.length === 0) {
    return <div className="p-5 h-full">Loading history...</div>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-5">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-foreground">Session History</h3>
          {history.length > 0 && (
            <Button onClick={handleClearAll} variant="destructive" size="sm">
              Clear All
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 px-5 text-muted-foreground">
            <p>No history entries yet</p>
            <p className="text-[13px] mt-2">Your recent sessions will appear here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((entry) => (
              <Card key={entry.id}>
                <div
                  className="flex justify-between items-center p-3 cursor-pointer transition-colors hover:bg-accent"
                  onClick={() => toggleExpanded(entry.id!)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg" title={getStatusText(entry.id!)}>
                      {getStatusIcon(entry.id!)}
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="text-[13px] text-foreground font-medium">{formatDate(entry.created_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.selected_paths.length} file(s) • {entry.root_paths.length} root(s)
                        {entry.template_id && ` • Template: ${entry.template_id}`}
                      </div>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs">{expandedEntries.has(entry.id!) ? '▼' : '▶'}</span>
                </div>

                {expandedEntries.has(entry.id!) && (
                  <CardContent className="pt-0 pb-4 px-4 border-t border-border">
                    <div className="mt-3 space-y-3">
                      <div>
                        <strong className="block mb-1.5 text-[13px] text-foreground">Root Paths:</strong>
                        <ul className="list-none text-xs text-muted-foreground max-h-[200px] overflow-y-auto">
                          {entry.root_paths.map((path, idx) => (
                            <li key={idx} className="py-1 break-all">{path}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <strong className="block mb-1.5 text-[13px] text-foreground">
                          Selected Files ({entry.selected_paths.length}):
                        </strong>
                        <ul className="list-none text-xs text-muted-foreground max-h-[200px] overflow-y-auto">
                          {entry.selected_paths.slice(0, 10).map((path, idx) => {
                            const isMissing = validationResults.get(entry.id!)?.missing_paths.includes(path);
                            return (
                              <li key={idx} className={cn("py-1 break-all", isMissing && "text-destructive")}>
                                {path}
                                {isMissing && <span className="italic"> (missing)</span>}
                              </li>
                            );
                          })}
                          {entry.selected_paths.length > 10 && (
                            <li className="text-primary italic">
                              ... and {entry.selected_paths.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>

                      {entry.custom_prompt && (
                        <div>
                          <strong className="block mb-1.5 text-[13px] text-foreground">Custom Prompt:</strong>
                          <div className="text-[13px] text-muted-foreground p-2 bg-background rounded whitespace-pre-wrap break-words">
                            {entry.custom_prompt}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        <Button onClick={() => handleRestore(entry)} variant="default" size="sm">
                          Restore Session
                        </Button>
                        <Button onClick={() => handleDelete(entry.id!)} variant="secondary" size="sm">
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default HistoryPanel;
