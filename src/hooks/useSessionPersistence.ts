import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Hook for persisting session state to history database
 * Note: localStorage is no longer used - sessions are saved to database history
 */
export function useSessionPersistence(
  selectedPaths: string[],
  customInstructions: string,
  _setSelectedPaths?: (paths: string[]) => void,
  _setCustomInstructions?: (instructions: string) => void
) {
  // Save current session to history database
  // This should be called when user clicks "Clear" button to save current context
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

  // Clear session - no-op since we don't use localStorage anymore
  // Session state is managed by parent components
  const clearSession = useCallback(() => {
    // No-op - sessions are now saved to database history on demand
  }, []);

  return {
    saveToHistory,
    clearSession,
  };
}
