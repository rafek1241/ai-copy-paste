import { useCallback, useMemo } from "react";
import { settingsApi, type AppSettings, type SettingsApi } from "@/services/settingsApi";

export type { AppSettings, SettingsApi };

export function useSettingsApi(): SettingsApi {
  const loadSettings = useCallback(() => settingsApi.loadSettings(), []);
  const saveSettings = useCallback((settings: AppSettings) => settingsApi.saveSettings(settings), []);
  const exportSettings = useCallback(() => settingsApi.exportSettings(), []);
  const importSettings = useCallback(() => settingsApi.importSettings(), []);
  const resetSettings = useCallback(() => settingsApi.resetSettings(), []);

  return useMemo(
    () => ({
      loadSettings,
      saveSettings,
      exportSettings,
      importSettings,
      resetSettings,
    }),
    [loadSettings, saveSettings, exportSettings, importSettings, resetSettings]
  );
}
