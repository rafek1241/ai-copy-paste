import { BasePage } from "./BasePage.js";
import { Selectors, FallbackSelectors } from "../selectors.js";

/**
 * Page Object for main application navigation and header
 */
export class AppPage extends BasePage {
  private async waitForViewReady(view: "files" | "prompt" | "history" | "settings"): Promise<void> {
    if (view === "files") {
      await browser.waitUntil(
        async () => {
          const container = await $(Selectors.fileTreeContainer);
          return container.isExisting();
        },
        { timeout: 5000, interval: 100, timeoutMsg: "Files view did not become ready" }
      );
      return;
    }

    if (view === "prompt") {
      await browser.waitUntil(
        async () => {
          const container = await $(Selectors.promptBuilder);
          return container.isExisting();
        },
        { timeout: 5000, interval: 100, timeoutMsg: "Prompt view did not become ready" }
      );
      return;
    }

    if (view === "history") {
      await browser.waitUntil(
        async () => {
          const container = await $(Selectors.historyContainer);
          if (await container.isExisting()) {
            return true;
          }
          const heading = await $("h2");
          if (!(await heading.isExisting())) {
            return false;
          }
          return (await heading.getText()).toLowerCase().includes("history");
        },
        { timeout: 5000, interval: 100, timeoutMsg: "History view did not become ready" }
      );
      return;
    }

    await browser.waitUntil(
      async () => {
        const container = await $(Selectors.settingsContainer);
        if (await container.isExisting()) {
          return true;
        }
        const heading = await $("h2");
        if (!(await heading.isExisting())) {
          return false;
        }
        return (await heading.getText()).toLowerCase().includes("settings");
      },
      { timeout: 5000, interval: 100, timeoutMsg: "Settings view did not become ready" }
    );
  }

  /**
   * Wait for application to fully load
   */
  async waitForLoad(timeout: number = 3000): Promise<void> {
    // Wait for the base app to be ready
    await this.waitForAppReady(timeout);

    // Wait for either the app container or any meaningful content
    await browser.waitUntil(
      async () => {
        try {
          // Try data-testid first
          const container = await $(Selectors.appContainer);
          if (await container.isExisting()) {
            return true;
          }

          // Try fallback class
          const containerFallback = await $(FallbackSelectors.appContainer);
          if (await containerFallback.isExisting()) {
            return true;
          }

          // Try looking for any div with content
          const hasContent = await browser.execute(() => {
            const root = document.getElementById("root");
            return root !== null && root.innerHTML.length > 100;
          });
          if (hasContent) {
            return true;
          }

          return false;
        } catch (e) {
          console.log("AppPage: Error checking container:", e);
          return false;
        }
      },
      {
        timeout,
        interval: 200,
        timeoutMsg: `App container did not appear within ${timeout / 1000} seconds`,
      }
    );
  }

  /**
   * Get application title
   */
  async getTitle(): Promise<string> {
    try {
      const title = await this.getText(Selectors.appTitle);
      return title;
    } catch {
      return this.getText(FallbackSelectors.appTitle);
    }
  }

  /**
   * Navigate to Files view (main file tree view)
   */
  async navigateToFiles(): Promise<void> {
    try {
      await this.safeClick(Selectors.navFiles);
    } catch {
      // Fallback to finding button by title
      await this.safeClick(FallbackSelectors.navFiles);
    }
    await this.waitForViewReady("files");
  }

  /**
   * Navigate to Main view (alias for Files for backward compatibility)
   */
  async navigateToMain(): Promise<void> {
    await this.navigateToFiles();
  }

  /**
   * Navigate to Prompt view
   */
  async navigateToPrompt(): Promise<void> {
    try {
      await this.safeClick(Selectors.navPrompt);
    } catch {
      await this.safeClick(FallbackSelectors.navPrompt);
    }
    await this.waitForViewReady("prompt");
  }

  /**
   * Navigate to History view
   */
  async navigateToHistory(): Promise<void> {
    try {
      await this.safeClick(Selectors.navHistory);
    } catch {
      await this.safeClick(FallbackSelectors.navHistory);
    }
    await this.waitForViewReady("history");
  }

  /**
   * Navigate to Settings view
   */
  async navigateToSettings(): Promise<void> {
    try {
      await this.safeClick(Selectors.navSettings);
    } catch {
      await this.safeClick(FallbackSelectors.navSettings);
    }
    await this.waitForViewReady("settings");
  }

