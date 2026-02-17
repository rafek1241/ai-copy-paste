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
        try {
          const builder = await $(Selectors.promptBuilder);
          return await builder.isDisplayed();
        } catch {
          return false;
        }
      },
      {
        timeout: 5000,
        timeoutMsg: "Prompt Builder did not load within 5 seconds",
      }
    );
  }

  /**
   * Select a template by clicking its button in the templates grid
   */
  async selectTemplate(templateId: string): Promise<void> {
    const grid = await $('[data-testid="templates-grid"]');
    if (await grid.isExisting()) {
      const buttons = await grid.$$("button");
      for (const button of buttons) {
        const text = (await button.getText()).toLowerCase();
        if (text.includes(templateId)) {
          await button.click();
          return;
        }
      }
    }
  }

  /**
   * Get available template names from the templates grid
   */
  async getAvailableTemplates(): Promise<string[]> {
    const templates: string[] = [];
    const grid = await $('[data-testid="templates-grid"]');
    if (await grid.isExisting()) {
      const buttons = await grid.$$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.trim()) {
          templates.push(text.trim().split("\n")[0].toLowerCase());
        }
      }
    }
    return templates;
  }

  /**
   * Select a model (no-op: model selector not present in current component)
   */
  async selectModel(_modelName: string): Promise<void> {
    // Model selection is not available in the current PromptBuilder component
  }

  /**
   * Get available models (empty: model selector not present)
   */
  async getAvailableModels(): Promise<string[]> {
    return [];
  }

  /**
   * Set custom instructions
   */
  async setCustomInstructions(instructions: string): Promise<void> {
    try {
      await this.safeSetValue(Selectors.customInstructions, instructions);
    } catch {
      // Fallback: set value directly via DOM for webkit2gtk
      await browser.execute((val: string) => {
        const el = document.querySelector('[data-testid="custom-instructions"]') as HTMLTextAreaElement;
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, instructions);
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
      const textarea = await $('[data-testid="prompt-builder"] textarea');
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
    await browser.waitUntil(
      async () => await this.isBuildButtonEnabled(),
      {
        timeout: 8000,
        interval: 200,
        timeoutMsg: "Copy Context button was not enabled in time",
      }
    );

    try {
      await this.safeClick(Selectors.buildPromptBtn);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = (await button.getText()).toLowerCase();
        if (text.includes("copy context")) {
          const disabled = await button.getAttribute("disabled");
          if (!disabled) {
            await button.click();
            return;
          }
        }
      }

      throw new Error("Unable to click Copy Context button");
    }

    await browser.pause(500);
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
      if (!(await button.isExisting())) {
        return false;
      }

      const disabledAttr = await button.getAttribute("disabled");
      const ariaDisabled = await button.getAttribute("aria-disabled");
      return !disabledAttr && ariaDisabled !== "true";
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = (await button.getText()).toLowerCase();
        if (text.includes("copy context")) {
          const disabledAttr = await button.getAttribute("disabled");
          const ariaDisabled = await button.getAttribute("aria-disabled");
          return !disabledAttr && ariaDisabled !== "true";
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
