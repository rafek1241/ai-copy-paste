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
          const container = await $(FallbackSelectors.fileTreeContainer);
          return container.isExisting();
        } catch {
          return false;
        }
      },
      {
        timeout: 15000,
        timeoutMsg: "File tree did not load within 15 seconds",
      }
    );
  }

  /**
   * Click the Add Folder button
   */
  async clickAddFolder(): Promise<void> {
    try {
      await this.safeClick(Selectors.addFolderBtn);
    } catch {
      await this.safeClick(FallbackSelectors.addFolderBtn);
    }
  }

  /**
   * Search for files/folders
   */
  async search(query: string): Promise<void> {
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
      const labels = await node.$$(".tree-label, [data-testid='tree-label']");
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

    const expandIcon = await node.$(".expand-icon, [data-testid='expand-icon']");
    if (await expandIcon.isExisting()) {
      await expandIcon.click();
      await browser.pause(300); // Wait for children to load
    }
  }

  /**
   * Collapse a folder by name
   */
  async collapseFolder(name: string): Promise<void> {
    await this.expandFolder(name); // Toggle
  }

  /**
   * Check/select a node by name
   */
  async selectNode(name: string): Promise<void> {
    const node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }

    const checkbox = await node.$(".tree-checkbox, [data-testid='tree-checkbox'], input[type='checkbox']");
    if (await checkbox.isExisting()) {
      const isChecked = await checkbox.isSelected();
      if (!isChecked) {
        await checkbox.click();
        await browser.pause(200); // Wait for selection propagation
      }
    }
  }

  /**
   * Uncheck/deselect a node by name
   */
  async deselectNode(name: string): Promise<void> {
    const node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }

    const checkbox = await node.$(".tree-checkbox, [data-testid='tree-checkbox'], input[type='checkbox']");
    if (await checkbox.isExisting()) {
      const isChecked = await checkbox.isSelected();
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

    const checkbox = await node.$(".tree-checkbox, [data-testid='tree-checkbox'], input[type='checkbox']");
    if (await checkbox.isExisting()) {
      return await checkbox.isSelected();
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

    const expandIcon = await node.$(".expand-icon.expanded, [data-testid='expand-icon'].expanded");
    return await expandIcon.isExisting();
  }

  /**
   * Get all selected nodes
   */
  async getSelectedNodes(): Promise<string[]> {
    const nodes = await this.getVisibleNodes();
    const selectedNames: string[] = [];

    for (const node of nodes) {
      const checkbox = await node.$(".tree-checkbox, input[type='checkbox']");
      if ((await checkbox.isExisting()) && (await checkbox.isSelected())) {
        const label = await node.$(".tree-label");
        if (await label.isExisting()) {
          selectedNames.push(await label.getText());
        }
      }
    }

    return selectedNames;
  }

  /**
   * Get the test fixtures directory path
   */
  getTestFixturesPath(): string {
    return path.join(process.cwd(), "e2e", "fixtures", "test-data");
  }

  /**
   * Index a folder via Tauri command (simulated through UI)
   * Note: In real E2E tests, you'd use the Add Folder button
   * which opens a native file dialog. This is for testing
   * scenarios where we need to index specific paths.
   */
  async indexFolder(folderPath: string): Promise<void> {
    // Execute JavaScript to invoke the Tauri command directly
    await browser.execute((path) => {
      // @ts-ignore - Tauri API available in browser context
      if (window.__TAURI__) {
        return window.__TAURI__.core.invoke("index_folder", { path });
      }
      throw new Error("Tauri API not available");
    }, folderPath);

    // Wait for indexing to complete
    await browser.pause(1000);
  }

  /**
   * Wait for tree to have nodes
   */
  async waitForNodes(minCount: number = 1, timeout: number = 10000): Promise<void> {
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
}
