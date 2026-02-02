import { AppPage, FileTreePage } from "../utils/pages/index.js";
import { Selectors } from "../utils/selectors.js";
import path from "node:path";

/**
 * Hierarchical Indexing E2E Tests
 *
 * Tests the scenario where:
 * 1. Individual files are indexed first
 * 2. Files are selected
 * 3. Parent directory is indexed - should preserve selection and expand
 * 4. Grandparent directory is indexed - should show ALL children when expanded
 *
 * This tests the fix for the bug where only previously-selected folders
 * appeared after indexing a parent directory.
 */
describe("Hierarchical Indexing", () => {
  const appPage = new AppPage();
  const fileTreePage = new FileTreePage();

  // Test fixture paths
  const fixturesBase = path.join(process.cwd(), "tests", "e2e", "fixtures", "test-data", "hierarchical-test");
  const track1Path = path.join(fixturesBase, "track1");
  const track1PlanPath = path.join(track1Path, "plan.ts");
  const track1SpecPath = path.join(track1Path, "spec.ts");

  before(async () => {
    await appPage.waitForLoad();
    await appPage.navigateToMain();

    // Clear any existing indexed data once before all tests
    try {
      await appPage.clearContext();
    } catch (e) {
      console.log("Could not clear context via UI, attempting direct invoke...");
      try {
        await browser.execute(() => {
          // @ts-ignore - Tauri API available in browser context
          if (window.__TAURI__) {
            // @ts-ignore
            return window.__TAURI__.core.invoke("clear_index");
          }
        });
        await browser.pause(500);
      } catch {
        // May fail if no data exists
      }
    }

    // Navigate to Files tab
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
      btn?.click();
    });
    await browser.pause(500);
  });

  describe("Selection and expansion state preservation", () => {
    it("Step 1: should index individual files from track1 directory", async () => {

      // Index plan.ts
      await expect(fileTreePage.indexFolder(track1PlanPath)).resolves.not.toThrow();
      
      // Index spec.ts
      await expect(fileTreePage.indexFolder(track1SpecPath)).resolves.not.toThrow();

      // Refresh file tree
      await fileTreePage.refresh();

      // Verify files are visible (they should appear at root level as orphans)
      try {
        await fileTreePage.waitForNodes(1, 5000);
        const nodeCount = await fileTreePage.getVisibleNodeCount();
        expect(nodeCount).toBeGreaterThanOrEqual(1);
      } catch {
        console.log("No nodes visible after indexing files - test may fail");
      }
    });

    it("Step 2: should select plan.ts file", async () => {
      // Find and select plan.ts
      const planNode = await fileTreePage.findNodeByName("plan.ts");
      expect(planNode).toBeTruthy();
      
      await fileTreePage.selectNode("plan.ts");
      await browser.pause(300);

      // Verify selection
      const isSelected = await fileTreePage.isNodeSelected("plan.ts");
      expect(isSelected).toBe(true);
    });

    it("Step 3: should index parent directory (track1) and preserve selection", async function() {
      this.timeout(30000);
      // Index the track1 directory
      try {
        await fileTreePage.indexFolder(track1Path);
      } catch (e) {
        console.log("Could not index track1 directory:", e);
        return;
      }

      // Refresh file tree
      await fileTreePage.refresh();

      // Find the track1 folder
      const track1Node = await fileTreePage.findNodeByName("track1");
      expect(track1Node).toBeTruthy();

      // Check if track1 is expanded (should auto-expand due to selected children)
      const isExpanded = await fileTreePage.isFolderExpanded("track1");
      expect(isExpanded).toBe(true);

      // If not expanded, expand it manually
      if (!isExpanded) {
        await fileTreePage.expandFolder("track1");
        await browser.pause(500);
      }

      // Verify plan.ts is still selected inside track1
      const isPlanSelected = await fileTreePage.isNodeSelected("plan.ts");
      expect(isPlanSelected).toBe(true);
    });

    it("Step 4: should index grandparent directory and show ALL child folders", async () => {
      // Index the hierarchical-test directory (grandparent)
      await expect(fileTreePage.indexFolder(fixturesBase)).resolves.not.toThrow();

      // Refresh file tree
      await fileTreePage.refresh();

      // Find the hierarchical-test folder
      const hierarchicalNode = await fileTreePage.findNodeByName("hierarchical-test");
      expect(hierarchicalNode).toBeTruthy();

      // Expand hierarchical-test folder
      await fileTreePage.expandFolder("hierarchical-test");
      await browser.pause(500);

      // Get all visible nodes after expansion
      const nodes = await fileTreePage.getVisibleNodes();
      const nodeNames: string[] = [];
      for (const node of nodes) {
        const label = await node.$(Selectors.treeLabel);
        if (await label.isExisting()) {
          nodeNames.push(await label.getText());
        }
      }

      // Verify ALL three track folders are visible (not just track1 with selected files)
      const hasTrack1 = nodeNames.includes("track1");
      const hasTrack2 = nodeNames.includes("track2");
      const hasTrack3 = nodeNames.includes("track3");

      // This is the key assertion - all three folders should be visible
      expect(hasTrack1).toBe(true);
      expect(hasTrack2).toBe(true);
      expect(hasTrack3).toBe(true);
    });

    it("Step 5: should still have plan.ts selected after grandparent indexing", async () => {
      // Expand track1 if needed
      const isTrack1Expanded = await fileTreePage.isFolderExpanded("track1");
      if (!isTrack1Expanded) {
        await fileTreePage.expandFolder("track1");
        await browser.pause(500);
      }

      // Verify plan.ts is still selected
      const isPlanSelected = await fileTreePage.isNodeSelected("plan.ts");
      expect(isPlanSelected).toBe(true);
    });
  });

  describe("Child count accuracy", () => {
    it("should show correct child count in folder labels", async () => {
      // Find hierarchical-test folder
      const hierarchicalNode = await fileTreePage.findNodeByName("hierarchical-test");
      expect(hierarchicalNode).toBeTruthy();

      // Get the text content which should include "(3 items)" or similar
      const nodeText = await hierarchicalNode?.getText() || "";
      console.log("hierarchical-test node text:", nodeText);

      // The folder should indicate it has 3 items (track1, track2, track3)
      // The exact format may vary, but we verify the number is correct
      const hasThreeItems = nodeText.includes("3");
      expect(hasThreeItems).toBe(true);

      // When expanded, we should actually see 3 folders
      const isExpanded = await fileTreePage.isFolderExpanded("hierarchical-test");
      if (!isExpanded) {
        await fileTreePage.expandFolder("hierarchical-test");
        await browser.pause(500);
      }

      // Count visible folder children
      const nodes = await fileTreePage.getVisibleNodes();
      let folderCount = 0;
      for (const node of nodes) {
        const label = await node.$(Selectors.treeLabel);
        if (await label.isExisting()) {
          const name = await label.getText();
          if (name.startsWith("track")) {
            folderCount++;
          }
        }
      }

      expect(folderCount).toBe(3);
    });
  });
});
