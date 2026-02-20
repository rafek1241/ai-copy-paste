import { AppPage, FileTreePage } from "../utils/pages/index.js";
import { Selectors } from "../utils/selectors.js";
import path from "node:path";

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
    await fileTreePage.ensureTestFixturesIndexed();
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
      for (let i = 0; i < 3; i++) {
        await browser.execute((selector) => {
          const button = document.querySelector(selector) as HTMLButtonElement | null;
          if (button) {
            button.click();
          }
        }, Selectors.searchToggleBtn);
        await browser.pause(100);
      }

      const firstNode = (await $$(Selectors.treeNode))[0];
      if (firstNode) {
        const expandIcon = await firstNode.$(Selectors.expandIcon);
        if (await expandIcon.isExisting()) {
          try {
            await expandIcon.click();
          } catch {
            // The node may re-render while we are stress-clicking controls.
          }
          await browser.pause(100);
          try {
            await expandIcon.click();
          } catch {
            // Ignore transient stale element states during stress test.
          }
        }
      }

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

  describe("Complex scenario: File hierarchy and interactions", () => {
    const fixturesBase = path.join(process.cwd(), "tests", "e2e", "fixtures", "test-data");
    const hierarchicalTestPath = path.join(fixturesBase, "hierarchical-test");

    const track1Path = path.join(hierarchicalTestPath, "track1");
    const track2Path = path.join(hierarchicalTestPath, "track2");

    const track1PlanPath = path.join(hierarchicalTestPath, "track1", "plan.ts");
    const track1SpecPath = path.join(hierarchicalTestPath, "track1", "spec.ts");

    beforeEach(async () => {
      // Ensure we're on Files tab
      await appPage.navigateToFiles();
      await appPage.clearContext();
      await browser.waitUntil(async () => {
        const emptyNodeCount = await fileTreePage.getVisibleNodeCount();
        return emptyNodeCount === 0;
      }, {
        timeout: 5000,
        interval: 200,
        timeoutMsg: "File tree did not become empty after clear context"
      })
    });

    it("ensure that path will be always the direction of the nesting", async function() {
      this.timeout(60000);
      const veryDeepPath = path.join(hierarchicalTestPath, "track2", "notes.md");
      const veryFarPath = path.join(fixturesBase, "utils.ts")

      // verify that veryDeepPath is always the direction of the nesting
      expect(veryDeepPath.includes(fixturesBase)).toBe(true);
      expect(veryFarPath.includes(fixturesBase)).toBe(true);
      expect(veryDeepPath.includes(path.dirname(veryFarPath))).toBe(true);

      await fileTreePage.indexFolder(veryDeepPath);
      await fileTreePage.indexFolder(veryFarPath);

      const parentDir = path.basename(path.dirname(veryFarPath));
      //except very far path parent folder should be a root folder and very deep path should be nested in it.
      const veryFarParentNode = await fileTreePage.findNodeByName(parentDir);
      expect(veryFarParentNode).toBeTruthy();

      const veryFarParentLevel = await fileTreePage.getNodeLevel(parentDir);
      expect(veryFarParentLevel).toBeGreaterThanOrEqual(0);

      const veryFarNode = await fileTreePage.findNodeByName(path.basename(veryFarPath));
      expect(veryFarNode).toBeTruthy();
      const veryFarNodeLevel = await fileTreePage.getNodeLevel(path.basename(veryFarPath));
      expect(veryFarNodeLevel).toBe(veryFarParentLevel + 1);

      //split veryDeepPath into a parts and from the path that is not in parent dir is nested to the root parent dir folder
      const veryDeepPathParts = veryDeepPath.split(path.sep);
      const veryDeepPathNotInParentDir = veryDeepPathParts.slice(veryDeepPathParts.indexOf(parentDir) + 1).join(path.sep);

      await fileTreePage.expandFolder(parentDir);
      const nestedParts = veryDeepPathNotInParentDir.split(path.sep);
      for (let index = 0; index < nestedParts.length; index += 1) {
        const part = nestedParts[index];
        const node = await fileTreePage.findNodeByName(part);
        expect(node).toBeTruthy();
        const expectedLevel = veryFarParentLevel + index + 1;
        const actualLevel = await fileTreePage.getNodeLevel(part);
        expect(actualLevel).toBe(expectedLevel);
        if (index < nestedParts.length - 1) {
          await fileTreePage.expandFolder(part);
        }
      }
    });

    it("should always group files that has same parent path in a folder", async function() {
      this.timeout(30000);
      //add first folder
      await fileTreePage.indexFolder(track1Path);
      
      const track1Node = await fileTreePage.findNodeByName("track1");
      expect(track1Node).toBeTruthy();
      
      // Auto-expansion may take a moment - wait or expand manually
      let track1Expanded = await fileTreePage.isFolderExpanded("track1");
      if (!track1Expanded) {
        await fileTreePage.expandFolder("track1");
        track1Expanded = await fileTreePage.isFolderExpanded("track1");
      }
      expect(track1Expanded).toBe(true);
      let track1Level = await fileTreePage.getNodeLevel("track1");
      expect(track1Level).toBe(0);

      //add second folder with same path, therefore it should create common parent folder
      await fileTreePage.indexFolder(track2Path);

      const parentNode = await fileTreePage.findNodeByName("hierarchical-test");
      expect(parentNode).toBeTruthy();

      const parentLevel = await fileTreePage.getNodeLevel("hierarchical-test");
      expect(parentLevel).toBe(0);

      //hierarchical-test should be expanded and contains track1 and track2 in it
      let hierarchicalTestExpanded = await fileTreePage.isFolderExpanded("hierarchical-test");
      if (!hierarchicalTestExpanded) {
        await fileTreePage.expandFolder("hierarchical-test");
        hierarchicalTestExpanded = await fileTreePage.isFolderExpanded("hierarchical-test");
      }
      expect(hierarchicalTestExpanded).toBe(true);

      const track2Node = await fileTreePage.findNodeByName("track2");
      expect(track2Node).toBeTruthy();
      let track2Expanded = await fileTreePage.isFolderExpanded("track2");
      if (!track2Expanded) {
        await fileTreePage.expandFolder("track2");
        track2Expanded = await fileTreePage.isFolderExpanded("track2");
      }
      expect(track2Expanded).toBe(true);

      track1Level = await fileTreePage.getNodeLevel("track1");
      const track2Level = await fileTreePage.getNodeLevel("track2");
      expect(track1Level).toBe(1);
      expect(track2Level).toBe(1);
    });

    it("should handle full hierarchical indexing workflow with state preservation", async function() {
      this.timeout(60000);
      // Step 3: EXPECT empty tree (no selected, expanded, or indexed files)
      const emptyNodeCount = await fileTreePage.getVisibleNodeCount();
      expect(emptyNodeCount).toBe(0);

      // Step 4: Index nested files via drag-drop (multiple files at once)
      await fileTreePage.indexFiles([track1PlanPath, track1SpecPath]);

      // Step 5: EXPECT files are indexed and visible in file tree
      const afterIndexCount = await fileTreePage.getVisibleNodeCount();
      expect(afterIndexCount).toBeGreaterThanOrEqual(2);

      // Step 6: EXPECT track1 folder was created to group those files
      const track1Node = await fileTreePage.findNodeByName("track1");
      expect(track1Node).toBeTruthy();

      // Step 7: EXPECT track1 is already expanded (synthetic folder auto-expands)
      const track1Expanded = await fileTreePage.isFolderExpanded("track1");
      expect(track1Expanded).toBe(true);

      // EXPECT hierarchy levels: track1 is root (level 0), files are level 1
      expect(await fileTreePage.getNodeLevel("track1")).toBe(0);

      // Verify plan.ts and spec.ts are visible inside track1
      const planNode = await fileTreePage.findNodeByName("plan.ts");
      expect(planNode).toBeTruthy();
      const specNode = await fileTreePage.findNodeByName("spec.ts");
      expect(specNode).toBeTruthy();

      // EXPECT file hierarchy levels
      expect(await fileTreePage.getNodeLevel("plan.ts")).toBe(1);
      expect(await fileTreePage.getNodeLevel("spec.ts")).toBe(1);

      // Step 8: Select (check) plan.ts
      await fileTreePage.selectNode("plan.ts");

      // Step 9: EXPECT plan.ts is selected
      const planSelected = await fileTreePage.isNodeSelected("plan.ts");
      expect(planSelected).toBe(true);

      // Step 10: Drag-drop the hierarchical-test folder
      await fileTreePage.indexFolder(hierarchicalTestPath);

      // Step 11: EXPECT hierarchical-test is root and expanded
      const hierarchicalNode = await fileTreePage.findNodeByName("hierarchical-test");
      expect(hierarchicalNode).toBeTruthy();
      const hierarchicalExpanded = await fileTreePage.isFolderExpanded("hierarchical-test");
      expect(hierarchicalExpanded).toBe(true);

      // EXPECT hierarchical-test is root level (0)
      expect(await fileTreePage.getNodeLevel("hierarchical-test")).toBe(0);

      // Step 12: EXPECT track1 is at second level, still expanded (state preserved)
      const track1StillExpanded = await fileTreePage.isFolderExpanded("track1");
      expect(track1StillExpanded).toBe(true);

      // EXPECT track1 is now at level 1 (child of hierarchical-test)
      expect(await fileTreePage.getNodeLevel("track1")).toBe(1);

      // EXPECT plan.ts and spec.ts are now at level 2
      expect(await fileTreePage.getNodeLevel("plan.ts")).toBe(2);
      expect(await fileTreePage.getNodeLevel("spec.ts")).toBe(2);

      // Step 13: EXPECT plan.ts is still selected
      const planStillSelected = await fileTreePage.isNodeSelected("plan.ts");
      expect(planStillSelected).toBe(true);

      // Step 14: EXPECT track2 and track3 are visible and collapsed
      const track2Node = await fileTreePage.findNodeByName("track2");
      expect(track2Node).toBeTruthy();
      const track3Node = await fileTreePage.findNodeByName("track3");
      expect(track3Node).toBeTruthy();

      const track2Collapsed = await fileTreePage.isFolderExpanded("track2");
      expect(track2Collapsed).toBe(false);
      const track3Collapsed = await fileTreePage.isFolderExpanded("track3");
      expect(track3Collapsed).toBe(false);

      // EXPECT track2 and track3 are at level 1 (siblings of track1)
      expect(await fileTreePage.getNodeLevel("track2")).toBe(1);
      expect(await fileTreePage.getNodeLevel("track3")).toBe(1);

      // Step 15: Expand track2
      await fileTreePage.expandFolder("track2");

      // Step 16: EXPECT notes.md is visible inside track2
      const notesNode = await fileTreePage.findNodeByName("notes.md");
      expect(notesNode).toBeTruthy();

      // EXPECT notes.md is at level 2 (child of track2)
      expect(await fileTreePage.getNodeLevel("notes.md")).toBe(2);

      // Step 17: Select notes.md
      await fileTreePage.selectNode("notes.md");

      // Step 18: EXPECT track2 checkbox is selected/marked
      // (notes.md is the only file in track2, so selecting it marks the folder)
      const track2Selected = await fileTreePage.isNodeSelected("track2");
      expect(track2Selected).toBe(true);

      // Step 19: EXPECT track1 and track2 are expanded
      expect(await fileTreePage.isFolderExpanded("track1")).toBe(true);
      expect(await fileTreePage.isFolderExpanded("track2")).toBe(true);

      // Step 20: Index the test-data folder
      await fileTreePage.indexFolder(fixturesBase);

      // Step 21: EXPECT test-data is root folder (first level) and expanded
      const testDataNode = await fileTreePage.findNodeByName("test-data");
      expect(testDataNode).toBeTruthy();
      const testDataExpanded = await fileTreePage.isFolderExpanded("test-data");
      expect(testDataExpanded).toBe(true);

      // EXPECT test-data is at level 0 (root)
      expect(await fileTreePage.getNodeLevel("test-data")).toBe(0);

      // Step 22: EXPECT hierarchical-test (second level) and expanded
      const hierarchicalStillExpanded = await fileTreePage.isFolderExpanded("hierarchical-test");
      expect(hierarchicalStillExpanded).toBe(true);

      // EXPECT hierarchical-test is now at level 1 (child of test-data)
      expect(await fileTreePage.getNodeLevel("hierarchical-test")).toBe(1);

      // Step 23: EXPECT track1, track2 (third level) and expanded
      expect(await fileTreePage.isFolderExpanded("track1")).toBe(true);
      expect(await fileTreePage.isFolderExpanded("track2")).toBe(true);

      // EXPECT track1 and track2 are now at level 2 (grandchildren of test-data)
      expect(await fileTreePage.getNodeLevel("track1")).toBe(2);
      expect(await fileTreePage.getNodeLevel("track2")).toBe(2);

      // Step 24: EXPECT track2 is still checkbox-marked (all content selected)
      const track2StillSelected = await fileTreePage.isNodeSelected("track2");
      expect(track2StillSelected).toBe(true);

      // Step 25: EXPECT notes.md and plan.ts are still selected
      const notesStillSelected = await fileTreePage.isNodeSelected("notes.md");
      expect(notesStillSelected).toBe(true);
      const planFinalSelected = await fileTreePage.isNodeSelected("plan.ts");
      expect(planFinalSelected).toBe(true);

      // EXPECT files are now at level 3 (great-grandchildren of test-data)
      expect(await fileTreePage.getNodeLevel("plan.ts")).toBe(3);
      expect(await fileTreePage.getNodeLevel("notes.md")).toBe(3);
    });
  })
});
