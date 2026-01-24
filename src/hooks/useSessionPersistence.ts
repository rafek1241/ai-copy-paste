import { useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

const SESSION_STORAGE_KEY = 'ai-copy-paste-session';

export interface SessionState {
  selectedPaths: string[];
  customInstructions: string;
  timestamp: number;
}



/**
 * Hook for persisting session state to localStorage and history database
 */
export function useSessionPersistence(
  selectedPaths: string[],
  customInstructions: string,
  setSelectedPaths?: (paths: string[]) => void,
  setCustomInstructions?: (instructions: string) => void
) {
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const session: SessionState = JSON.parse(stored);
        if (setSelectedPaths && session.selectedPaths?.length > 0) {
          setSelectedPaths(session.selectedPaths);
        }
        if (setCustomInstructions && session.customInstructions) {
          setCustomInstructions(session.customInstructions);
        }
      }
    } catch (error) {
      console.error('Failed to load session from localStorage:', error);
    }
  }, [setSelectedPaths, setCustomInstructions]);

  // Save session to localStorage (debounced)
  useEffect(() => {
    if (!isInitialized.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        const session: SessionState = {
          selectedPaths,
          customInstructions,
          timestamp: Date.now(),
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } catch (error) {
        console.error('Failed to save session to localStorage:', error);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [selectedPaths, customInstructions]);

  // Save current session to history database
  const saveToHistory = useCallback(async (): Promise<boolean> => {
    // Don't save empty sessions
    if (selectedPaths.length === 0 && !customInstructions.trim()) {
      return false;
    }

    try {
      // Backend save_history expects: root_paths, selected_paths, template_id, custom_prompt
      await invoke('save_history', {
        rootPaths: [], // Could be enhanced to track root directories
        selectedPaths: selectedPaths,
        templateId: null,
        customPrompt: customInstructions.trim() || null,
      });

      return true;
    } catch (error) {
      console.error('Failed to save to history:', error);
      return false;
    }
  }, [selectedPaths, customInstructions]);

  // Clear session from localStorage
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear session from localStorage:', error);
    }
  }, []);

  return {
    saveToHistory,
    clearSession,
  };
}
