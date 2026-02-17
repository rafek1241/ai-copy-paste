import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await writeText(text);
    return;
  } catch {
    // Fall back for browser-only environments.
  }

  if (typeof window !== "undefined" && (window as any).__TAURI__) {
    throw new Error("Clipboard plugin write failed in Tauri runtime");
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error("Clipboard write is not available in this environment");
}

export async function readFromClipboard(): Promise<string> {
  try {
    const text = await readText();
    return text ?? "";
  } catch {
    // Fall back for browser-only environments.
  }

  if (typeof window !== "undefined" && (window as any).__TAURI__) {
    return "";
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  return "";
}