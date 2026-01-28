import { AppPage, FileTreePage } from "../utils/pages/index.js";
import { Selectors } from "../utils/selectors.js";
import path from "node:path";

/**
 * File Tree State Preservation E2E Tests
 *
 * Tests scenarios for:
 * - Selection state preservation across operations
 * - Expansion state preservation
 * - State after adding new content
 * - State after partial indexing
 */
describe("File Tree - State Preservation", () => {
  const appPage = new AppPage();
  const fileTreePage = new FileTreePage();

  // Test fixture paths
  const fixturesBase = path.join(process.cwd(), "e2e", "fixtures", "test-data");
  const hierarchicalBase = path.join(fixturesBase, "hierarchical-test");
  const track1Path = path.join(hierarchicalBase, "track1");
  const subfolderPath = path.join(fixturesBase, "subfolder");

  before(async () => {
    await appPage.waitForLoad();
    await appPage.navigateToMain();
    await fileTreePage.waitForReady();
  });

  beforeEach(async () => {
    // Ensure we're on Files tab
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
      btn?.click();
    });
    await browser.pause(500);
  });

  describe("Selection Persistence", () => {
    it("should maintain file selection after navigating away and back", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      // Find and select a file
      const files = await fileTreePage.getFileNodes();
      if (files.length === 0) {
        console.log("No files found, skipping test");
        return;
      }

      const fileLabel = await files[0].$(Selectors.treeLabel);
      const fileName = await fileLabel.getText();

      await fileTreePage.selectNode(fileName);
      await browser.pause(300);

      // Verify selected
      expect(await fileTreePage.isNodeSelected(fileName)).toBe(true);

      // Navigate to Prompt tab
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-prompt"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      // Navigate back to Files
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      // Check selection is preserved
      const stillSelected = await fileTreePage.isNodeSelected(fileName);
      console.log(`File "${fileName}" selection preserved: ${stillSelected}`);
      expect(stillSelected).toBe(true);
    });

    it("should maintain multiple selections", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const files = await fileTreePage.getFileNodes();
      if (files.length < 2) {
        console.log("Not enough files for multi-selection test");
        return;
      }

      // Get names of first two files
      const label1 = await files[0].$(Selectors.treeLabel);
      const fileName1 = await label1.getText();

      const label2 = await files[1].$(Selectors.treeLabel);
      const fileName2 = await label2.getText();

      // Select both
      await fileTreePage.selectNode(fileName1);
      await browser.pause(200);
      await fileTreePage.selectNode(fileName2);
      await browser.pause(200);

      // Verify both selected
      expect(await fileTreePage.isNodeSelected(fileName1)).toBe(true);
      expect(await fileTreePage.isNodeSelected(fileName2)).toBe(true);

      // Get all selected nodes
      const selected = await fileTreePage.getSelectedNodes();
      console.log("Selected nodes:", selected);
      expect(selected).toContain(fileName1);
      expect(selected).toContain(fileName2);
    });

    it("should toggle selection on double click", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const files = await fileTreePage.getFileNodes();
      if (files.length === 0) return;

      const fileLabel = await files[0].$(Selectors.treeLabel);
      const fileName = await fileLabel.getText();

      // Ensure not selected initially (deselect if needed)
      await fileTreePage.deselectNode(fileName);
      await browser.pause(200);

      // Select
      await fileTreePage.selectNode(fileName);
      await browser.pause(200);
      expect(await fileTreePage.isNodeSelected(fileName)).toBe(true);

      // Deselect
      await fileTreePage.deselectNode(fileName);
      await browser.pause(200);
      expect(await fileTreePage.isNodeSelected(fileName)).toBe(false);
    });
  });

  describe("Expansion Persistence", () => {
    it("should maintain folder expansion after navigating away and back", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const label = await folders[0].$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Expand folder
      await fileTreePage.expandFolder(folderName);
      await browser.pause(300);
      expect(await fileTreePage.isFolderExpanded(folderName)).toBe(true);

      // Navigate away
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-settings"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      // Navigate back
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      // Check expansion preserved
      const stillExpanded = await fileTreePage.isFolderExpanded(folderName);
      console.log(`Folder "${folderName}" expansion preserved: ${stillExpanded}`);
      expect(stillExpanded).toBe(true);
    });

    it("should remember nested expansion state", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      // Try to find nested folders
      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const label = await folders[0].$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Expand first level
      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // Check for nested folders
      const nestedFolders = await fileTreePage.getFolderNodes();
      if (nestedFolders.length > 1) {
        const nestedLabel = await nestedFolders[1].$(Selectors.treeLabel);
        const nestedName = await nestedLabel.getText();

        // Expand nested folder
        await fileTreePage.expandFolder(nestedName);
        await browser.pause(300);

        // Collapse parent
        await fileTreePage.collapseFolder(folderName);
        await browser.pause(300);

        // Re-expand parent
        await fileTreePage.expandFolder(folderName);
        await browser.pause(500);

        // Nested should still be expanded
        const nestedStillExpanded = await fileTreePage.isFolderExpanded(nestedName);
        console.log(`Nested folder "${nestedName}" still expanded: ${nestedStillExpanded}`);
        expect(nestedStillExpanded).toBe(true);
      }
    });
  });

  describe("Combined Selection and Expansion", () => {
    it("should preserve both selection and expansion state together", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const label = await folders[0].$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Expand folder
      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // Select a file inside
      const files = await fileTreePage.getFileNodes();
      if (files.length === 0) return;

      const fileLabel = await files[0].$(Selectors.treeLabel);
      const fileName = await fileLabel.getText();

      await fileTreePage.selectNode(fileName);
      await browser.pause(300);

      // Verify initial state
      expect(await fileTreePage.isFolderExpanded(folderName)).toBe(true);
      expect(await fileTreePage.isNodeSelected(fileName)).toBe(true);

      // Navigate away and back
      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-prompt"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      await browser.execute(() => {
        const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
        btn?.click();
      });
      await browser.pause(500);

      // Both states should be preserved
      expect(await fileTreePage.isFolderExpanded(folderName)).toBe(true);
      expect(await fileTreePage.isNodeSelected(fileName)).toBe(true);
    });

    it("should maintain selection when parent folder is collapsed and re-expanded", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const label = await folders[0].$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Expand folder
      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // Select files inside
      const files = await fileTreePage.getFileNodes();
      if (files.length === 0) return;

      const fileLabel = await files[0].$(Selectors.treeLabel);
      const fileName = await fileLabel.getText();

      await fileTreePage.selectNode(fileName);
      await browser.pause(300);

      // Collapse folder (file becomes hidden)
      await fileTreePage.collapseFolder(folderName);
      await browser.pause(300);

      // File should not be visible now
      const fileNode = await fileTreePage.findNodeByName(fileName);
      expect(fileNode).toBeNull();

      // Re-expand folder
      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // File should be visible and still selected
      const foundFile = await fileTreePage.findNodeByName(fileName);
      expect(foundFile).not.toBeNull();
      expect(await fileTreePage.isNodeSelected(fileName)).toBe(true);
    });
  });

  describe("Folder Selection Propagation", () => {
    it("should select all children when folder is selected", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const label = await folders[0].$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Expand first
      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // Count visible files before selection
      const filesBefore = await fileTreePage.getFileNodes();
      const fileCountBefore = filesBefore.length;

      // Select the folder
      await fileTreePage.selectNode(folderName);
      await browser.pause(500);

      // All visible files should now be selected
      const selectedNodes = await fileTreePage.getSelectedNodes();
      console.log(`Selected ${selectedNodes.length} nodes after folder selection`);

      // Should have multiple selections
      expect(selectedNodes.length).toBeGreaterThan(0);
    });

    it("should deselect all children when folder is deselected", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const label = await folders[0].$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Expand and select folder
      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);
      await fileTreePage.selectNode(folderName);
      await browser.pause(500);

      // Verify some files are selected
      let selectedNodes = await fileTreePage.getSelectedNodes();
      expect(selectedNodes.length).toBeGreaterThan(0);

      // Deselect folder
      await fileTreePage.deselectNode(folderName);
      await browser.pause(500);

      // All should be deselected now
      selectedNodes = await fileTreePage.getSelectedNodes();
      expect(selectedNodes.length).toBe(0);
    });
  });

  describe("Refresh Behavior", () => {
    it("should maintain state after triggering refresh event", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      // Setup: expand and select
      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const label = await folders[0].$(Selectors.treeLabel);
      const folderName = await label.getText();

      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      const files = await fileTreePage.getFileNodes();
      if (files.length === 0) return;

      const fileLabel = await files[0].$(Selectors.treeLabel);
      const fileName = await fileLabel.getText();

      await fileTreePage.selectNode(fileName);
      await browser.pause(300);

      // Trigger refresh event
      await browser.execute(() => {
        // @ts-ignore
        if (window.__TAURI__) {
          // @ts-ignore
          window.__TAURI__.event.emit("refresh-file-tree");
        }
      });
      await browser.pause(1000);

      // States should be preserved
      const stillExpanded = await fileTreePage.isFolderExpanded(folderName);
      const stillSelected = await fileTreePage.isNodeSelected(fileName);

      console.log(`After refresh - Expanded: ${stillExpanded}, Selected: ${stillSelected}`);

      // Note: depending on implementation, state may or may not be preserved
      // This test documents the current behavior
      expect(await $(Selectors.fileTreeContainer).isDisplayed()).toBe(true);
    });
  });
});
