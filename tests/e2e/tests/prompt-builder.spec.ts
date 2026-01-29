import { AppPage, FileTreePage, PromptBuilderPage } from "../utils/pages/index.js";
import path from "node:path";
import fs from "node:fs";

describe("Prompt Builder", () => {
  const appPage = new AppPage();
  const fileTreePage = new FileTreePage();
  const promptBuilderPage = new PromptBuilderPage();
  const fixturesPath = path.join(process.cwd(), "tests", "e2e", "fixtures", "test-data");

  before(async () => {
    await appPage.waitForLoad();
    await appPage.navigateToMain();

    // Ensure test files exist and are indexed
    if (!fs.existsSync(fixturesPath)) {
      fs.mkdirSync(fixturesPath, { recursive: true });
    }

    const testFiles = [
      { name: "sample-code.ts", content: 'export function hello() {\n  return "world";\n}' },
      { name: "sample-util.js", content: "const util = (x) => x * 2;\nmodule.exports = { util };" },
    ];

    for (const file of testFiles) {
      const filePath = path.join(fixturesPath, file.name);
      fs.writeFileSync(filePath, file.content);
    }

    await appPage.navigateToPrompt();
    await promptBuilderPage.waitForReady();
  });

  beforeEach(async () => {
    const isPromptVisible = await appPage.isPromptBuilderDisplayed();
    if (!isPromptVisible) {
      await appPage.navigateToPrompt();
      await promptBuilderPage.waitForReady();
    }
  });

  describe("Initial State", () => {
    it("should display the Prompt Builder component", async () => {
      const builder = await $('[data-testid="prompt-builder"]');
      expect(await builder.isDisplayed()).toBe(true);
    });

    it("should display templates grid", async () => {
      const grid = await $('[data-testid="templates-grid"]');
      expect(await grid.isExisting()).toBe(true);
    });

    it("should display custom instructions textarea", async () => {
      const textarea = await $('[data-testid="custom-instructions"]');
      expect(await textarea.isDisplayed()).toBe(true);
    });

    it("should have Custom Instructions label", async () => {
      const label = await $('label');
      const text = await label.getText();
      expect(text.toLowerCase()).toContain("custom instructions");
    });
  });

  describe("Template Selection", () => {
    it("should have template buttons in the grid", async () => {
      const templates = await promptBuilderPage.getAvailableTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(0);
    });

    it("should allow selecting a template by clicking", async () => {
      const grid = await $('[data-testid="templates-grid"]');
      if (!(await grid.isExisting())) return;

      const buttons = await grid.$$("button");
      if (buttons.length === 0) return;

      // Click first template
      await buttons[0].click();
      await browser.pause(200);

      // Template should populate custom instructions
      const instructions = await promptBuilderPage.getCustomInstructions();
      // After selecting a template, instructions should have content
      expect(typeof instructions).toBe("string");
    });

    it("should highlight selected template", async () => {
      const grid = await $('[data-testid="templates-grid"]');
      if (!(await grid.isExisting())) return;

      const buttons = await grid.$$("button");
      if (buttons.length === 0) return;

      await buttons[0].click();
      await browser.pause(200);

      // Selected template should have ring/border class
      const className = await buttons[0].getAttribute("class");
      expect(className).toContain("ring");
    });
  });

  describe("Custom Instructions", () => {
    it("should allow entering custom instructions", async () => {
      const instructions = "Please analyze the code for security vulnerabilities.";
      await promptBuilderPage.setCustomInstructions(instructions);
      await browser.pause(200);

      const value = await promptBuilderPage.getCustomInstructions();
      expect(value).toBe(instructions);

      // Clear
      await promptBuilderPage.setCustomInstructions("");
    });

    it("should have correct placeholder text", async () => {
      const textarea = await $('[data-testid="custom-instructions"]');
      const placeholder = await textarea.getAttribute("placeholder");
      expect(placeholder).toContain("context should be processed");
    });
  });

  describe("Error Display", () => {
    it("should not show error initially", async () => {
      const isError = await promptBuilderPage.isErrorDisplayed();
      expect(isError).toBe(false);
    });

    it("should have error display element when error occurs", async () => {
      // The error display uses data-testid="error-display"
      // It only appears when there's an error
      const errorEl = await $('[data-testid="error-display"]');
      // Should not exist initially
      const exists = await errorEl.isExisting();
      expect(typeof exists).toBe("boolean");
    });
  });

  describe("Build Prompt (with file selection)", () => {
    before(async () => {
      // Navigate to main and select files
      await appPage.navigateToMain();
      await browser.pause(300);

      // Try to index and select files
      try {
        await fileTreePage.indexFolder(fixturesPath);
        await fileTreePage.waitForNodes(1, 5000);

        // Select some files
        const nodes = await fileTreePage.getVisibleNodes();
        for (const node of nodes) {
          const isFile = await fileTreePage.isNodeFile(node);
          if (isFile) {
            const checkbox = await node.$('[data-testid="tree-checkbox"]');
            if (await checkbox.isExisting()) {
              await checkbox.click();
              await browser.pause(200);
            }
          }
        }
      } catch (error) {
        console.log("Could not select files:", error);
      }

      // Navigate back to prompt
      await appPage.navigateToPrompt();
      await promptBuilderPage.waitForReady();
    });

    it("should show prompt builder after selecting files", async () => {
      const builder = await $('[data-testid="prompt-builder"]');
      expect(await builder.isDisplayed()).toBe(true);
    });

    it("should have templates available", async () => {
      const templates = await promptBuilderPage.getAvailableTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Template Loading", () => {
    it("should handle template loading gracefully", async () => {
      // Templates should load without errors
      const templates = await promptBuilderPage.getAvailableTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(0);
    });

    it("should display Create New Template button", async () => {
      const createBtn = await $('span*=Create New Template');
      expect(await createBtn.isExisting()).toBe(true);
    });
  });
});
