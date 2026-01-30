import { BasePage } from "./BasePage.js";
import { Selectors } from "../selectors.js";

/**
 * Page Object for Settings component
 */
export class SettingsPage extends BasePage {
  /**
   * Wait for settings page to be ready
   */
  async waitForReady(): Promise<void> {
    await browser.waitUntil(
      async () => {
        const heading = await $("h2");
        const text = await heading.getText();
        return text.includes("Settings");
      },
      {
        timeout: 10000,
        timeoutMsg: "Settings page did not load within 10 seconds",
      }
    );
  }

  /**
   * Check if settings page is displayed
   */
  async isDisplayed(): Promise<boolean> {
    try {
      const heading = await $("h2");
      const text = await heading.getText();
      return text.includes("Settings");
    } catch {
      return false;
    }
  }

  /**
   * Get excluded extensions
   */
  async getExcludedExtensions(): Promise<string> {
    try {
      const input = await $(Selectors.excludedExtensions);
      return await input.getValue();
    } catch {
      // Fallback: find input near "Excluded Extensions" label
      const labels = await $$("label");
      for (const label of labels) {
        const text = await label.getText();
        if (text.includes("Excluded")) {
          const input = await label.nextElement();
          if (input && (await input.getTagName()) === "input") {
            return await input.getValue();
          }
        }
      }
      return "";
    }
  }

  /**
   * Set excluded extensions
   */
  async setExcludedExtensions(extensions: string): Promise<void> {
    try {
      const input = await $(Selectors.excludedExtensions);
      await input.clearValue();
      await input.setValue(extensions);
    } catch {
      // Fallback
      const inputs = await $$("input");
      for (const input of inputs) {
        const placeholder = await input.getAttribute("placeholder");
        if (placeholder?.includes("extension") || placeholder?.includes("exclude")) {
          await input.clearValue();
          await input.setValue(extensions);
          return;
        }
      }
    }
  }

  /**
   * Get token limit setting
   */
  async getTokenLimit(): Promise<string> {
    try {
      const input = await $(Selectors.tokenLimitSetting);
      return await input.getValue();
    } catch {
      // Fallback
      const labels = await $$("label");
      for (const label of labels) {
        const text = await label.getText();
        if (text.includes("Token") && text.includes("Limit")) {
          const input = await label.nextElement();
          if (input) {
            return await input.getValue();
          }
        }
      }
      return "";
    }
  }

  /**
   * Set token limit
   */
  async setTokenLimit(limit: string): Promise<void> {
    try {
      const input = await $(Selectors.tokenLimitSetting);
      await input.clearValue();
      await input.setValue(limit);
    } catch {
      // Fallback
      const inputs = await $$('input[type="number"]');
      for (const input of inputs) {
        await input.clearValue();
        await input.setValue(limit);
        return;
      }
    }
  }

  /**
   * Click Save Settings button
   */
  async clickSaveSettings(): Promise<void> {
    try {
      await this.safeClick(Selectors.saveSettingsBtn);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Save")) {
          await button.click();
          return;
        }
      }
    }
    await browser.pause(500);
  }

  /**
   * Click Reset Settings button
   */
  async clickResetSettings(): Promise<void> {
    try {
      await this.safeClick(Selectors.resetSettingsBtn);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Reset")) {
          await button.click();
          return;
        }
      }
    }
    await browser.pause(500);
  }

  /**
   * Click Export Settings button
   */
  async clickExportSettings(): Promise<void> {
    try {
      await this.safeClick(Selectors.exportSettingsBtn);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Export")) {
          await button.click();
          return;
        }
      }
    }
  }

  /**
   * Click Import Settings button
   */
  async clickImportSettings(): Promise<void> {
    try {
      await this.safeClick(Selectors.importSettingsBtn);
    } catch {
      const buttons = await $$("button");
      for (const button of buttons) {
        const text = await button.getText();
        if (text.includes("Import")) {
          await button.click();
          return;
        }
      }
    }
  }

  /**
   * Get all settings as an object
   */
  async getAllSettings(): Promise<{ excludedExtensions: string; tokenLimit: string }> {
    const excludedExtensions = await this.getExcludedExtensions();
    const tokenLimit = await this.getTokenLimit();

    return {
      excludedExtensions,
      tokenLimit,
    };
  }

  /**
   * Check if a success message is displayed
   */
  async isSuccessMessageDisplayed(): Promise<boolean> {
    const alerts = await $$('div[style*="green"], div[style*="success"]');
    for (const alert of alerts) {
      if (await alert.isDisplayed()) {
        return true;
      }
    }
    return false;
  }
}