  /**
   * Get current view by checking which nav button is active
   */
  async getCurrentView(): Promise<string> {
    // Check sidebar buttons for active state (white text = active)
    const navButtons = [
      { selector: Selectors.navFiles, name: "files" },
      { selector: Selectors.navPrompt, name: "prompt" },
      { selector: Selectors.navHistory, name: "history" },
      { selector: Selectors.navSettings, name: "settings" },
    ];

    for (const nav of navButtons) {
      try {
        const button = await $(nav.selector);
        if (await button.isExisting()) {
          const className = await button.getAttribute("class");
          // Active buttons have "text-white" without opacity modifier
          if (className?.includes("text-white") && !className?.includes("text-white/")) {
            return nav.name;
          }
        }
      } catch {
        // Continue checking other buttons
      }
    }

    return "unknown";
  }

  /**
   * Get number of selected files displayed in header
   */
  async getSelectedFilesCount(): Promise<number> {
    try {
      const selectionInfo = await $(Selectors.selectionInfo);
      const text = await selectionInfo.getText();
      const match = text.match(/(\d+) file\(s\) selected/);
      return match ? parseInt(match[1], 10) : 0;
    } catch {
      // Try fallback
      const spans = await $$("span");
      for (const span of spans) {
        const text = await span.getText();
        const match = text.match(/(\d+) file\(s\) selected/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
      return 0;
    }
  }

  /**
   * Click the Clear Context button in the header
   */
  async clearContext(): Promise<void> {
    try {
      await this.safeClick(Selectors.clearContextBtn);
    } catch {
      await this.safeClick(FallbackSelectors.clearContextBtn);
    }
    try {
      await browser.waitUntil(
        async () => {
          const buttons = await $$("button");
          for (const button of buttons) {
            const text = await button.getText();
            if (text.trim().toLowerCase() === "clear all") {
              await button.click();
              return true;
            }
          }
          return false;
        },
        { timeout: 2000, interval: 200 }
      );
    } catch {
    }
    try {
      await browser.waitUntil(async () => (await this.getSelectedFilesCount()) === 0, {
        timeout: 3000,
        interval: 100,
      });
    } catch {
      // Selection count may already be zero but not rendered consistently.
    }
  }

  /**
   * Check if the application is in files view
   */
  async isInFilesView(): Promise<boolean> {
    return (await this.getCurrentView()) === "files";
  }

  /**
   * Check if the application is in main view (alias for files)
   */
  async isInMainView(): Promise<boolean> {
    return await this.isInFilesView();
  }

  /**
   * Check if file tree is displayed (indicates files view)
   */
  async isFileTreeDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.fileTreeContainer);
    } catch {
      return await this.isDisplayed(FallbackSelectors.fileTreeContainer);
    }
  }

  /**
   * Check if prompt builder is displayed
   */
  async isPromptBuilderDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.promptBuilder);
    } catch {
      return false;
    }
  }

  /**
   * Check if history panel is displayed
   */
  async isHistoryDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.historyContainer);
    } catch {
      return false;
    }
  }

  /**
   * Check if settings panel is displayed
   */
  async isSettingsDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.settingsContainer);
    } catch {
      return false;
    }
  }

  /**
   * Click the Copy Context button in footer
   */
  async clickCopyContext(): Promise<void> {
    try {
      await this.safeClick(Selectors.copyToClipboardBtn);
    } catch {
      await this.safeClick('button*=Copy Context');
    }
  }

  /**
   * Attempt to read clipboard text from the browser context
   */
  async getClipboardText(): Promise<string> {
    return browser.execute(async () => {
      const tauri = (window as any).__TAURI__;

      try {
        if (tauri?.core?.invoke) {
          const text = await tauri.core.invoke("plugin:clipboard-manager|read_text");
          if (typeof text === "string") {
            return text;
          }
        }
      } catch {
        // Continue with other clipboard fallbacks.
      }

      try {
        if (tauri?.clipboardManager?.readText) {
          const text = await tauri.clipboardManager.readText();
          if (typeof text === "string") {
            return text;
          }
        }
      } catch {
        // Continue with browser API fallback.
      }

      return "";
    });
  }
}
