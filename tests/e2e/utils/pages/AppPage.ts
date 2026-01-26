import { BasePage } from "./BasePage.js";
import { Selectors, FallbackSelectors } from "../selectors.js";

/**
 * Page Object for main application navigation and header
 */
export class AppPage extends BasePage {
  /**
   * Wait for application to fully load
   */
  async waitForLoad(timeout: number = 60000): Promise<void> {
    console.log("AppPage: Waiting for app to load...");

    // Wait for the base app to be ready
    await this.waitForAppReady(timeout);

    // Wait for either the app container or any meaningful content
    await browser.waitUntil(
      async () => {
        try {
          // Try data-testid first
          const container = await $(Selectors.appContainer);
          if (await container.isExisting()) {
            console.log("AppPage: Found app container via data-testid");
            return true;
          }

          // Try fallback class
          const containerFallback = await $(FallbackSelectors.appContainer);
          if (await containerFallback.isExisting()) {
            console.log("AppPage: Found app container via fallback");
            return true;
          }

          // Try looking for any div with content
          const hasContent = await browser.execute(() => {
            const root = document.getElementById("root");
            return root !== null && root.innerHTML.length > 100;
          });
          if (hasContent) {
            console.log("AppPage: Root has content");
            return true;
          }

          return false;
        } catch (e) {
          console.log("AppPage: Error checking container:", e);
          return false;
        }
      },
      {
        timeout: 30000,
        interval: 1000,
        timeoutMsg: "App container did not appear within 30 seconds",
      }
    );

    console.log("AppPage: App loaded successfully");
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
    await browser.pause(300); // Wait for navigation
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
    await browser.pause(300);
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
    await browser.pause(300);
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
    await browser.pause(300);
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
    await browser.pause(500); // Wait for clear to take effect
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
}
