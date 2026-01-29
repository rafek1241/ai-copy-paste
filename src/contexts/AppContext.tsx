import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from "react";

// Types
export type View = "main" | "history" | "settings";
export type ActiveTab = "files" | "prompt";

interface AppSettings {
  tokenLimit: number;
  defaultTemplate: string;
  autoSaveHistory: boolean;
}

interface AppState {
  // Navigation
  currentView: View;
  activeTab: ActiveTab;

  // Selection 
  selectedPaths: string[];

  // Custom instructions for prompt building
  customInstructions: string;

  // UI state
  searchQuery: string;
  isDragActive: boolean;
  isLoading: boolean;

  // Settings
  settings: AppSettings;
}

type AppAction =
  | { type: "SET_VIEW"; payload: View }
  | { type: "SET_TAB"; payload: ActiveTab }
  | { type: "SET_SELECTION"; payload: string[] }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_CUSTOM_INSTRUCTIONS"; payload: string }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_DRAG_ACTIVE"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "UPDATE_SETTINGS"; payload: Partial<AppSettings> }
  | { type: "RESET_STATE" };

const initialState: AppState = {
  currentView: "main",
  activeTab: "files",
  selectedPaths: [],
  customInstructions: "",
  searchQuery: "",
  isDragActive: false,
  isLoading: false,
  settings: {
    tokenLimit: 200000,
    defaultTemplate: "agent",
    autoSaveHistory: true,
  },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, currentView: action.payload };
    case "SET_TAB":
      return { ...state, activeTab: action.payload };
    case "SET_SELECTION":
      return {
        ...state,
        selectedPaths: action.payload,
      };
    case "CLEAR_SELECTION":
      return { ...state, selectedPaths: [] };
    case "SET_CUSTOM_INSTRUCTIONS":
      return { ...state, customInstructions: action.payload };
    case "SET_SEARCH":
      return { ...state, searchQuery: action.payload };
    case "SET_DRAG_ACTIVE":
      return { ...state, isDragActive: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    case "RESET_STATE":
      return initialState;
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Convenience actions
  setView: (view: View) => void;
  setTab: (tab: ActiveTab) => void;
  setSelection: (paths: string[]) => void;
  clearSelection: () => void;
  setCustomInstructions: (instructions: string) => void;
  setSearch: (query: string) => void;
  setDragActive: (active: boolean) => void;
  setLoading: (loading: boolean) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setView = useCallback((view: View) => {
    dispatch({ type: "SET_VIEW", payload: view });
  }, []);

  const setTab = useCallback((tab: ActiveTab) => {
    dispatch({ type: "SET_TAB", payload: tab });
  }, []);

  const setSelection = useCallback((paths: string[]) => {
    dispatch({ type: "SET_SELECTION", payload: paths });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION" });
  }, []);

  const setSearch = useCallback((query: string) => {
    dispatch({ type: "SET_SEARCH", payload: query });
  }, []);

  const setCustomInstructions = useCallback((instructions: string) => {
    dispatch({ type: "SET_CUSTOM_INSTRUCTIONS", payload: instructions });
  }, []);

  const setDragActive = useCallback((active: boolean) => {
    dispatch({ type: "SET_DRAG_ACTIVE", payload: active });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: settings });
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      setView,
      setTab,
      setSelection,
      clearSelection,
      setCustomInstructions,
      setSearch,
      setDragActive,
      setLoading,
      updateSettings,
    }),
    [state, setView, setTab, setSelection, clearSelection, setCustomInstructions, setSearch, setDragActive, setLoading, updateSettings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

// Selector hooks for optimized re-renders
export function useAppView() {
  const { state, setView, setTab } = useApp();
  return { currentView: state.currentView, activeTab: state.activeTab, setView, setTab };
}

export function useAppSelection() {
  const { state, setSelection, clearSelection } = useApp();
  return {
    selectedPaths: state.selectedPaths,
    setSelection,
    clearSelection,
  };
}

export function useAppSearch() {
  const { state, setSearch } = useApp();
  return { searchQuery: state.searchQuery, setSearch };
}

export function useAppDrag() {
  const { state, setDragActive } = useApp();
  return { isDragActive: state.isDragActive, setDragActive };
}

export function useAppSettings() {
  const { state, updateSettings } = useApp();
  return { settings: state.settings, updateSettings };
}

export function useAppCustomInstructions() {
  const { state, setCustomInstructions } = useApp();
  return { customInstructions: state.customInstructions, setCustomInstructions };
}
