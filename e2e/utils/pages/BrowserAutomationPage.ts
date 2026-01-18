import { BasePage } from "./BasePage.js";
import { Selectors } from "../selectors.js";

/**
 * Page Object for Browser Automation component
 */
export class BrowserAutomationPage extends BasePage {
  /**
   * Wait for browser automation page to be ready
   */
  async waitForReady(): Promise<void> {
    await browser.waitUntil(
      async () => {
        const heading = await $("h2");
        const text = await heading.getText();
        return text.includes("Browser") || text.includes("Automation");
      },
      {
        timeout: 10000,
        timeoutMsg: "Browser automation page did not load within 10 seconds",
      }
    );
  }

  /**
   * Check if browser automation page is displayed
   */
  async isDisplayed(): Promise<boolean> {
    try {
      const heading = await $("h2");
      const text = await heading.getText();
      return text.includes("Browser") || text.includes("Automation");
    } catch {
      return false;
    }
  }

  /**
   * Get available AI interfaces
   */
  async getAvailableInterfaces(): Promise<string[]> {
    const interfaces: string[] = [];

    try {
      const select = await $(Selectors.interfaceSelect);
      const options = await select.$$("option");

      for (const option of options) {
        const value = await option.getAttribute("value");
        if (value) {
          interfaces.push(value);
        }
      }
    } catch {
      // Fallback: find select with AI interface options
      const selects = await $$("select");
      for (const select of selects) {
        const options = await select.$$("option");
        for (const option of options) {
          const text = await option.getText();
          if (
            text.toLowerCase().includes("chatgpt") ||
            text.toLowerCase().includes("claude") ||
            text.toLowerCase().includes("gemini")
          ) {
            for (const opt of options) {
              interfaces.push((await opt.getAttribute("value")) || "");
            }
            return interfaces;
          }
        }
      }
    }

    return interfaces;
  }

  /**
   * Select an AI interface
   */
  async selectInterface(interfaceName: string): Promise<void> {
    try {
      const select = await $(Selectors.interfaceSelect);
      await select.selectByAttribute("value", interfaceName);
    } catch {
      // Fallback
      const selects = await $$("select");
      for (const select of selects) {
        const options = await select.$$("option");
        for (const option of options) {
          const value = await option.getAttribute("value");
          if (value?.toLowerCase().includes(interfaceName.toLowerCase())) {
            await select.selectByAttribute("value", value);
            return;
          }
        }
      }
    }
  }

  /**
   * Get currently selected interface
   */
  async getSelectedInterface(): Promise<string> {
    try {
      const select = await $(Selectors.interfaceSelect);
      const value = await select.getValue();
      return value;
    } catch {
      return "";
    }
  }

  /**
   * Set prompt text
   */
  async setPromptText(text: string): Promise<void> {
    try {
      const textarea = await $(Selectors.promptTextarea);
      await textarea.clearValue();
      await textarea.setValue(text);
    } catch {
      // Fallback
      const textareas = await $$("textarea");
      for (const textarea of textareas) {
        const placeholder = await textarea.getAttribute("placeholder");
        if (placeholder?.toLowerCase().includes("prompt") || placeholder?.toLowerCase().includes("paste")) {
          await textarea.clearValue();
          await textarea.setValue(text);
          return;
        }
      }
      // If no matching placeholder, use the first textarea
      if (textareas.length > 0) {
        await textareas[0].clearValue();
        await textareas[0].setValue(text);
      }
    }
  }

  /**
   * Get prompt text
   */
  async getPromptText(): Promise<string> {
    try {
      const textarea = await $(Selectors.promptTextarea);
      return await textarea.getValue();
    } catch {
      const textareas = await $$("textarea");
      if (textareas.length > 0) {
        return await textareas[0].getValue();
      }
      return "";
    }
  }

  /**
   * Set custom URL
   */
  async setCustomUrl(url: string): Promise<void> {
    try {
      const input = await $(Selectors.customUrlInput);
      await input.clearValue();
      await input.setValue(url);
    } catch {
      // Fallback
      const inputs = await $$('input[type="text"], input[type="url"]');
      for (const input of inputs) {
        const placeholder = await input.getAttribute("placeholder");
        if (placeholder?.toLowerCase().includes("url") || placeholder?.toLowerCase().includes("custom")) {
          await input.clearValue();
          await input.setValue(url);
          return;
        }
      }
    }
  }

  /**
   * Get custom URL value
   */
  async getCustomUrl(): Promise<string> {
    try {
      const input = await $(Selectors.customUrlInput);
      return await input.getValue();
    } catch {
      return "";
    }
  }

  /**
   * Click Launch Browser button
   */
  async clickLaunchBrowser(): Promise<void> {
    try {
      await this.safeClick(Selectors.launchBrowserBtn);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Launch") || text.includes("Open") || text.includes("Start")) {
          await button.click();
          return;
        }
      }
    }
  }

  /**
   * Check if launch button is enabled
   */
  async isLaunchButtonEnabled(): Promise<boolean> {
    try {
      const button = await $(Selectors.launchBrowserBtn);
      return !(await button.getAttribute("disabled"));
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Launch")) {
          return !(await button.getAttribute("disabled"));
        }
      }
      return false;
    }
  }

  /**
   * Get status message (if any)
   */
  async getStatusMessage(): Promise<string> {
    try {
      const statusDiv = await $(".status-message, [data-testid='status-message']");
      if (await statusDiv.isExisting()) {
        return await statusDiv.getText();
      }
    } catch {
      // Check for any status indicators
      const divs = await $$("div");
      for (const div of divs) {
        const text = await div.getText();
        if (
          text.includes("Launching") ||
          text.includes("Connecting") ||
          text.includes("Success") ||
          text.includes("Error")
        ) {
          return text;
        }
      }
    }
    return "";
  }

  /**
   * Fill form and launch browser
   */
  async launchWithPrompt(
    interfaceName: string,
    promptText: string,
    customUrl?: string
  ): Promise<void> {
    await this.selectInterface(interfaceName);
    await this.setPromptText(promptText);

    if (customUrl) {
      await this.setCustomUrl(customUrl);
    }

    await this.clickLaunchBrowser();
  }
}
