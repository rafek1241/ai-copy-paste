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
   * Navigate to Main view
   */
  async navigateToMain(): Promise<void> {
    try {
      await this.safeClick(Selectors.navMain);
    } catch {
      // Fallback to finding button by text
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text === "Main") {
          await button.click();
          return;
        }
      }
    }
    await browser.pause(300); // Wait for navigation
  }

  /**
   * Navigate to Browser Automation view
   */
  async navigateToBrowser(): Promise<void> {
    try {
      await this.safeClick(Selectors.navBrowser);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text === "Browser") {
          await button.click();
          return;
        }
      }
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
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text === "History") {
          await button.click();
          return;
        }
      }
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
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text === "Settings") {
          await button.click();
          return;
        }
      }
    }
    await browser.pause(300);
  }

  /**
   * Get current view by checking which button is active
   */
  async getCurrentView(): Promise<string> {
    const buttons = await $$("button");

    for (const button of buttons) {
      const text = await button.getText();
      const style = await button.getAttribute("style");

      // Active button has different background color
      if (
        (text === "Main" || text === "Browser" || text === "History" || text === "Settings") &&
        style?.includes("#0e639c")
      ) {
        return text.toLowerCase();
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
   * Check if the application is in main view
   */
  async isInMainView(): Promise<boolean> {
    return (await this.getCurrentView()) === "main";
  }

  /**
   * Check if file tree is displayed (indicates main view)
   */
  async isFileTreeDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.fileTreeContainer);
    } catch {
      return await this.isDisplayed(FallbackSelectors.fileTreeContainer);
    }
  }
}
