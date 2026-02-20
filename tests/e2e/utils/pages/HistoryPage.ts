import { BasePage } from "./BasePage.js";
import { Selectors } from "../selectors.js";

/**
 * Page Object for History Panel component
 */
export class HistoryPage extends BasePage {
  /**
   * Wait for history page to be ready
   */
  async waitForReady(): Promise<void> {
    await browser.waitUntil(
      async () => {
        const heading = await $("h2");
        const text = await heading.getText();
        return text.includes("History") || text.includes("Session");
      },
      {
        timeout: 10000,
        timeoutMsg: "History page did not load within 10 seconds",
      }
    );
  }

  /**
   * Check if history page is displayed
   */
  async isDisplayed(): Promise<boolean> {
    try {
      const heading = await $("h2");
      const text = await heading.getText();
      return text.includes("History") || text.includes("Session");
    } catch {
      return false;
    }
  }

  /**
   * Get all history entries
   */
  async getHistoryEntries(): Promise<WebdriverIO.ElementArray> {
    try {
      return await $$(Selectors.historyEntry);
    } catch {
      // Fallback: look for list items or divs with history content
      return await $$(".history-entry, [data-testid='history-entry'], .history-item");
    }
  }

  /**
   * Get number of history entries
   */
  async getHistoryCount(): Promise<number> {
    const entries = await this.getHistoryEntries();
    return entries.length;
  }

  /**
   * Check if history is empty
   */
  async isHistoryEmpty(): Promise<boolean> {
    const count = await this.getHistoryCount();
    if (count === 0) {
      return true;
    }

    // Also check for "No history" message
    try {
      const emptyMessage = await $('div:has-text("No history"), p:has-text("No entries")');
      return await emptyMessage.isExisting();
    } catch {
      return count === 0;
    }
  }

  /**
   * Get history entry by index
   */
  async getHistoryEntry(index: number): Promise<WebdriverIO.Element | null> {
    const entries = await this.getHistoryEntries();
    return entries[index] || null;
  }

  /**
   * Restore a history entry by index
   */
  async restoreEntry(index: number): Promise<void> {
    const entry = await this.getHistoryEntry(index);
    if (!entry) {
      throw new Error(`History entry at index ${index} not found`);
    }

    const restoreBtn = await entry.$(
      '[data-testid="history-restore-btn"], button:has-text("Restore"), button:has-text("Load")'
    );

    if (await restoreBtn.isExisting()) {
      await restoreBtn.click();
    } else {
      throw new Error("Restore button not found in history entry");
    }
  }

  /**
   * Delete a history entry by index
   */
  async deleteEntry(index: number): Promise<void> {
    const entry = await this.getHistoryEntry(index);
    if (!entry) {
      throw new Error(`History entry at index ${index} not found`);
    }

    const deleteBtn = await entry.$(
      '[data-testid="history-delete-btn"], button:has-text("Delete"), button:has-text("Remove")'
    );

    if (await deleteBtn.isExisting()) {
      const countBefore = await this.getHistoryCount();
      await deleteBtn.click();
      try {
        await browser.waitUntil(async () => (await this.getHistoryCount()) < countBefore, {
          timeout: 3000,
          interval: 100,
        });
      } catch {
        // Some environments keep the list unchanged until a refresh.
      }
    } else {
      throw new Error("Delete button not found in history entry");
    }
  }

  /**
   * Clear all history
   */
  async clearAllHistory(): Promise<void> {
    try {
      await this.safeClick(Selectors.historyClearBtn);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Clear") && (text.includes("All") || text.includes("History"))) {
          const countBefore = await this.getHistoryCount();
          await button.click();
          try {
            await browser.waitUntil(async () => (await this.getHistoryCount()) < countBefore, {
              timeout: 3000,
              interval: 100,
            });
          } catch {
            // List may already be empty.
          }
          return;
        }
      }
    }
  }

  /**
   * Get details from a history entry
   */
  async getEntryDetails(index: number): Promise<{
    date?: string;
    fileCount?: number;
    template?: string;
  }> {
    const entry = await this.getHistoryEntry(index);
    if (!entry) {
      return {};
    }

    const text = await entry.getText();
    const details: {
      date?: string;
      fileCount?: number;
      template?: string;
    } = {};

    // Try to extract date
    const dateMatch = text.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/);
    if (dateMatch) {
      details.date = dateMatch[0];
    }

    // Try to extract file count
    const fileMatch = text.match(/(\d+)\s*file/i);
    if (fileMatch) {
      details.fileCount = parseInt(fileMatch[1], 10);
    }

    // Try to extract template
    const templates = ["agent", "planning", "debugging", "review", "documentation", "testing"];
    for (const template of templates) {
      if (text.toLowerCase().includes(template)) {
        details.template = template;
        break;
      }
    }

    return details;
  }

  /**
   * Wait for history to have entries
   */
  async waitForHistoryEntries(minCount: number = 1, timeout: number = 10000): Promise<void> {
    await browser.waitUntil(
      async () => {
        const count = await this.getHistoryCount();
        return count >= minCount;
      },
      {
        timeout,
        timeoutMsg: `History did not have at least ${minCount} entries within ${timeout}ms`,
      }
    );
  }
}
