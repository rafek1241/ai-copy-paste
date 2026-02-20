import { BasePage } from "./BasePage.js";
import { Selectors, FallbackSelectors } from "../selectors.js";
import path from "node:path";

const isCI = Boolean(process.env.CI);

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
    if (process.env.E2E_AVOID_NATIVE_DIALOGS !== "0") {
      const button = await $(Selectors.addFolderBtn);
      await button.waitForExist({ timeout: 5000 });
      return;
    }

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
    await browser.waitUntil(
      async () => {
        const searchInput = await $(Selectors.fileTreeSearch);
        return searchInput.isExisting();
      },
      { timeout: 3000, interval: 100, timeoutMsg: "Search input did not become visible" }
    );
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
    await this.waitForDebounce(320);
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
        await browser.waitUntil(
          async () => {
            const searchInput = await $(Selectors.fileTreeSearch);
            if (!(await searchInput.isExisting())) {
              return true;
            }
            return (await searchInput.getValue()) === "";
          },
          { timeout: 3000, interval: 100 }
        );
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
    await this.waitForDebounce(320);
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
    const findInVisibleNodes = async (): Promise<WebdriverIO.Element | null> => {
      const nodes = await this.getVisibleNodes();
      for (const node of nodes) {
        const label = await node.$(Selectors.treeLabel);
        if (!(await label.isExisting())) {
          continue;
        }

        const text = await label.getText();
        if (text === name) {
          return node;
        }
      }

      return null;
    };

    const scrollContainer = await $(Selectors.fileTreeScroll);
    if (!(await scrollContainer.isExisting())) {
      return findInVisibleNodes();
    }

    const maxScrollTop = await browser.execute((element) => {
      const htmlElement = element as unknown as HTMLElement;
      return Math.max(0, htmlElement.scrollHeight - htmlElement.clientHeight);
    }, scrollContainer);

    const step = 160;
    for (let scrollTop = 0; scrollTop <= maxScrollTop; scrollTop += step) {
      await browser.execute(
        (element, nextScrollTop) => {
          (element as unknown as HTMLElement).scrollTop = nextScrollTop;
        },
        scrollContainer,
        scrollTop
      );
      await this.waitForDebounce(30);

      const match = await findInVisibleNodes();
      if (match) {
        return match;
      }
    }

    await browser.execute((element) => {
      (element as unknown as HTMLElement).scrollTop = 0;
    }, scrollContainer);

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
        try {
          await browser.waitUntil(
            async () => (await expandIcon.getAttribute("data-expanded")) === "true",
            {
              timeout: 5000,
              interval: 100,
            }
          );
        } catch {}
      }
    }
  }

  /**
   * Expand a folder only when currently collapsed
   */
  async expandFolderIfCollapsed(name: string): Promise<void> {
    const node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }

    const expandIcon = await node.$(Selectors.expandIcon);
    if (!(await expandIcon.isExisting())) {
      return;
    }

    const isExpanded = await expandIcon.getAttribute("data-expanded");
    if (isExpanded === "true") {
      return;
    }

    await expandIcon.click();
    try {
      await browser.waitUntil(
        async () => (await expandIcon.getAttribute("data-expanded")) === "true",
        {
          timeout: 5000,
          interval: 100,
        }
      );
    } catch {}
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
        await browser.waitUntil(
          async () => (await expandIcon.getAttribute("data-expanded")) !== "true",
          { timeout: 5000, interval: 100 }
        );
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
        await browser.waitUntil(async () => this.isNodeChecked(checkbox), {
          timeout: 3000,
          interval: 100,
        });
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
        await browser.waitUntil(async () => !(await this.isNodeChecked(checkbox)), {
          timeout: 3000,
          interval: 100,
        });
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
   * Check whether a node shows a sensitive indicator icon
   */
  async hasSensitiveIndicator(name: string): Promise<boolean> {
    const node = await this.findNodeByName(name);
    if (!node) {
      return false;
    }

    const indicator = await node.$(Selectors.sensitiveIndicator);
    return indicator.isExisting();
  }

  /**
   * Wait for a file node's sensitive indicator to match expected state
   */
  async waitForSensitiveIndicatorState(
    name: string,
    expected: boolean,
    timeout: number = 15000
  ): Promise<void> {
    let node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }

    await browser.waitUntil(
      async () => {
        try {
          const currentNode = node;
          if (!currentNode) {
            return false;
          }
          const indicator = await currentNode.$(Selectors.sensitiveIndicator);
          return (await indicator.isExisting()) === expected;
        } catch {
          node = await this.findNodeByName(name);
          if (!node) {
            return false;
          }

          try {
            const indicator = await node.$(Selectors.sensitiveIndicator);
            return (await indicator.isExisting()) === expected;
          } catch {
            return false;
          }
        }
      },
      {
        timeout,
        interval: 200,
        timeoutMsg: `Sensitive indicator for ${name} did not become ${expected}`,
      }
    );
  }

  /**
   * Check whether a node currently has a selectable checkbox input
   */
  async hasSelectionCheckbox(name: string): Promise<boolean> {
    const node = await this.findNodeByName(name);
    if (!node) {
      return false;
    }

    const checkbox = await node.$(Selectors.treeCheckbox);
    return checkbox.isExisting();
  }

  /**
   * Check whether selection is blocked for a file node
   */
  async isSelectionBlocked(name: string): Promise<boolean> {
    const node = await this.findNodeByName(name);
    if (!node) {
      return false;
    }

    const blocked = await node.getAttribute("data-selection-blocked");
    return blocked === "true";
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
   * Refresh the file tree via Tauri event
   */
  async refresh(): Promise<void> {
    await browser.execute(() => {
      // @ts-ignore
      const tauri = window.__TAURI__;
      if (tauri) {
        // @ts-ignore
        tauri.event.emit("refresh-file-tree");
      }
    });
    await this.waitForDebounce(200);
  }

  /**
   * Ensure that test fixtures are indexed and visible
   */
  async ensureTestFixturesIndexed(): Promise<void> {
    await this.waitForReady();
    await this.waitForTauriReady();
    
    let nodeCount = await this.getVisibleNodeCount();
    if (nodeCount === 0) {
      console.log("FileTreePage: Tree is empty, indexing test fixtures...");
      const fixturesPath = this.getTestFixturesPath();
      await this.indexFolder(fixturesPath);
      
      // Wait for nodes to appear with retry
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.waitForNodes(1, 5000);
          break;
        } catch {
          console.log(`FileTreePage: Attempt ${attempt + 1} - nodes not yet visible, refreshing...`);
          await this.refresh();
        }
      }
    }
    
    // Final check: verify we have nodes now
    nodeCount = await this.getVisibleNodeCount();
    console.log(`FileTreePage: ensureTestFixturesIndexed complete, node count: ${nodeCount}`);

    // Ensure the root folder is expanded so tests can access files
    if (nodeCount > 0) {
      const folders = await this.getFolderNodes();
      if (folders.length > 0) {
        const label = await folders[0].$(Selectors.treeLabel);
        if (await label.isExisting()) {
          const name = await label.getText();
          try {
            await this.expandFolder(name);
          } catch {
            // May already be expanded
          }
        }
      }
    }
  }

  /**
   * Get the test fixtures directory path
   */
  getTestFixturesPath(): string {
    return path.join(process.cwd(), "tests", "e2e", "fixtures", "test-data");
  }

  async waitForIndexingComplete(timeout: number = 15000): Promise<boolean> {
    return await browser.executeAsync(
      (timeoutMs: number, done: (result: boolean) => void) => {
        const tauri = (window as any).__TAURI__;
        if (!tauri?.event?.listen) {
          done(false);
          return;
        }

        let finished = false;
        let unlisten: (() => void) | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const finalize = (result: boolean) => {
          if (finished) {
            return;
          }
          finished = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          if (unlisten) {
            unlisten();
          }
          done(result);
        };

        timeoutId = setTimeout(() => finalize(false), timeoutMs);

        tauri.event
          .listen("indexing-progress", (event: { payload?: { current_path?: string } }) => {
            if (event?.payload?.current_path === "Complete") {
              finalize(true);
            }
          })
          .then((cleanup: () => void) => {
            unlisten = cleanup;
            if (finished) {
              cleanup();
            }
          })
          .catch(() => {
            finalize(false);
          });
      },
      timeout
    );
  }

  private async emitDragDropAndWaitForComplete(
    paths: string[],
    timeout: number = 8000
  ): Promise<boolean> {
    return browser.executeAsync(
      (dragDropPaths: string[], timeoutMs: number, done: (result: boolean) => void) => {
        const tauri = (window as any).__TAURI__;
        if (!tauri?.event?.listen || !tauri?.event?.emit) {
          done(false);
          return;
        }

        let finished = false;
        let unlisten: (() => void) | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const finalize = (result: boolean) => {
          if (finished) {
            return;
          }

          finished = true;

          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          if (unlisten) {
            unlisten();
          }

          done(result);
        };

        timeoutId = setTimeout(() => finalize(false), timeoutMs);

        tauri.event
          .listen("indexing-progress", (event: { payload?: { current_path?: string } }) => {
            if (event?.payload?.current_path === "Complete") {
              finalize(true);
            }
          })
          .then(async (cleanup: () => void) => {
            unlisten = cleanup;

            try {
              await tauri.event.emit("tauri://drag-drop", {
                paths: dragDropPaths,
                position: { x: 0, y: 0 },
              });
            } catch {
              finalize(false);
            }
          })
          .catch(() => {
            finalize(false);
          });
      },
      paths,
      timeout
    );
  }

  private async waitForNodeCountStability(timeout: number = 1500): Promise<void> {
    let previousCount = -1;
    let stableReads = 0;

    await browser.waitUntil(
      async () => {
        const currentCount = await this.getVisibleNodeCount();
        if (currentCount === previousCount) {
          stableReads += 1;
        } else {
          previousCount = currentCount;
          stableReads = 0;
        }
        return stableReads >= 2;
      },
      { timeout, interval: 120 }
    );
  }

  /**
   * Index multiple files/folders at once via drag-drop
   */
  async indexFiles(paths: string[]): Promise<void> {
    await this.waitForTauriReady();

    const countBefore = await this.getVisibleNodeCount();
    const normalizedPaths = paths.map(p => p.replace(/\\/g, '/'));

    const indexingCompleted = await this.emitDragDropAndWaitForComplete(normalizedPaths);

    if (!indexingCompleted) {
      try {
        await browser.waitUntil(
          async () => (await this.getVisibleNodeCount()) !== countBefore,
          { timeout: 3000, interval: 100 }
        );
      } catch {
        // Count may not change if re-indexing the same content.
      }
    }

    await this.waitForNodeCountStability(isCI ? 3000 : 1500);
  }

  /**
   * Index a folder via Tauri command (simulated through UI drag-drop)
   */
  async indexFolder(folderPath: string): Promise<void> {
    await this.waitForTauriReady();

    const countBefore = await this.getVisibleNodeCount();

    // Normalize path for Windows to avoid escaping issues
    const normalizedPath = folderPath.replace(/\\/g, '/');

    const indexingCompleted = await this.emitDragDropAndWaitForComplete([normalizedPath]);

    if (!indexingCompleted) {
      try {
        await browser.waitUntil(
          async () => (await this.getVisibleNodeCount()) !== countBefore,
          { timeout: 3000, interval: 100 }
        );
      } catch {
        // Count may not change if re-indexing same content.
      }
    }

    await this.waitForNodeCountStability(isCI ? 3000 : 1500);
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
        interval: 100,
        timeoutMsg: `File tree did not show at least ${minCount} nodes within ${timeout}ms`,
      }
    );
  }

  /**
   * Get the hierarchy level of a node by name (reads data-level attribute)
   */
  async getNodeLevel(name: string): Promise<number> {
    const node = await this.findNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" not found`);
    }
    const level = await node.getAttribute("data-level");
    return parseInt(level, 10);
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
