import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export interface AppSettings {
  excluded_extensions: string[];
  token_limit: number;
  default_template: string;
  auto_save_history: boolean;
  cache_size_mb: number;
  respect_gitignore: boolean;
}

function normalizeSinglePath(
  filePath: string | string[] | null
): string | null {
  if (typeof filePath === "string") {
    return filePath;
  }

  if (Array.isArray(filePath)) {
    return filePath[0] ?? null;
  }

  return null;
}

async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke("save_settings", { settings });
}

async function exportSettings(): Promise<boolean> {
  const settingsJson = await invoke<string>("export_settings");

  const filePath = await save({
    defaultPath: "ai-context-collector-settings.json",
    filters: [{
      name: "JSON",
      extensions: ["json"],
    }],
  });

  const resolvedPath = normalizeSinglePath(filePath);
  if (!resolvedPath) {
    return false;
  }

  await writeTextFile(resolvedPath, settingsJson);
  return true;
}

async function importSettings(): Promise<boolean> {
  const filePath = await open({
    multiple: false,
    filters: [{
      name: "JSON",
      extensions: ["json"],
    }],
  });

  const resolvedPath = normalizeSinglePath(filePath);
  if (!resolvedPath) {
    return false;
  }

  const settingsJson = await readTextFile(resolvedPath);
  await invoke("import_settings", { jsonData: settingsJson });
  return true;
}

async function resetSettings(): Promise<void> {
  await invoke("reset_settings");
}

export const settingsApi = {
  loadSettings,
  saveSettings,
  exportSettings,
  importSettings,
  resetSettings,
};

export type SettingsApi = typeof settingsApi;
