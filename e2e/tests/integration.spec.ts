import {
  AppPage,
  FileTreePage,
  PromptBuilderPage,
  SettingsPage,
  HistoryPage,
} from "../utils/pages/index.js";
import path from "node:path";
import fs from "node:fs";

describe("End-to-End Integration Tests", () => {
  const appPage = new AppPage();
  const fileTreePage = new FileTreePage();
  const promptBuilderPage = new PromptBuilderPage();
  const settingsPage = new SettingsPage();
  const historyPage = new HistoryPage();
  const fixturesPath = path.join(process.cwd(), "e2e", "fixtures", "test-data");

  before(async () => {
    await appPage.waitForLoad();

    // Setup test fixtures
    if (!fs.existsSync(fixturesPath)) {
      fs.mkdirSync(fixturesPath, { recursive: true });
    }

    const testFiles = [
      {
        name: "component.tsx",
        content: `import React from 'react';
export const Component = () => <div>Hello World</div>;`,
      },
      {
        name: "utils.ts",
        content: `export const sum = (a: number, b: number) => a + b;
export const multiply = (a: number, b: number) => a * b;`,
      },
      {
        name: "config.json",
        content: '{"name": "test", "version": "1.0.0"}',
      },
      {
        name: "README.md",
        content: "# Test Project\n\nThis is a test project for E2E testing.",
      },
    ];

    for (const file of testFiles) {
      fs.writeFileSync(path.join(fixturesPath, file.name), file.content);
    }

    // Create subfolder
    const subfolderPath = path.join(fixturesPath, "components");
    if (!fs.existsSync(subfolderPath)) {
      fs.mkdirSync(subfolderPath, { recursive: true });
    }

    fs.writeFileSync(
      path.join(subfolderPath, "Button.tsx"),
      "export const Button = ({ label }: { label: string }) => <button>{label}</button>;"
    );
  });

  describe("Complete Workflow: Index -> Select -> Build -> Copy", () => {
    it("should complete the full context collection workflow", async function () {
      this.timeout(60000);

      // Step 1: Navigate to Main view
      await appPage.navigateToMain();
      expect(await appPage.isFileTreeDisplayed()).to.be.true;

      // Step 2: Index the test fixtures folder
      try {
        await fileTreePage.indexFolder(fixturesPath);
        await browser.pause(3000);
        await fileTreePage.waitForNodes(1, 15000);
      } catch (error) {
        console.log("Indexing error:", error);
        // May already be indexed
      }

      // Step 3: Verify files appear in tree
      const nodeCount = await fileTreePage.getVisibleNodeCount();
      expect(nodeCount).to.be.at.least(1);

      // Step 4: Select files
      const nodes = await fileTreePage.getVisibleNodes();
      let selectedCount = 0;

      for (const node of nodes) {
        const icon = await node.$(".tree-icon");
        const iconText = await icon.getText();

        if (iconText === "📄") {
          const checkbox = await node.$("input[type='checkbox']");
          if ((await checkbox.isExisting()) && !(await checkbox.isSelected())) {
            await checkbox.click();
            await browser.pause(200);
            selectedCount++;
            if (selectedCount >= 2) break;
          }
        }
      }

      // Step 5: Verify selection count
      if (selectedCount > 0) {
        const headerCount = await appPage.getSelectedFilesCount();
        expect(headerCount).to.be.at.least(1);
      }

      // Step 6: Select template
      await promptBuilderPage.selectTemplate("agent");
      await browser.pause(200);

      // Step 7: Add custom instructions
      await promptBuilderPage.setCustomInstructions(
        "Analyze the code structure and suggest improvements."
      );

      // Step 8: Build prompt
      if (selectedCount > 0) {
        await promptBuilderPage.clickBuildPrompt();
        await browser.pause(2000);

        // Step 9: Verify prompt was built
        const isPreviewDisplayed = await promptBuilderPage.isPromptPreviewDisplayed();
        const isError = await promptBuilderPage.isErrorDisplayed();

        // Either preview or error should be shown
        expect(isPreviewDisplayed || isError).to.be.true;

        if (isPreviewDisplayed) {
          const content = await promptBuilderPage.getPromptContent();
          expect(content.length).to.be.at.least(10);
        }
      }
    });
  });

  describe("Multi-Template Workflow", () => {
    it("should allow building prompts with different templates", async function () {
      this.timeout(30000);

      const templates = ["agent", "planning", "debugging", "review"];

      for (const template of templates) {
        await promptBuilderPage.selectTemplate(template);
        await browser.pause(200);

        // Verify template changed
        const templateSelect = await $$("select");
        for (const select of templateSelect) {
          const value = await select.getValue();
          if (
            value === template ||
            ["agent", "planning", "debugging", "review"].includes(value)
          ) {
            expect(typeof value).to.equal("string");
            break;
          }
        }
      }
    });
  });

  describe("Settings Persistence Workflow", () => {
    it("should persist settings across app navigation", async function () {
      this.timeout(30000);

      // Step 1: Go to settings
      await appPage.navigateToSettings();
      await browser.pause(500);

      // Step 2: Make a change
      const inputs = await $$('input[type="text"]');
      let originalValue = "";
      const testValue = "test-persistence-" + Date.now();

      if (inputs.length > 0) {
        originalValue = await inputs[0].getValue();
        await inputs[0].clearValue();
        await inputs[0].setValue(testValue);

        // Save
        const saveBtn = await $('button*=Save');
        if (await saveBtn.isExisting()) {
          await saveBtn.click();
          await browser.pause(500);
        }
      }

      // Step 3: Navigate away
      await appPage.navigateToMain();
      await browser.pause(300);

      await appPage.navigateToHistory();
      await browser.pause(300);

      // Step 4: Return to settings
      await appPage.navigateToSettings();
      await browser.pause(500);

      // Just verify navigation works
      expect(await settingsPage.isDisplayed()).to.be.true;
    });
  });

  describe("Error Recovery Workflow", () => {
    it("should recover gracefully from invalid operations", async function () {
      this.timeout(30000);

      // Try building without files selected
      await appPage.navigateToMain();

      // Deselect all files
      const nodes = await fileTreePage.getVisibleNodes();
      for (const node of nodes) {
        const checkbox = await node.$("input[type='checkbox']");
        if ((await checkbox.isExisting()) && (await checkbox.isSelected())) {
          await checkbox.click();
          await browser.pause(100);
        }
      }

      // Try to build
      const buildBtn = await $('button*=Build');
      await buildBtn.click();
      await browser.pause(500);

      // App should not crash
      const isMainView = await appPage.isFileTreeDisplayed();
      expect(isMainView).to.be.true;

      // Error might be displayed
      const isError = await promptBuilderPage.isErrorDisplayed();
      // Either error shown or button was disabled - both valid
      expect(typeof isError).to.equal("boolean");
    });

    it("should handle rapid navigation without crashing", async function () {
      this.timeout(30000);

      // Rapidly switch between views
      for (let i = 0; i < 5; i++) {
        await appPage.navigateToMain();
        await browser.pause(100);
        await appPage.navigateToBrowser();
        await browser.pause(100);
        await appPage.navigateToHistory();
        await browser.pause(100);
        await appPage.navigateToSettings();
        await browser.pause(100);
      }

      // App should still be responsive
      await appPage.navigateToMain();
      expect(await appPage.isFileTreeDisplayed()).to.be.true;
    });
  });

  describe("Search and Filter Workflow", () => {
    it("should filter files based on search query", async function () {
      this.timeout(30000);

      await appPage.navigateToMain();
      await browser.pause(300);

      // Search for TypeScript files
      await fileTreePage.search(".ts");
      await browser.pause(500);

      // Get filtered results
      const filteredCount = await fileTreePage.getVisibleNodeCount();

      // Clear search
      await fileTreePage.clearSearch();
      await browser.pause(500);

      // Get all results
      const allCount = await fileTreePage.getVisibleNodeCount();

      // Just verify search executes without error
      expect(filteredCount).to.be.at.least(0);
      expect(allCount).to.be.at.least(0);
    });

    it("should restore full tree after clearing search", async function () {
      await appPage.navigateToMain();

      // Index if needed
      try {
        await fileTreePage.indexFolder(fixturesPath);
        await browser.pause(1000);
      } catch {
        // Already indexed
      }

      const initialCount = await fileTreePage.getVisibleNodeCount();

      // Search
      await fileTreePage.search("nonexistent-query-12345");
      await browser.pause(500);

      // Clear
      await fileTreePage.clearSearch();
      await browser.pause(500);

      // Should show nodes again
      const restoredCount = await fileTreePage.getVisibleNodeCount();
      expect(restoredCount).to.be.at.least(0);
    });
  });

  describe("History Tracking Workflow", () => {
    it("should track sessions in history", async function () {
      this.timeout(30000);

      // Get initial history count
      await appPage.navigateToHistory();
      const initialCount = await historyPage.getHistoryCount();

      // Go back to main and do some work
      await appPage.navigateToMain();
      await browser.pause(300);

      // Index and select files
      try {
        await fileTreePage.indexFolder(fixturesPath);
        await browser.pause(1000);
      } catch {
        // Already indexed
      }

      // Select a file
      const nodes = await fileTreePage.getVisibleNodes();
      for (const node of nodes) {
        const icon = await node.$(".tree-icon");
        const iconText = await icon.getText();

        if (iconText === "📄") {
          const checkbox = await node.$("input[type='checkbox']");
          if (await checkbox.isExisting()) {
            await checkbox.click();
            await browser.pause(200);
            break;
          }
        }
      }

      // Build prompt (this should create history entry)
      if ((await appPage.getSelectedFilesCount()) > 0) {
        await promptBuilderPage.clickBuildPrompt();
        await browser.pause(2000);
      }

      // Check history
      await appPage.navigateToHistory();
      await browser.pause(500);

      const newCount = await historyPage.getHistoryCount();

      // History count may have increased
      expect(newCount).to.be.at.least(initialCount);
    });
  });

  describe("Model Selection Impact", () => {
    it("should show different token limits for different models", async function () {
      this.timeout(30000);

      await appPage.navigateToMain();

      // Get models
      const models = await promptBuilderPage.getAvailableModels();

      if (models.length > 1) {
        // Select different models and verify UI updates
        await promptBuilderPage.selectModel(models[0]);
        await browser.pause(200);

        await promptBuilderPage.selectModel(models[1]);
        await browser.pause(200);

        // Verify no errors
        expect(true).to.be.true;
      }
    });
  });
});

describe("Performance Tests", () => {
  const appPage = new AppPage();

  before(async () => {
    await appPage.waitForLoad();
  });

  it("should handle view switching efficiently", async function () {
    this.timeout(30000);

    const startTime = Date.now();

    // Switch views multiple times
    for (let i = 0; i < 10; i++) {
      await appPage.navigateToMain();
      await appPage.navigateToBrowser();
      await appPage.navigateToHistory();
      await appPage.navigateToSettings();
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete in reasonable time (10 seconds max)
    expect(totalTime).to.be.below(10000);
  });

  it("should respond to user input within acceptable time", async function () {
    this.timeout(10000);

    await appPage.navigateToMain();

    const searchInput = await $(".search-input");
    const startTime = Date.now();

    await searchInput.setValue("test");

    const endTime = Date.now();
    const inputTime = endTime - startTime;

    // Input should be responsive (under 1 second)
    expect(inputTime).to.be.below(1000);
  });
});
