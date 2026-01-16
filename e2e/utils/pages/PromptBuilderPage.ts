import { BasePage } from "./BasePage.js";
import { Selectors, FallbackSelectors } from "../selectors.js";

/**
 * Page Object for Prompt Builder component
 */
export class PromptBuilderPage extends BasePage {
  /**
   * Wait for prompt builder to be ready
   */
  async waitForReady(): Promise<void> {
    await browser.waitUntil(
      async () => {
        const builderTitle = await $("h2");
        const text = await builderTitle.getText();
        return text.includes("Prompt Builder");
      },
      {
        timeout: 10000,
        timeoutMsg: "Prompt Builder did not load within 10 seconds",
      }
    );
  }

  /**
   * Select a template by ID
   */
  async selectTemplate(templateId: string): Promise<void> {
    try {
      const select = await $(Selectors.templateSelect);
      await select.selectByAttribute("value", templateId);
    } catch {
      // Fallback: find the select near the "Select Template" label
      const selects = await $$("select");
      for (const select of selects) {
        const options = await select.$$("option");
        for (const option of options) {
          const value = await option.getAttribute("value");
          if (value === templateId) {
            await select.selectByAttribute("value", templateId);
            return;
          }
        }
      }
    }
  }

  /**
   * Get available templates
   */
  async getAvailableTemplates(): Promise<string[]> {
    const templates: string[] = [];
    const selects = await $$("select");

    for (const select of selects) {
      const options = await select.$$("option");
      // Check if this is the template select by looking at option values
      const firstValue = await options[0]?.getAttribute("value");
      if (firstValue && ["agent", "planning", "debugging", "review", "documentation", "testing"].includes(firstValue)) {
        for (const option of options) {
          templates.push(await option.getAttribute("value") || "");
        }
        break;
      }
    }

    return templates;
  }

  /**
   * Select a model by name
   */
  async selectModel(modelName: string): Promise<void> {
    try {
      const select = await $(Selectors.modelSelect);
      await select.selectByAttribute("value", modelName);
    } catch {
      // Fallback: find model select
      const selects = await $$("select");
      for (const select of selects) {
        const options = await select.$$("option");
        for (const option of options) {
          const value = await option.getAttribute("value");
          if (value === modelName) {
            await select.selectByAttribute("value", modelName);
            return;
          }
        }
      }
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    const models: string[] = [];
    const selects = await $$("select");

    for (const select of selects) {
      const options = await select.$$("option");
      const firstValue = await options[0]?.getAttribute("value");
      if (firstValue && firstValue.includes("gpt")) {
        for (const option of options) {
          models.push(await option.getAttribute("value") || "");
        }
        break;
      }
    }

    return models;
  }

  /**
   * Set custom instructions
   */
  async setCustomInstructions(instructions: string): Promise<void> {
    try {
      await this.safeSetValue(Selectors.customInstructions, instructions);
    } catch {
      const textarea = await $('textarea[placeholder*="specific instructions"]');
      await textarea.clearValue();
      await textarea.setValue(instructions);
    }
  }

  /**
   * Get custom instructions value
   */
  async getCustomInstructions(): Promise<string> {
    try {
      const textarea = await $(Selectors.customInstructions);
      return await textarea.getValue();
    } catch {
      const textarea = await $('textarea[placeholder*="specific instructions"]');
      return await textarea.getValue();
    }
  }

  /**
   * Get selected files count displayed in the builder
   */
  async getSelectedFilesCount(): Promise<number> {
    const infoDiv = await $('div:has-text("Selected Files:")');
    const text = await infoDiv.getText();
    const match = text.match(/Selected Files:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Click Build & Copy button
   */
  async clickBuildPrompt(): Promise<void> {
    try {
      await this.safeClick(Selectors.buildPromptBtn);
    } catch {
      // Fallback: find button by text
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Build") && text.includes("Clipboard")) {
          await button.click();
          return;
        }
      }
    }
    // Wait for prompt building
    await browser.pause(1000);
  }

  /**
   * Wait for prompt to be built
   */
  async waitForPromptBuilt(timeout: number = 30000): Promise<void> {
    await browser.waitUntil(
      async () => {
        return await this.isPromptPreviewDisplayed();
      },
      {
        timeout,
        timeoutMsg: `Prompt was not built within ${timeout}ms`,
      }
    );
  }

  /**
   * Check if build button is enabled
   */
  async isBuildButtonEnabled(): Promise<boolean> {
    try {
      const button = await $(Selectors.buildPromptBtn);
      return !(await button.getAttribute("disabled"));
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Build")) {
          return !(await button.getAttribute("disabled"));
        }
      }
      return false;
    }
  }

  /**
   * Check if error is displayed
   */
  async isErrorDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.errorDisplay);
    } catch {
      // Check for error div with red background
      const errorDiv = await $('div[style*="ffebee"]');
      return await errorDiv.isExisting();
    }
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    try {
      const errorDiv = await $(Selectors.errorDisplay);
      return await errorDiv.getText();
    } catch {
      const errorDiv = await $('div[style*="ffebee"]');
      if (await errorDiv.isExisting()) {
        return await errorDiv.getText();
      }
      return "";
    }
  }

  /**
   * Check if prompt preview is displayed
   */
  async isPromptPreviewDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.promptPreview);
    } catch {
      // Check for "Prompt Preview:" heading
      const heading = await $("h3");
      const text = await heading.getText();
      return text.includes("Prompt Preview");
    }
  }

  /**
   * Get the built prompt content
   */
  async getPromptContent(): Promise<string> {
    try {
      const preview = await $(Selectors.promptPreview);
      return await preview.getText();
    } catch {
      // Fallback: find the prompt preview div
      const previewDivs = await $$("div");
      for (const div of previewDivs) {
        const style = await div.getAttribute("style");
        if (style?.includes("monospace") && style?.includes("pre-wrap")) {
          return await div.getText();
        }
      }
      return "";
    }
  }

  /**
   * Click Copy to Clipboard button (when prompt is built)
   */
  async clickCopyToClipboard(): Promise<void> {
    try {
      await this.safeClick(Selectors.copyToClipboardBtn);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Copy to Clipboard")) {
          await button.click();
          return;
        }
      }
    }
  }

  /**
   * Get token count from token counter
   */
  async getTokenCount(): Promise<number> {
    try {
      const counter = await $(Selectors.tokenCount);
      const text = await counter.getText();
      const match = text.match(/(\d+[\d,]*)/);
      return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
    } catch {
      // Fallback: find token count text
      const spans = await $$("span");
      for (const span of spans) {
        const text = await span.getText();
        if (text.includes("tokens")) {
          const match = text.match(/(\d+[\d,]*)/);
          if (match) {
            return parseInt(match[1].replace(/,/g, ""), 10);
          }
        }
      }
      return 0;
    }
  }

  /**
   * Check if token warning is displayed
   */
  async isTokenWarningDisplayed(): Promise<boolean> {
    try {
      return await this.isDisplayed(Selectors.tokenWarning);
    } catch {
      // Check for warning indicators
      const warning = await $('div[style*="warning"], div[style*="yellow"], div[style*="orange"]');
      return await warning.isExisting();
    }
  }

  /**
   * Build prompt and get the result
   */
  async buildPromptAndGetContent(): Promise<string> {
    await this.clickBuildPrompt();
    await this.waitForPromptBuilt();
    return await this.getPromptContent();
  }
}
