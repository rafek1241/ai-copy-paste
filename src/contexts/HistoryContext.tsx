import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

interface HistoryEntry {
  id: number;
  created_at: number;
  root_paths: string[];
  selected_paths: string[];
  template_id: string | null;
  custom_prompt: string | null;
}

interface HistoryContextValue {
  history: HistoryEntry[];
  loadHistory: () => Promise<void>;
  isLoading: boolean;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

interface HistoryProviderProps {
  children: ReactNode;
}

export function HistoryProvider({ children }: HistoryProviderProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const entries = await invoke<HistoryEntry[]>("load_history");
      setHistory(entries);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = {
    history,
    loadHistory,
    isLoading,
  };

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return context;
}
