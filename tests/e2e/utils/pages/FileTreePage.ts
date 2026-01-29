import { BasePage } from "./BasePage.js";
import { Selectors, FallbackSelectors } from "../selectors.js";
import path from "node:path";

/**
 * Page Object for File Tree component
 */
export class FileTreePage extends BasePage {
  /**
   * Wait for file tree to be ready
   */
  async waitForReady(): Promise<void> {
    await browser.waitUntil(
      async () => {
        try {
          const container = await $(Selectors.fileTreeContainer);
          return container.isExisting();
        } catch {
          return false;
        }
      },
      {
        timeout: 5000,
        timeoutMsg: "File tree did not load within 5 seconds",
      }
    );
  }

  /**
   * Click the Add Folder button (now "Add Context" in header)
   */
  async clickAddFolder(): Promise<void> {
    try {
      await this.safeClick(Selectors.addFolderBtn);
    } catch {
      await this.safeClick(FallbackSelectors.addFolderBtn);
    }
  }

  /**
   * Expand the search input if collapsed
   */
  async expandSearch(): Promise<void> {
    try {
      // Check if search input already exists
      const searchInput = await $(Selectors.fileTreeSearch);
      if (await searchInput.isExisting()) {
        return; // Already expanded
      }
    } catch {
      // Search not expanded
    }

    // Click the search toggle button
    try {
      await this.safeClick(Selectors.searchToggleBtn);
    } catch {
      await this.safeClick(FallbackSelectors.searchToggleBtn);
    }
    await browser.pause(300);
  }

  /**
   * Search for files/folders
   */
  async search(query: string): Promise<void> {
    // First expand the search if needed
    await this.expandSearch();

    try {
      await this.safeSetValue(Selectors.fileTreeSearch, query);
    } catch {
      await this.safeSetValue(FallbackSelectors.fileTreeSearch, query);
    }
    // Wait for debounced search
    await browser.pause(300);
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    try {
      // Check if there's a clear button
      const clearBtn = await $(Selectors.clearSearchBtn);
      if (await clearBtn.isExisting()) {
        await clearBtn.click();
        return;
      }
    } catch {
      // No clear button, try setting empty value
    }

    try {
      await this.safeSetValue(Selectors.fileTreeSearch, "");
    } catch {
      await this.safeSetValue(FallbackSelectors.fileTreeSearch, "");
    }
    await browser.pause(300);
  }

