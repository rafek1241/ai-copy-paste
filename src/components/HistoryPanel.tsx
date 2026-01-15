import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
    return <div className="history-panel loading">Loading history...</div>;
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h3>Session History</h3>
        {history.length > 0 && (
          <button onClick={handleClearAll} className="btn-clear-all">
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="history-empty">
          <p>No history entries yet</p>
          <p className="history-hint">Your recent sessions will appear here</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((entry) => (
            <div key={entry.id} className="history-entry">
              <div className="history-entry-header" onClick={() => toggleExpanded(entry.id!)}>
                <div className="history-entry-info">
                  <span className="history-status" title={getStatusText(entry.id!)}>
                    {getStatusIcon(entry.id!)}
                  </span>
                  <div className="history-entry-details">
                    <div className="history-entry-date">{formatDate(entry.created_at)}</div>
                    <div className="history-entry-summary">
                      {entry.selected_paths.length} file(s) • {entry.root_paths.length} root(s)
                      {entry.template_id && ` • Template: ${entry.template_id}`}
                    </div>
                  </div>
                </div>
                <span className="expand-icon">{expandedEntries.has(entry.id!) ? '▼' : '▶'}</span>
              </div>

              {expandedEntries.has(entry.id!) && (
                <div className="history-entry-content">
                  <div className="history-section">
                    <strong>Root Paths:</strong>
                    <ul className="path-list">
                      {entry.root_paths.map((path, idx) => (
                        <li key={idx}>{path}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="history-section">
                    <strong>Selected Files ({entry.selected_paths.length}):</strong>
                    <ul className="path-list">
                      {entry.selected_paths.slice(0, 10).map((path, idx) => {
                        const isMissing = validationResults.get(entry.id!)?.missing_paths.includes(path);
                        return (
                          <li key={idx} className={isMissing ? 'missing-path' : ''}>
                            {path}
                            {isMissing && <span className="missing-indicator"> (missing)</span>}
                          </li>
                        );
                      })}
                      {entry.selected_paths.length > 10 && (
                        <li className="more-items">
                          ... and {entry.selected_paths.length - 10} more
                        </li>
                      )}
                    </ul>
                  </div>

                  {entry.custom_prompt && (
                    <div className="history-section">
                      <strong>Custom Prompt:</strong>
                      <div className="custom-prompt">{entry.custom_prompt}</div>
                    </div>
                  )}

                  <div className="history-actions">
                    <button onClick={() => handleRestore(entry)} className="btn-restore">
                      Restore Session
                    </button>
                    <button onClick={() => handleDelete(entry.id!)} className="btn-delete">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
