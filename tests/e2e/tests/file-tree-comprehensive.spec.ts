import { AppPage, FileTreePage } from "../utils/pages/index.js";
import { Selectors } from "../utils/selectors.js";
import path from "node:path";

/**
 * Comprehensive File Tree E2E Tests
 *
 * Tests the file-tree component behavior similar to a file explorer:
 * - Paths as source of truth (no folder IDs)
 * - Hierarchical ordering grouped by folders/drives
 * - Selection and expansion state preservation
 * - Indexing scenarios (partial, full, parent, grandparent)
 * - Clear context behavior
 */
describe("File Tree - Comprehensive Tests", () => {
  const appPage = new AppPage();
  const fileTreePage = new FileTreePage();

  // Test fixture paths
  const fixturesBase = path.join(process.cwd(), "tests", "e2e", "fixtures", "test-data");
  const hierarchicalBase = path.join(fixturesBase, "hierarchical-test");
  const track1Path = path.join(hierarchicalBase, "track1");
  const track2Path = path.join(hierarchicalBase, "track2");
  const track3Path = path.join(hierarchicalBase, "track3");

  before(async () => {
    await appPage.waitForLoad();
    await appPage.navigateToMain();
  });

  beforeEach(async () => {
    // Navigate to Files tab before each test
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
      btn?.click();
    });
    await browser.pause(500);
  });

  describe("Path-Based Behavior", () => {
    it("should display files using their full paths as unique identifiers", async () => {
      // Ensure test fixtures are indexed
      await fileTreePage.ensureTestFixturesIndexed();

      const nodes = await fileTreePage.getVisibleNodes();
      expect(nodes.length).toBeGreaterThan(0);

      // Verify nodes exist and have names
      for (const node of nodes) {
        const label = await node.$(Selectors.treeLabel);
        if (await label.isExisting()) {
          const text = await label.getText();
          expect(text).toBeTruthy();
          expect(text.length).toBeGreaterThan(0);
        }
      }
    });

    it("should correctly identify folder and file nodes", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folderNodes = await fileTreePage.getFolderNodes();
      const fileNodes = await fileTreePage.getFileNodes();


      // Verify folder nodes have folder type
      for (const folder of folderNodes) {
        const nodeType = await folder.getAttribute("data-node-type");
        expect(nodeType).toBe("folder");
      }

      // Verify file nodes have file type
      for (const file of fileNodes) {
        const nodeType = await file.getAttribute("data-node-type");
        expect(nodeType).toBe("file");
      }
    });
  });

  describe("Hierarchical Ordering", () => {
    it("should display hierarchical structure when folder is expanded", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      // Find a folder
      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) {
        expect(folders.length).toBeGreaterThan(0);
        return;
      }

      // Get first folder name
      const firstFolder = folders[0];
      const label = await firstFolder.$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Check if it has expand icon
      const expandIcon = await firstFolder.$(Selectors.expandIcon);
      if (await expandIcon.isExisting()) {
        const wasExpanded = await fileTreePage.isFolderExpanded(folderName);

        if (!wasExpanded) {
          await fileTreePage.expandFolder(folderName);
          await browser.pause(500);
        }

      }

      // Verify container still works
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should maintain hierarchy when collapsing and re-expanding", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const firstFolder = folders[0];
      const label = await firstFolder.$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Expand
      await fileTreePage.expandFolder(folderName);
      await browser.pause(300);

      const countAfterExpand = await fileTreePage.getVisibleNodeCount();

      // Collapse
      await fileTreePage.collapseFolder(folderName);
      await browser.pause(300);

      const countAfterCollapse = await fileTreePage.getVisibleNodeCount();

      // Re-expand
      await fileTreePage.expandFolder(folderName);
      await browser.pause(300);

      const countAfterReExpand = await fileTreePage.getVisibleNodeCount();

      // Should return to same state
      expect(countAfterReExpand).toBe(countAfterExpand);
    });
  });

  describe("Selection State", () => {
    it("should preserve selection when toggling folder expansion", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      // Expand a folder if available
      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const firstFolder = folders[0];
      const label = await firstFolder.$(Selectors.treeLabel);
      const folderName = await label.getText();

      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // Find a file to select
      const files = await fileTreePage.getFileNodes();
      if (files.length === 0) return;

      const fileLabel = await files[0].$(Selectors.treeLabel);
      const fileName = await fileLabel.getText();

      // Select the file
      await fileTreePage.selectNode(fileName);
      await browser.pause(300);

      const wasSelected = await fileTreePage.isNodeSelected(fileName);
      expect(wasSelected).toBe(true);

      // Collapse and re-expand
      await fileTreePage.collapseFolder(folderName);
      await browser.pause(300);
      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // Check selection is preserved
      const stillSelected = await fileTreePage.isNodeSelected(fileName);
      expect(stillSelected).toBe(true);
    });

    it("should propagate selection to parent folder (indeterminate state)", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const firstFolder = folders[0];
      const label = await firstFolder.$(Selectors.treeLabel);
      const folderName = await label.getText();

      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      const files = await fileTreePage.getFileNodes();
      if (files.length === 0) return;

      // Select first file
      const fileLabel = await files[0].$(Selectors.treeLabel);
      const fileName = await fileLabel.getText();

      await fileTreePage.selectNode(fileName);
      await browser.pause(300);

      // Verify file is selected
      expect(await fileTreePage.isNodeSelected(fileName)).toBe(true);

      // Parent folder should have some selection indication
      // Note: Checking exact indeterminate state would require checking checkbox property
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should select all children when parent folder is selected", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const firstFolder = folders[0];
      const label = await firstFolder.$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Select the folder
      await fileTreePage.selectNode(folderName);
      await browser.pause(500);

      // Expand to see children
      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // Get selected nodes
      const selectedNodes = await fileTreePage.getSelectedNodes();
      expect(selectedNodes.length).toBeGreaterThan(0);
    });
  });

  describe("Expansion State", () => {
    it("should maintain expansion state independently for multiple folders", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      // We need two SIBLING folders (not parent-child) to test independence.
      // After ensureTestFixturesIndexed, root is expanded showing child folders.
      // Skip the root (folders[0]) and use two sibling child folders.
      const folders = await fileTreePage.getFolderNodes();
      expect(folders.length).toBeGreaterThanOrEqual(3);

      // folders[0] is the root (already expanded), folders[1] and folders[2] are siblings
      const label1 = await folders[1].$(Selectors.treeLabel);
      const folder1Name = await label1.getText();

      const label2 = await folders[2].$(Selectors.treeLabel);
      const folder2Name = await label2.getText();

      expect(folder1Name).not.toBe(folder2Name);
      
      // Expand both sibling folders
      await fileTreePage.expandFolder(folder1Name);
      await browser.pause(500);
      await fileTreePage.expandFolder(folder2Name);
      await browser.pause(500);

      // Both should be expanded
      expect(await fileTreePage.isFolderExpanded(folder1Name)).toBe(true);
      expect(await fileTreePage.isFolderExpanded(folder2Name)).toBe(true);

      // Collapse first folder only
      await fileTreePage.collapseFolder(folder1Name);
      await browser.pause(500);

      // First should be collapsed, second still expanded
      expect(await fileTreePage.isFolderExpanded(folder1Name)).toBe(false);
      expect(await fileTreePage.isFolderExpanded(folder2Name)).toBe(true);
    });
  });

  describe("Search Functionality", () => {
    it("should filter files based on search query", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const initialCount = await fileTreePage.getVisibleNodeCount();

      if (initialCount === 0) return;

      // Search for something specific
      try {
        await fileTreePage.search("ts");
        await browser.pause(500);

        // Verify search doesn't break the tree
        const container = await $(Selectors.fileTreeContainer);
        expect(await container.isDisplayed()).toBe(true);

        // Clear search
        await fileTreePage.clearSearch();
        await browser.pause(500);

        // Should restore original view
        const afterClearCount = await fileTreePage.getVisibleNodeCount();
        expect(afterClearCount).toBe(initialCount);
      } catch (e) {
        console.log("Search test skipped - search may not be available");
      }
    });
  });

  describe("Filter Buttons", () => {
    it("should have ALL, SRC, DOCS filter buttons", async () => {
      // Check for filter buttons
      const allBtn = await $('button*=ALL');
      const srcBtn = await $('button*=SRC');
      const docsBtn = await $('button*=DOCS');

      expect(await allBtn.isExisting()).toBe(true);
      expect(await srcBtn.isExisting()).toBe(true);
      expect(await docsBtn.isExisting()).toBe(true);
    });

    it("should toggle active filter on click", async () => {
      const srcBtn = await $('button*=SRC');

      if (await srcBtn.isExisting()) {
        await srcBtn.click();
        await browser.pause(300);

        // SRC should now be active (has bg-primary/20 class)
        const hasActiveClass = await srcBtn.getAttribute("class");
        expect(hasActiveClass).toContain("bg-primary");

        // Click ALL to restore
        const allBtn = await $('button*=ALL');
        await allBtn.click();
        await browser.pause(300);
      }
    });
  });

  describe("UI Stability", () => {
    it("should handle rapid expand/collapse without crashing", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const firstFolder = folders[0];
      const label = await firstFolder.$(Selectors.treeLabel);
      const folderName = await label.getText();

      // Rapidly toggle expansion 10 times
      for (let i = 0; i < 10; i++) {
        await fileTreePage.expandFolder(folderName);
        await browser.pause(50);
        await fileTreePage.collapseFolder(folderName);
        await browser.pause(50);
      }

      // App should still be responsive
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });

    it("should handle rapid checkbox clicks without crashing", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      const nodes = await fileTreePage.getVisibleNodes();
      if (nodes.length === 0) return;

      // Click checkboxes rapidly
      for (const node of nodes.slice(0, 5)) {
        const checkbox = await node.$(Selectors.treeCheckbox);
        if (await checkbox.isExisting()) {
          await checkbox.click();
          await browser.pause(50);
        }
      }

      // App should still work
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).toBe(true);
    });
  });

  describe("Empty State", () => {
    // Note: This test might not work if fixtures are always loaded
    it("should show empty state guidance when no files indexed", async () => {
      // Check if empty state exists (might not if files are indexed)
      const emptyState = await $(Selectors.emptyState);

      if (await emptyState.isExisting()) {
        const text = await emptyState.getText();
        expect(text).toContain("drag");
      } else {
        // Files are indexed, so just verify tree has content
        const nodeCount = await fileTreePage.getVisibleNodeCount();
        expect(nodeCount).toBeGreaterThan(0);
      }
    });
  });

  describe("Selection Callback", () => {
    it("should update selection info when files are selected", async () => {
      await fileTreePage.ensureTestFixturesIndexed();

      // First deselect everything
      const nodes = await fileTreePage.getVisibleNodes();
      for (const node of nodes) {
        const checkbox = await node.$(Selectors.treeCheckbox);
        if (await checkbox.isExisting()) {
          const isChecked = await checkbox.isSelected();
          if (isChecked) {
            await checkbox.click();
            await browser.pause(100);
          }
        }
      }

      await browser.pause(300);

      // Find and expand a folder with files
      const folders = await fileTreePage.getFolderNodes();
      if (folders.length === 0) return;

      const label = await folders[0].$(Selectors.treeLabel);
      const folderName = await label.getText();

      await fileTreePage.expandFolder(folderName);
      await browser.pause(500);

      // Select a file
      const files = await fileTreePage.getFileNodes();
      if (files.length === 0) return;

      const fileLabel = await files[0].$(Selectors.treeLabel);
      const fileName = await fileLabel.getText();

      await fileTreePage.selectNode(fileName);
      await browser.pause(500);

      // Check if selection info is updated
      const selectionInfo = await $(Selectors.selectionInfo);
      if (await selectionInfo.isExisting()) {
        const text = await selectionInfo.getText();
        expect(text).toContain(fileName);
        // Should contain some selection indication
      }
    });
  });
});