  /**
   * Check if empty state is displayed
   */
  async isEmptyStateDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.emptyState);
    } catch {
      return await this.isDisplayed(FallbackSelectors.emptyState);
    }
  }

  /**
   * Get all visible tree nodes
   */
  async getVisibleNodes(): Promise<WebdriverIO.ElementArray> {
    try {
      return await $$(Selectors.treeNode);
    } catch {
      return await $$(FallbackSelectors.treeNode);
    }
  }

  /**
   * Get the number of visible tree nodes
   */
  async getVisibleNodeCount(): Promise<number> {
    const nodes = await this.getVisibleNodes();
    return nodes.length;
  }

  /**
   * Find a tree node by name
   */
  async findNodeByName(name: string): Promise<WebdriverIO.Element | null> {
    const nodes = await this.getVisibleNodes();

    for (const node of nodes) {
      const labels = await node.$$(Selectors.treeLabel);
      for (const label of labels) {
        const text = await label.getText();
        if (text === name) {
          return node;
        }
      }
    }

    return null;
  }

  /**
   * Expand a folder by name
   */
  async expandFolder(name: string): Promise<void> {
    const node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }

    const expandIcon = await node.$(Selectors.expandIcon);
    if (await expandIcon.isExisting()) {
      const isExpanded = await expandIcon.getAttribute("data-expanded");
      if (isExpanded !== "true") {
        await expandIcon.click();
        await browser.pause(300); // Wait for children to load
      }
    }
  }

  /**
   * Collapse a folder by name
   */
  async collapseFolder(name: string): Promise<void> {
    const node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }

    const expandIcon = await node.$(Selectors.expandIcon);
    if (await expandIcon.isExisting()) {
      const isExpanded = await expandIcon.getAttribute("data-expanded");
      if (isExpanded === "true") {
        await expandIcon.click();
        await browser.pause(300);
      }
    }
  }

  /**
   * Check/select a node by name
   */
  async selectNode(name: string): Promise<void> {
    const node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }

    const checkbox = await node.$(Selectors.treeCheckbox);
    if (await checkbox.isExisting()) {
      const isChecked = await this.isNodeChecked(checkbox);
      if (!isChecked) {
        await checkbox.click();
        await browser.pause(200); // Wait for selection propagation
      }
    }
  }

  /**
   * Check if a checkbox element is checked
   */
  private async isNodeChecked(checkbox: WebdriverIO.Element): Promise<boolean> {
    // For input type checkbox
    const tagName = await checkbox.getTagName();
    if (tagName === "input") {
      return await checkbox.isSelected();
    }
    // For custom div checkbox, check data-checked attribute
    const dataChecked = await checkbox.getAttribute("data-checked");
    return dataChecked === "true";
  }

  /**
   * Uncheck/deselect a node by name
   */
  async deselectNode(name: string): Promise<void> {
    const node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }

    const checkbox = await node.$(Selectors.treeCheckbox);
    if (await checkbox.isExisting()) {
      const isChecked = await this.isNodeChecked(checkbox);
      if (isChecked) {
        await checkbox.click();
        await browser.pause(200);
      }
    }
  }

  /**
   * Check if a node is selected
   */
  async isNodeSelected(name: string): Promise<boolean> {
    const node = await this.findNodeByName(name);
    if (!node) {
      return false;
    }

    const checkbox = await node.$(Selectors.treeCheckbox);
    if (await checkbox.isExisting()) {
      return await this.isNodeChecked(checkbox);
    }

    return false;
  }

  /**
   * Check if a folder is expanded
   */
  async isFolderExpanded(name: string): Promise<boolean> {
    const node = await this.findNodeByName(name);
    if (!node) {
      return false;
    }

    const expandIcon = await node.$(Selectors.expandIcon);
    if (await expandIcon.isExisting()) {
      const isExpanded = await expandIcon.getAttribute("data-expanded");
      return isExpanded === "true";
    }
    return false;
  }

  /**
   * Get all selected nodes
   */
  async getSelectedNodes(): Promise<string[]> {
    const nodes = await this.getVisibleNodes();
    const selectedNames: string[] = [];

    for (const node of nodes) {
      const checkbox = await node.$(Selectors.treeCheckbox);
      if (await checkbox.isExisting()) {
        const isChecked = await this.isNodeChecked(checkbox);
        if (isChecked) {
          const label = await node.$(Selectors.treeLabel);
          if (await label.isExisting()) {
            selectedNames.push(await label.getText());
          }
        }
      }
    }

    return selectedNames;
  }

  /**
   * Check if a node is a folder
   */
  async isNodeFolder(node: WebdriverIO.Element): Promise<boolean> {
    const nodeType = await node.getAttribute("data-node-type");
    return nodeType === "folder";
  }

  /**
   * Check if a node is a file
   */
  async isNodeFile(node: WebdriverIO.Element): Promise<boolean> {
    const nodeType = await node.getAttribute("data-node-type");
    return nodeType === "file";
  }

  /**
   * Ensure that test fixtures are indexed and visible
   */
  async ensureTestFixturesIndexed(): Promise<void> {
    await this.waitForReady();
    await this.waitForTauriReady();
    const nodeCount = await this.getVisibleNodeCount();
    if (nodeCount === 0) {
      console.log("FileTreePage: Tree is empty, indexing test fixtures...");
      const fixturesPath = this.getTestFixturesPath();
      await this.indexFolder(fixturesPath);
      try {
        await browser.execute(() => {
          const tauri = (window as any).__TAURI__;
          if (tauri) {
            tauri.event.emit("refresh-file-tree");
          }
        });
      } catch {
      }
      await this.waitForNodes(1, 10000);
    } else {
      console.log(`FileTreePage: Tree already has ${nodeCount} nodes`);
    }

    // Ensure the root folder is expanded so tests can access files
    const folders = await this.getFolderNodes();
    if (folders.length > 0) {
      const label = await folders[0].$(Selectors.treeLabel);
      if (await label.isExisting()) {
        const name = await label.getText();
        await this.expandFolder(name);
      }
    }
  }

  /**
   * Get the test fixtures directory path
   */
  getTestFixturesPath(): string {
    return path.join(process.cwd(), "tests", "e2e", "fixtures", "test-data");
  }

  /**
   * Index a folder via Tauri command (simulated through UI drag-drop)
   */
  async indexFolder(folderPath: string): Promise<void> {
    await this.waitForTauriReady();

    // Normalize path for Windows to avoid escaping issues
    const normalizedPath = folderPath.replace(/\\/g, '/');

    await browser.execute((path) => {
      const tauri = (window as any).__TAURI__;
      if (tauri) {
        tauri.event.emit("tauri://drag-drop", {
          paths: [path],
          position: { x: 0, y: 0 }
        });
      } else {
        throw new Error("Tauri API not available");
      }
    }, normalizedPath);

    // Wait for indexing to complete - use waitUntil for faster detection
    try {
      await browser.waitUntil(
        async () => {
          const count = await this.getVisibleNodeCount();
          return count > 0;
        },
        { timeout: 5000, interval: 300 }
      );
    } catch {
      // Fallback: fixed pause if waitUntil fails
      await browser.pause(1000);
    }
  }

  /**
   * Wait for tree to have nodes
   */
  async waitForNodes(minCount: number = 1, timeout: number = 5000): Promise<void> {
    await browser.waitUntil(
      async () => {
        const count = await this.getVisibleNodeCount();
        return count >= minCount;
      },
      {
        timeout,
        timeoutMsg: `File tree did not show at least ${minCount} nodes within ${timeout}ms`,
      }
    );
  }

  /**
   * Get all folder nodes
   */
  async getFolderNodes(): Promise<WebdriverIO.ElementArray> {
    return await $$(Selectors.treeNodeFolder);
  }

  /**
   * Get all file nodes
   */
  async getFileNodes(): Promise<WebdriverIO.ElementArray> {
    return await $$(Selectors.treeNodeFile);
  }
}
