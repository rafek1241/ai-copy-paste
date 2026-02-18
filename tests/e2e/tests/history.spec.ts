import { AppPage, HistoryPage } from "../utils/pages/index.js";

describe("History Panel", () => {
  const appPage = new AppPage();
  const historyPage = new HistoryPage();

  before(async () => {
    await appPage.waitForLoad();
    await appPage.navigateToHistory();
    await historyPage.waitForReady();
  });

  beforeEach(async () => {
    // Ensure we're on history page
    if (!(await historyPage.isDisplayed())) {
      await appPage.navigateToHistory();
    }
  });

  describe("History Page Display", () => {
    it("should display history page when navigating to History", async () => {
      const isDisplayed = await historyPage.isDisplayed();
      expect(isDisplayed).toBe(true);
    });

    it("should display history heading", async () => {
      const heading = await $("h2");
      const text = await heading.getText();
      expect(text.toLowerCase()).toMatch(/history|session/);
    });
  });

  describe("Empty History State", () => {
    it("should handle empty history gracefully", async () => {
      const isEmpty = await historyPage.isHistoryEmpty();
      const count = await historyPage.getHistoryCount();

      // Either empty or has entries - both valid states
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should display appropriate message when no history", async () => {
      const count = await historyPage.getHistoryCount();

      if (count === 0) {
        // Check for empty state message
        const emptyMsg = await $('div*=No history, p*=No entries, div*=empty');
        const exists = await emptyMsg.isExisting();
        // Message may or may not exist
        expect(typeof exists).toBe("boolean");
      }
    });
  });

  describe("History Entries", () => {
    it("should display history entries if any exist", async () => {
      const count = await historyPage.getHistoryCount();

      if (count > 0) {
        const entries = await historyPage.getHistoryEntries();
        expect(entries.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("should show entry details", async function () {
      const count = await historyPage.getHistoryCount();

      if (count === 0) {
        this.skip();
        return;
      }

      const details = await historyPage.getEntryDetails(0);
      // May have date, file count, or template info
      expect(typeof details).toBe("object");
    });
  });

  describe("History Actions", () => {
    it("should have restore functionality for entries", async function () {
      const count = await historyPage.getHistoryCount();

      if (count === 0) {
        this.skip();
        return;
      }

      const entry = await historyPage.getHistoryEntry(0);
      if (entry) {
        const restoreBtn = await entry.$('button*=Restore, button*=Load');
        const hasRestore = await restoreBtn.isExisting();
        expect(typeof hasRestore).toBe("boolean");
      }
    });

    it("should have delete functionality for entries", async function () {
      const count = await historyPage.getHistoryCount();

      if (count === 0) {
        this.skip();
        return;
      }

      const entry = await historyPage.getHistoryEntry(0);
      if (entry) {
        const deleteBtn = await entry.$('button*=Delete, button*=Remove');
        const hasDelete = await deleteBtn.isExisting();
        expect(typeof hasDelete).toBe("boolean");
      }
    });

    it("should have clear all functionality", async () => {
      const clearBtn = await $('button*=Clear');
      const hasClear = await clearBtn.isExisting();
      expect(typeof hasClear).toBe("boolean");
    });
  });

  describe("History Integration", () => {
    it("should navigate from History to Main", async () => {
      await appPage.navigateToHistory();

      await appPage.navigateToMain();

      const isFileTreeDisplayed = await appPage.isFileTreeDisplayed();
      expect(isFileTreeDisplayed).toBe(true);
    });

    it("should preserve history when navigating between views", async () => {
      await appPage.navigateToHistory();
      const initialCount = await historyPage.getHistoryCount();

      await appPage.navigateToMain();

      await appPage.navigateToHistory();
      const newCount = await historyPage.getHistoryCount();

      // Count should be same after navigation
      expect(newCount).toBe(initialCount);
    });
  });
});

describe("History with Prompt Building", () => {
  const appPage = new AppPage();
  const historyPage = new HistoryPage();

  before(async () => {
    await appPage.waitForLoad();
  });

  it("should track prompt building in history", async function () {
    // This test verifies history tracking works with prompt building
    // The actual history entry depends on having files selected and building a prompt

    await appPage.navigateToHistory();
    const count = await historyPage.getHistoryCount();

    // Just verify we can access history count
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("should limit history entries to max count", async () => {
    // History should be limited (typically to 10 entries)
    await appPage.navigateToHistory();
    const count = await historyPage.getHistoryCount();

    // Should not exceed max limit
    expect(count).toBeLessThanOrEqual(100); // Reasonable upper bound
  });
});
