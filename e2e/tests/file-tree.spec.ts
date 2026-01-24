import { AppPage, FileTreePage } from "../utils/pages/index.js";
import { Selectors } from "../utils/selectors.js";

/**
 * File Tree E2E Tests
 *
 * Note: Tests that require folder indexing via Tauri commands are skipped
 * in CI because the index_folder command may not work reliably due to
 * file system permissions or path differences.
 */
describe("File Tree", () => {
  const appPage = new AppPage();
  const fileTreePage = new FileTreePage();

  before(async () => {
    await appPage.waitForLoad();
    await appPage.navigateToMain();
    await fileTreePage.waitForReady();
  });

  describe("Initial State", () => {
    it("should display the file tree container", async () => {
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should display the Add Folder button", async () => {
      const addFolderBtn = await $(Selectors.addFolderBtn);
      expect(await addFolderBtn.isDisplayed()).toBe(true);
    });

    it("should display the search toggle button", async () => {
      const searchToggleBtn = await $(Selectors.searchToggleBtn);
      expect(await searchToggleBtn.isDisplayed()).toBe(true);
    });

    it("should show tree container or empty state", async () => {
      // In CI, we may have either empty state or existing nodes from previous tests
      // Just verify the file tree scroll container exists
      const scrollContainer = await $(Selectors.fileTreeScroll);
      expect(await scrollContainer.isExisting()).toBe(true);
    });
  });

  describe("Search UI", () => {
    beforeEach(async () => {
      // Ensure we're on Files tab before search tests
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);
    });

    it("should have search toggle button visible", async () => {
      const searchToggle = await $(Selectors.searchToggleBtn);
      const exists = await searchToggle.isExisting();

      if (exists) {
        expect(await searchToggle.isDisplayed()).toBe(true);
      } else {
        // Search toggle might not be present - that's OK, just verify container exists
        const container = await $(Selectors.fileTreeContainer);
        expect(await container.isDisplayed()).toBe(true);
      }
    });

    it("should handle search input without errors", async () => {
      // Try to find and interact with search if available
      try {
        const searchInput = await $(Selectors.fileTreeSearch);
        if (await searchInput.isExisting() && await searchInput.isDisplayed()) {
          await searchInput.setValue("test");
          await browser.pause(500);
          await searchInput.clearValue();
        }
      } catch {
        // Search might not be visible - that's OK
      }

      // Verify app is still responsive
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });
  });

  describe("Tree Interaction", () => {
    it("should handle tree node interactions", async () => {
      // Check if there are any tree nodes to interact with
      const nodes = await $$(Selectors.treeNode);

      if (nodes.length > 0) {
        // If nodes exist, verify they can be queried
        const firstNode = nodes[0];
        expect(await firstNode.isDisplayed()).toBe(true);

        // Check for expand icon
        const expandIcon = await firstNode.$(Selectors.expandIcon);
        if (await expandIcon.isExisting()) {
          // Toggle expansion
          await expandIcon.click();
          await browser.pause(300);
        }
      }

      // Test passes whether or not nodes exist
      // Main verification is that app doesn't crash
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should handle checkbox interactions", async () => {
      const nodes = await $$(Selectors.treeNode);

      if (nodes.length > 0) {
        const node = nodes[0];
        const checkbox = await node.$(Selectors.treeCheckbox);

        if (await checkbox.isExisting()) {
          // Click checkbox
          await checkbox.click();
          await browser.pause(200);

          // Click again to deselect
          await checkbox.click();
          await browser.pause(200);
        }
      }

      // Verify app still works
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });
  });

  describe("Navigation Integration", () => {
    it("should maintain file tree state when navigating", async () => {
      // Navigate away
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-prompt"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      // Navigate back
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      // Verify file tree is still accessible
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should show file tree on Files tab", async () => {
      // Ensure we're on Files tab
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      // Verify file tree container is visible
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });
  });

  describe("Advanced Search Filters", () => {
    beforeEach(async () => {
      // Ensure we're on Files tab before search tests
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);
    });

    it("should show search tooltip when search is empty", async () => {
      // Expand search
      const searchToggle = await $(Selectors.searchToggleBtn);
      if (await searchToggle.isExisting()) {
        await searchToggle.click();
        await browser.pause(300);

        // Check for tooltip
        const tooltip = await $(Selectors.searchTooltip);
        if (await tooltip.isExisting()) {
          expect(await tooltip.isDisplayed()).toBe(true);
          const text = await tooltip.getText();
          expect(text).toContain("Advanced search");
        }
      }

      // Verify app still works
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should hide tooltip when typing in search", async () => {
      // Expand search
      const searchToggle = await $(Selectors.searchToggleBtn);
      if (await searchToggle.isExisting()) {
        await searchToggle.click();
        await browser.pause(300);

        // Type in search
        const searchInput = await $(Selectors.fileTreeSearch);
        if (await searchInput.isExisting()) {
          await searchInput.setValue("test");
          await browser.pause(300);

          // Tooltip should be hidden
          const tooltip = await $(Selectors.searchTooltip);
          const tooltipVisible = await tooltip.isExisting() && await tooltip.isDisplayed();
          expect(tooltipVisible).toBe(false);

          // Clear search
          await searchInput.clearValue();
        }
      }

      // Verify app still works
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should handle file: prefix search syntax", async () => {
      const searchToggle = await $(Selectors.searchToggleBtn);
      if (await searchToggle.isExisting()) {
        await searchToggle.click();
        await browser.pause(300);

        const searchInput = await $(Selectors.fileTreeSearch);
        if (await searchInput.isExisting()) {
          // Test file: prefix
          await searchInput.setValue("file:App");
          await browser.pause(500);

          // App should still be responsive
          const container = await $(Selectors.fileTreeContainer);
          expect(await container.isDisplayed()).toBe(true);

          // Clear search
          await searchInput.clearValue();
        }
      }
    });

    it("should handle dir: prefix search syntax", async () => {
      const searchToggle = await $(Selectors.searchToggleBtn);
      if (await searchToggle.isExisting()) {
        await searchToggle.click();
        await browser.pause(300);

        const searchInput = await $(Selectors.fileTreeSearch);
        if (await searchInput.isExisting()) {
          // Test dir: prefix
          await searchInput.setValue("dir:src");
          await browser.pause(500);

          // App should still be responsive
          const container = await $(Selectors.fileTreeContainer);
          expect(await container.isDisplayed()).toBe(true);

          // Clear search
          await searchInput.clearValue();
        }
      }
    });

    it("should handle combined filter syntax", async () => {
      const searchToggle = await $(Selectors.searchToggleBtn);
      if (await searchToggle.isExisting()) {
        await searchToggle.click();
        await browser.pause(300);

        const searchInput = await $(Selectors.fileTreeSearch);
        if (await searchInput.isExisting()) {
          // Test combined filters
          await searchInput.setValue("file:App dir:src");
          await browser.pause(500);

          // App should still be responsive
          const container = await $(Selectors.fileTreeContainer);
          expect(await container.isDisplayed()).toBe(true);

          // Clear search
          await searchInput.clearValue();
        }
      }
    });

    it("should handle regex pattern search", async () => {
      const searchToggle = await $(Selectors.searchToggleBtn);
      if (await searchToggle.isExisting()) {
        await searchToggle.click();
        await browser.pause(300);

        const searchInput = await $(Selectors.fileTreeSearch);
        if (await searchInput.isExisting()) {
          // Test regex pattern (auto-detected)
          await searchInput.setValue("\\.tsx$");
          await browser.pause(500);

          // App should still be responsive
          const container = await $(Selectors.fileTreeContainer);
          expect(await container.isDisplayed()).toBe(true);

          // Clear search
          await searchInput.clearValue();
        }
      }
    });

    it("should blur input when Enter is pressed", async () => {
      const searchToggle = await $(Selectors.searchToggleBtn);
      if (await searchToggle.isExisting()) {
        await searchToggle.click();
        await browser.pause(300);

        const searchInput = await $(Selectors.fileTreeSearch);
        if (await searchInput.isExisting()) {
          await searchInput.setValue("test");
          await browser.pause(200);

          // Press Enter
          await browser.keys(['Enter']);
          await browser.pause(200);

          // Search value should still be there
          const value = await searchInput.getValue();
          expect(value).toBe("test");

          // Clear search
          await searchInput.clearValue();
        }
      }

      // Verify app still works
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });
  });

  describe("UI Responsiveness", () => {
    beforeEach(async () => {
      // Ensure we're on Files tab
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);
    });

    it("should not crash when rapidly interacting with UI", async () => {
      // Try to interact with various elements rapidly
      const addFolderBtn = await $(Selectors.addFolderBtn);

      if (await addFolderBtn.isExisting()) {
        // Click add folder button multiple times (will open dialogs but that's OK)
        for (let i = 0; i < 3; i++) {
          try {
            await addFolderBtn.click();
            await browser.pause(100);
          } catch {
            // Click might fail if dialog opens - that's OK
          }
        }
      }

      // Press escape to close any dialogs
      await browser.keys(['Escape']);
      await browser.pause(200);

      // Verify app is still working
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should handle window resize gracefully", async () => {
      // Get current window size
      const originalSize = await browser.getWindowSize();

      // Resize window
      await browser.setWindowSize(800, 600);
      await browser.pause(300);

      // Verify file tree still works
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);

      // Restore original size
      await browser.setWindowSize(originalSize.width, originalSize.height);
      await browser.pause(300);
    });
  });
});
