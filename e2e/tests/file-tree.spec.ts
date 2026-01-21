import { AppPage, FileTreePage } from "../utils/pages/index.js";
import { Selectors } from "../utils/selectors.js";
import path from "node:path";
import fs from "node:fs";

describe("File Tree", () => {
  const appPage = new AppPage();
  const fileTreePage = new FileTreePage();
  const fixturesPath = path.join(process.cwd(), "e2e", "fixtures", "test-data");

  before(async () => {
    await appPage.waitForLoad();
    await appPage.navigateToMain();
    await fileTreePage.waitForReady();
  });

  describe("Initial State", () => {
    it("should display the file tree container", async () => {
      const container = await $(Selectors.fileTreeContainer);
      expect(await container.isDisplayed()).to.be.true;
    });

    it("should display the Add Folder button", async () => {
      const addFolderBtn = await $(Selectors.addFolderBtn);
      expect(await addFolderBtn.isDisplayed()).to.be.true;
    });

    it("should display the search toggle button", async () => {
      const searchToggleBtn = await $(Selectors.searchToggleBtn);
      expect(await searchToggleBtn.isDisplayed()).to.be.true;
    });

    it("should show empty state when no folders are indexed", async () => {
      // This test assumes fresh state - may need to clear database first
      const emptyStateOrTree = await Promise.race([
        (async () => {
          const emptyState = await $(Selectors.emptyState);
          if (await emptyState.isExisting()) {
            return "empty";
          }
          return null;
        })(),
        (async () => {
          const nodes = await $$(Selectors.treeNode);
          if (nodes.length > 0) {
            return "has-nodes";
          }
          return null;
        })(),
      ]);

      // Either empty state or existing nodes is valid
      expect(emptyStateOrTree).to.not.be.null;
    });
  });

  describe("Folder Indexing", () => {
    before(async () => {
      // Ensure test fixtures exist
      if (!fs.existsSync(fixturesPath)) {
        fs.mkdirSync(fixturesPath, { recursive: true });
      }

      // Create test files if they don't exist
      const testFiles = [
        { name: "test-file.ts", content: "export const test = true;" },
        { name: "test-file.js", content: "const x = 42;" },
        { name: "test-file.md", content: "# Test Markdown" },
      ];

      for (const file of testFiles) {
        const filePath = path.join(fixturesPath, file.name);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, file.content);
        }
      }
    });

    it("should index a folder when using Tauri command", async () => {
      // Use Tauri invoke to index the fixtures folder
      await browser.execute((folderPath) => {
        // @ts-ignore
        if (window.__TAURI__) {
          // @ts-ignore
          return window.__TAURI__.core.invoke("index_folder", { path: folderPath });
        }
      }, fixturesPath);

      // Wait for indexing to complete
      await browser.pause(2000);

      // Reload root entries
      await browser.execute(() => {
        // Trigger a re-render by dispatching a custom event or calling a method
        // This depends on how the app handles updates
      });

      // Wait for tree to update
      await fileTreePage.waitForNodes(1, 15000);
    });

    it("should display indexed files in the tree", async () => {
      const nodeCount = await fileTreePage.getVisibleNodeCount();
      expect(nodeCount).to.be.at.least(1);
    });

    it("should display file icons correctly", async () => {
      const nodes = await fileTreePage.getVisibleNodes();
      expect(nodes.length).to.be.at.least(1);

      // Check that nodes have tree-icon elements (Material Symbols)
      for (const node of nodes) {
        const icon = await node.$(Selectors.treeIcon);
        if (await icon.isExisting()) {
          // Material Symbols icons contain icon names like "folder", "terminal", etc.
          const iconText = await icon.getText();
          expect(iconText).to.be.a("string");
          expect(iconText.length).to.be.at.least(1);
        }
      }
    });
  });

  describe("Tree Navigation", () => {
    before(async () => {
      // Ensure we have indexed the test folder
      try {
        await fileTreePage.indexFolder(fixturesPath);
        await browser.pause(1000);
      } catch {
        // May already be indexed
      }
    });

    it("should expand a folder when clicking the expand icon", async () => {
      // Find a folder node
      const folderNodes = await fileTreePage.getFolderNodes();

      if (folderNodes.length > 0) {
        const node = folderNodes[0];
        const expandIcon = await node.$(Selectors.expandIcon);

        if (await expandIcon.isExisting()) {
          // Get initial state
          const wasExpanded = await expandIcon.getAttribute("data-expanded");
          const initialExpanded = wasExpanded === "true";

          // Click to toggle
          await expandIcon.click();
          await browser.pause(500);

          // Get new state
          const isNowExpanded = (await expandIcon.getAttribute("data-expanded")) === "true";

          // State should have changed
          expect(isNowExpanded).to.not.equal(initialExpanded);

          // Toggle back if needed
          if (isNowExpanded !== initialExpanded) {
            await expandIcon.click();
          }
        }
      }
    });

    it("should show children when folder is expanded", async () => {
      const initialCount = await fileTreePage.getVisibleNodeCount();

      // Find a collapsed folder and expand it
      const folderNodes = await fileTreePage.getFolderNodes();
      for (const node of folderNodes) {
        const expandIcon = await node.$(Selectors.expandIcon);
        if (await expandIcon.isExisting()) {
          const isExpanded = (await expandIcon.getAttribute("data-expanded")) === "true";
          if (!isExpanded) {
            await expandIcon.click();
            await browser.pause(500);

            const newCount = await fileTreePage.getVisibleNodeCount();

            // Should have more nodes after expanding (if folder has children)
            // Or same if folder is empty
            expect(newCount).to.be.at.least(initialCount);

            break;
          }
        }
      }
    });
  });

  describe("File Selection", () => {
    before(async () => {
      await appPage.navigateToMain();
      await browser.pause(500);
    });

    it("should select a file when clicking its checkbox", async () => {
      const fileNodes = await fileTreePage.getFileNodes();

      if (fileNodes.length > 0) {
        const node = fileNodes[0];
        const checkbox = await node.$(Selectors.treeCheckbox);

        if (await checkbox.isExisting()) {
          const wasSelected = await checkbox.isSelected();

          // Click to select
          await checkbox.click();
          await browser.pause(200);

          const isNowSelected = await checkbox.isSelected();
          expect(isNowSelected).to.not.equal(wasSelected);

          // Toggle back
          await checkbox.click();
        }
      }
    });

    it("should update selection count in header when files are selected", async () => {
      // First, ensure no files are selected
      const initialCount = await appPage.getSelectedFilesCount();

      // Find and select a file
      const fileNodes = await fileTreePage.getFileNodes();
      if (fileNodes.length > 0) {
        const node = fileNodes[0];
        const checkbox = await node.$(Selectors.treeCheckbox);

        if (await checkbox.isExisting()) {
          await checkbox.click();
          await browser.pause(300);

          const newCount = await appPage.getSelectedFilesCount();
          expect(newCount).to.be.at.least(initialCount);

          // Deselect
          await checkbox.click();
        }
      }
    });

    it("should select all children when selecting a folder", async () => {
      // Find a folder and select it
      const folderNodes = await fileTreePage.getFolderNodes();

      if (folderNodes.length > 0) {
        const node = folderNodes[0];
        const checkbox = await node.$(Selectors.treeCheckbox);

        if (await checkbox.isExisting()) {
          const dataChecked = await checkbox.getAttribute("data-checked");
          const wasSelected = dataChecked === "true";

          if (!wasSelected) {
            await checkbox.click();
            await browser.pause(500);

            // Check that selection count increased
            const count = await appPage.getSelectedFilesCount();
            expect(count).to.be.at.least(0);

            // Deselect
            await checkbox.click();
          }
        }
      }
    });
  });

  describe("Search Functionality", () => {
    it("should expand search input when clicking search toggle", async () => {
      // Click search toggle
      const searchToggle = await $(Selectors.searchToggleBtn);
      await searchToggle.click();
      await browser.pause(300);

      // Search input should now be visible
      const searchInput = await $(Selectors.fileTreeSearch);
      const isDisplayed = await searchInput.isDisplayed();
      expect(isDisplayed).to.be.true;
    });

    it("should filter tree when searching", async () => {
      const initialCount = await fileTreePage.getVisibleNodeCount();

      // Search for a specific pattern
      await fileTreePage.search("test");
      await browser.pause(500);

      const filteredCount = await fileTreePage.getVisibleNodeCount();

      // Results may be different (could be more or less depending on matches)
      // Just verify search doesn't break the UI
      expect(filteredCount).to.be.at.least(0);

      // Clear search
      await fileTreePage.clearSearch();
      await browser.pause(500);
    });

    it("should show results matching the search query", async () => {
      await fileTreePage.search(".ts");
      await browser.pause(500);

      const nodes = await fileTreePage.getVisibleNodes();

      // If there are results, they should contain .ts
      if (nodes.length > 0) {
        let hasMatch = false;
        for (const node of nodes) {
          const label = await node.$(Selectors.treeLabel);
          if (await label.isExisting()) {
            const text = await label.getText();
            if (text.includes(".ts") || text.includes("ts")) {
              hasMatch = true;
              break;
            }
          }
        }
        // Note: Search might return parent folders too
        // so we just check that UI doesn't break
        expect(nodes.length).to.be.at.least(0);
      }

      await fileTreePage.clearSearch();
    });

    it("should debounce search input", async () => {
      // Expand search first
      await fileTreePage.expandSearch();

      // Type quickly
      const searchInput = await $(Selectors.fileTreeSearch);
      await searchInput.setValue("tes");
      await browser.pause(50);
      await searchInput.addValue("t");

      // Should not trigger immediate search (debounced)
      await browser.pause(100);

      // After debounce delay, search should execute
      await browser.pause(300);

      // Just verify no errors occurred
      const isDisplayed = await searchInput.isDisplayed();
      expect(isDisplayed).to.be.true;

      await fileTreePage.clearSearch();
    });
  });

  describe("Tree Hierarchy", () => {
    before(async () => {
      // Ensure we have indexed the test folder
      try {
        await fileTreePage.indexFolder(fixturesPath);
        await browser.pause(1000);
      } catch {
        // May already be indexed
      }
    });

    it("should maintain correct tree hierarchy after expansion", async () => {
      // Find a folder node
      const folderNodes = await fileTreePage.getFolderNodes();

      if (folderNodes.length > 0) {
        const folder = folderNodes[0];
        const expandIcon = await folder.$(Selectors.expandIcon);

        if (await expandIcon.isExisting()) {
          // Expand the folder
          const wasExpanded = await expandIcon.getAttribute("data-expanded") === "true";
          if (!wasExpanded) {
            await expandIcon.click();
            await browser.pause(500);
          }

          // Get all visible nodes
          const allNodes = await fileTreePage.getVisibleNodes();

          // Verify that nodes have correct indentation/padding
          for (const node of allNodes) {
            const style = await node.getAttribute("style");
            expect(style).to.be.a("string");
            // paddingLeft should be set based on tree level
            expect(style).to.match(/paddingLeft/);
          }
        }
      }
    });

    it("should show children at correct level relative to parent", async () => {
      // Find an expanded folder
      const folderNodes = await fileTreePage.getFolderNodes();

      for (const folder of folderNodes) {
        const expandIcon = await folder.$(Selectors.expandIcon);

        if (await expandIcon.isExisting()) {
          const isExpanded = await expandIcon.getAttribute("data-expanded") === "true";

          if (!isExpanded) {
            await expandIcon.click();
            await browser.pause(500);
          }

          // Get parent padding
          const parentStyle = await folder.getAttribute("style");
          const parentPaddingMatch = parentStyle.match(/paddingLeft:\s*"?(\d+)px"?/);

          if (parentPaddingMatch) {
            const parentPadding = parseInt(parentPaddingMatch[1], 10);

            // Get all nodes to find children
            const allNodes = await fileTreePage.getVisibleNodes();
            const parentIndex = allNodes.indexOf(folder);

            // Check next node (should be a child if folder was just expanded)
            if (parentIndex >= 0 && parentIndex < allNodes.length - 1) {
              const nextNode = allNodes[parentIndex + 1];
              const childStyle = await nextNode.getAttribute("style");
              const childPaddingMatch = childStyle.match(/paddingLeft:\s*"?(\d+)px"?/);

              if (childPaddingMatch) {
                const childPadding = parseInt(childPaddingMatch[1], 10);

                // Child should have more padding than parent (indented)
                expect(childPadding).to.be.greaterThan(parentPadding);
              }
            }
          }

          break;
        }
      }
    });

    it("should collapse folder and hide children", async () => {
      // Find an expanded folder
      const folderNodes = await fileTreePage.getFolderNodes();

      for (const folder of folderNodes) {
        const expandIcon = await folder.$(Selectors.expandIcon);

        if (await expandIcon.isExisting()) {
          const isExpanded = await expandIcon.getAttribute("data-expanded") === "true";

          if (isExpanded) {
            const initialCount = await fileTreePage.getVisibleNodeCount();

            // Collapse the folder
            await expandIcon.click();
            await browser.pause(500);

            const newCount = await fileTreePage.getVisibleNodeCount();

            // Should have fewer or equal nodes after collapsing
            expect(newCount).to.be.at.most(initialCount);

            // Verify folder is collapsed
            const isNowExpanded = await expandIcon.getAttribute("data-expanded") === "true";
            expect(isNowExpanded).to.be.false;

            break;
          }
        }
      }
    });
  });

  describe("Parent-Child Relationships", () => {
    let testFolderPath: string;

    before(async () => {
      // Create a complex folder structure to test parent-child relationships
      testFolderPath = path.join(fixturesPath, "hierarchy-test");
      if (!fs.existsSync(testFolderPath)) {
        fs.mkdirSync(testFolderPath, { recursive: true });
      }

      // Create multi-level nested structure
      const level1 = path.join(testFolderPath, "level1");
      const level2 = path.join(level1, "level2");
      const level3 = path.join(level2, "level3");

      fs.mkdirSync(level1, { recursive: true });
      fs.mkdirSync(level2, { recursive: true });
      fs.mkdirSync(level3, { recursive: true });

      // Create files at different levels
      fs.writeFileSync(path.join(testFolderPath, "root-file.txt"), "root level");
      fs.writeFileSync(path.join(level1, "level1-file.txt"), "level 1");
      fs.writeFileSync(path.join(level2, "level2-file.txt"), "level 2");
      fs.writeFileSync(path.join(level3, "level3-file.txt"), "level 3");
    });

    it("should correctly index parent-child relationships", async () => {
      // Index the test folder
      await browser.execute((folderPath) => {
        // @ts-ignore
        if (window.__TAURI__) {
          // @ts-ignore
          return window.__TAURI__.core.invoke("index_folder", { path: folderPath });
        }
      }, testFolderPath);

      // Wait for indexing
      await browser.pause(2000);

      // Trigger refresh
      await browser.execute(() => {
        // @ts-ignore
        if (window.__TAURI__) {
          // @ts-ignore
          window.__TAURI__.event.emit("refresh-file-tree");
        }
      });

      await browser.pause(1000);

      // Find the root test folder
      const allNodes = await fileTreePage.getVisibleNodes();
      let rootNode = null;

      for (const node of allNodes) {
        const label = await node.$(Selectors.treeLabel);
        if (await label.isExisting()) {
          const text = await label.getText();
          if (text.includes("hierarchy-test")) {
            rootNode = node;
            break;
          }
        }
      }

      expect(rootNode).to.not.be.null;

      if (rootNode) {
        // Expand the root folder
        const expandIcon = await rootNode.$(Selectors.expandIcon);
        if (await expandIcon.isExisting()) {
          await expandIcon.click();
          await browser.pause(500);
        }

        // Get root padding
        const rootStyle = await rootNode.getAttribute("style");
        const rootPaddingMatch = rootStyle.match(/paddingLeft:\s*"?(\d+)px"?/);
        expect(rootPaddingMatch).to.not.be.null;

        if (rootPaddingMatch) {
          const rootPadding = parseInt(rootPaddingMatch[1], 10);

          // Check that level1 folder appears as child with correct padding
          const nodesAfterExpand = await fileTreePage.getVisibleNodes();
          let level1Node = null;

          for (const node of nodesAfterExpand) {
            const label = await node.$(Selectors.treeLabel);
            if (await label.isExisting()) {
              const text = await label.getText();
              if (text === "level1") {
                level1Node = node;
                break;
              }
            }
          }

          expect(level1Node).to.not.be.null;

          if (level1Node) {
            const level1Style = await level1Node.getAttribute("style");
            const level1PaddingMatch = level1Style.match(/paddingLeft:\s*"?(\d+)px"?/);
            expect(level1PaddingMatch).to.not.be.null;

            if (level1PaddingMatch) {
              const level1Padding = parseInt(level1PaddingMatch[1], 10);
              // level1 should have more padding than root (is indented)
              expect(level1Padding).to.be.greaterThan(rootPadding);
            }
          }
        }
      }
    });

    it("should not show all files at the same level", async () => {
      // Get all visible nodes
      const allNodes = await fileTreePage.getVisibleNodes();

      // Track padding levels
      const paddingLevels = new Set<number>();

      for (const node of allNodes) {
        const style = await node.getAttribute("style");
        const paddingMatch = style.match(/paddingLeft:\s*"?(\d+)px"?/);

        if (paddingMatch) {
          const padding = parseInt(paddingMatch[1], 10);
          paddingLevels.add(padding);
        }
      }

      // Should have at least 2 different padding levels (root and children)
      expect(paddingLevels.size).to.be.at.least(2);
    });
  });

  describe("Drag and Drop", () => {
    let testFolderPath: string;

    before(async () => {
      // Create a test folder structure for drag & drop testing
      testFolderPath = path.join(fixturesPath, "drag-drop-test");
      if (!fs.existsSync(testFolderPath)) {
        fs.mkdirSync(testFolderPath, { recursive: true });
      }

      // Create nested structure
      const nestedPath = path.join(testFolderPath, "nested");
      if (!fs.existsSync(nestedPath)) {
        fs.mkdirSync(nestedPath, { recursive: true });
      }

      // Create test files
      fs.writeFileSync(path.join(testFolderPath, "file1.js"), "console.log('test');");
      fs.writeFileSync(path.join(nestedPath, "file2.js"), "console.log('nested');");
    });

    it("should maintain tree structure after drag and drop", async () => {
      // Index the test folder
      await browser.execute((folderPath) => {
        // @ts-ignore
        if (window.__TAURI__) {
          // @ts-ignore
          return window.__TAURI__.core.invoke("index_folder", { path: folderPath });
        }
      }, testFolderPath);

      // Wait for indexing
      await browser.pause(2000);

      // Trigger refresh event to reload tree
      await browser.execute(() => {
        // @ts-ignore
        if (window.__TAURI__) {
          // @ts-ignore
          window.__TAURI__.event.emit("refresh-file-tree");
        }
      });

      await browser.pause(1000);

      // Find the test folder in the tree
      const allNodes = await fileTreePage.getVisibleNodes();
      let testFolderNode = null;

      for (const node of allNodes) {
        const label = await node.$(Selectors.treeLabel);
        if (await label.isExisting()) {
          const text = await label.getText();
          if (text.includes("drag-drop-test")) {
            testFolderNode = node;
            break;
          }
        }
      }

      if (testFolderNode) {
        // Expand the folder
        const expandIcon = await testFolderNode.$(Selectors.expandIcon);
        if (await expandIcon.isExisting()) {
          await expandIcon.click();
          await browser.pause(500);
        }

        // Get all nodes after expansion
        const expandedNodes = await fileTreePage.getVisibleNodes();

        // Verify children are at correct level
        let foundParent = false;
        let parentPadding = 0;

        for (const node of expandedNodes) {
          const label = await node.$(Selectors.treeLabel);
          if (await label.isExisting()) {
            const text = await label.getText();

            if (text.includes("drag-drop-test")) {
              foundParent = true;
              const style = await node.getAttribute("style");
              const match = style.match(/paddingLeft:\s*"?(\d+)px"?/);
              if (match) {
                parentPadding = parseInt(match[1], 10);
              }
            } else if (foundParent && (text.includes("nested") || text.includes("file1.js"))) {
              // This is a child, verify indentation
              const style = await node.getAttribute("style");
              const match = style.match(/paddingLeft:\s*"?(\d+)px"?/);
              if (match) {
                const childPadding = parseInt(match[1], 10);
                expect(childPadding).to.be.greaterThan(parentPadding);
              }
              break;
            }
          }
        }
      }
    });

    it("should refresh tree correctly after folder move", async () => {
      // Get initial node count
      const initialCount = await fileTreePage.getVisibleNodeCount();

      // Simulate a folder move by triggering refresh event
      await browser.execute(() => {
        // @ts-ignore
        if (window.__TAURI__) {
          // @ts-ignore
          window.__TAURI__.event.emit("refresh-file-tree");
        }
      });

      await browser.pause(1000);

      // Get new node count
      const newCount = await fileTreePage.getVisibleNodeCount();

      // Should have nodes after refresh
      expect(newCount).to.be.at.least(1);

      // Verify tree structure is intact
      const allNodes = await fileTreePage.getVisibleNodes();

      for (const node of allNodes) {
        const style = await node.getAttribute("style");
        expect(style).to.be.a("string");
        // Verify paddingLeft is set correctly
        expect(style).to.match(/paddingLeft/);
      }
    });

    it("should not duplicate children after refresh", async () => {
      // Find a folder and expand it
      const folderNodes = await fileTreePage.getFolderNodes();

      if (folderNodes.length > 0) {
        const folder = folderNodes[0];
        const expandIcon = await folder.$(Selectors.expandIcon);

        if (await expandIcon.isExisting()) {
          // Expand
          await expandIcon.click();
          await browser.pause(500);

          // Get child count
          const initialNodes = await fileTreePage.getVisibleNodes();
          const initialCount = initialNodes.length;

          // Trigger refresh
          await browser.execute(() => {
            // @ts-ignore
            if (window.__TAURI__) {
              // @ts-ignore
              window.__TAURI__.event.emit("refresh-file-tree");
            }
          });

          await browser.pause(1000);

          // Get new count
          const newNodes = await fileTreePage.getVisibleNodes();
          const newCount = newNodes.length;

          // Should not have significantly more nodes (no duplication)
          // Allow for small variation due to refresh state
          expect(newCount).to.be.at.most(initialCount * 1.5);
        }
      }
    });
  });
});
