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
        const container = await $(Selectors.settingsContainer);
        if (!(await container.isExisting())) {
          return false;
        }
        const heading = await $("h2");
        if (!(await heading.isExisting())) {
          return false;
        }
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
      const container = await $(Selectors.settingsContainer);
      if (!(await container.isExisting())) {
        return false;
      }
      const heading = await $("h2");
      const text = await heading.getText();
      return text.includes("Settings");
    } catch {
      return false;
    }
  }

  private async setCheckboxState(selector: string, desiredState: boolean): Promise<void> {
    const checkbox = await $(selector);
    await checkbox.waitForExist({ timeout: 5000 });

    const isChecked = await checkbox.isSelected();
    if (isChecked === desiredState) {
      return;
    }

    const clicked = await browser.execute((sel: string) => {
      const input = document.querySelector(sel) as HTMLInputElement | null;
      if (!input) {
        return false;
      }

      const label = input.closest("label") as HTMLElement | null;
      if (label) {
        label.click();
        return true;
      }

      input.click();
      return true;
    }, selector);

    if (!clicked) {
      throw new Error(`Unable to click checkbox or label for selector: ${selector}`);
    }

    await browser.waitUntil(
      async () => (await checkbox.isSelected()) === desiredState,
      {
        timeout: 3000,
        interval: 100,
        timeoutMsg: `Checkbox state did not update for selector: ${selector}`,
      }
    );
  }

  async setSensitiveProtectionEnabled(enabled: boolean): Promise<void> {
    await this.setCheckboxState(Selectors.sensitiveFeatureToggle, enabled);
    await browser.pause(200);
  }

  async isSensitiveProtectionEnabled(): Promise<boolean> {
    const checkbox = await $(Selectors.sensitiveFeatureToggle);
    if (!(await checkbox.isExisting())) {
      return false;
    }
    return checkbox.isSelected();
  }

  async setPreventSelectionEnabled(enabled: boolean): Promise<void> {
    const checkbox = await $(Selectors.sensitivePreventSelectionToggle);
    await checkbox.waitForExist({ timeout: 5000 });
    await this.setCheckboxState(Selectors.sensitivePreventSelectionToggle, enabled);
    await browser.pause(200);
  }

  async isPreventSelectionEnabled(): Promise<boolean> {
    const checkbox = await $(Selectors.sensitivePreventSelectionToggle);
    if (!(await checkbox.isExisting())) {
      return false;
    }
    return checkbox.isSelected();
  }

  async openAddCustomPatternForm(): Promise<void> {
    const form = await $(Selectors.sensitiveCustomForm);
    if (await form.isExisting()) {
      return;
    }

    await this.safeClick(Selectors.sensitiveAddCustomBtn);
    await (await $(Selectors.sensitiveCustomForm)).waitForExist({ timeout: 5000 });
  }

  async addCustomSensitivePattern(pattern: {
    name: string;
    regex: string;
    placeholder: string;
    testInput: string;
  }): Promise<void> {
    await this.openAddCustomPatternForm();

    await this.safeSetValue(Selectors.sensitivePatternNameInput, pattern.name);
    await this.safeSetValue(Selectors.sensitivePatternRegexInput, pattern.regex);
    await this.safeSetValue(Selectors.sensitivePatternPlaceholderInput, pattern.placeholder);
    await this.safeSetValue(Selectors.sensitivePatternTestInput, pattern.testInput);

    await this.safeClick(Selectors.sensitivePatternTestBtn);
    await (await $(Selectors.sensitivePatternTestResults)).waitForExist({ timeout: 5000 });

    await this.safeClick(Selectors.sensitivePatternSaveBtn);
    await browser.pause(500);
  }

  private async findPatternRowByName(patternName: string): Promise<WebdriverIO.Element | null> {
    const escapedName = patternName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const directSelector = `${Selectors.sensitivePatternRow}[data-pattern-name="${escapedName}"]`;
    const directMatch = await $(directSelector);
    if (await directMatch.isExisting()) {
      return directMatch;
    }

    const rows = await $$(Selectors.sensitivePatternRow);
    for (const row of rows) {
      const attrName = await row.getAttribute("data-pattern-name");
      if (attrName === patternName) {
        return row;
      }
      const text = await row.getText();
      if (text.includes(patternName)) {
        return row;
      }
    }
    return null;
  }

  async isPatternEnabled(patternName: string): Promise<boolean> {
    const escapedName = patternName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const directSelector = `${Selectors.sensitivePatternRow}[data-pattern-name="${escapedName}"]`;

    await browser.waitUntil(
      async () => {
        const rows = await $$(directSelector);
        return rows.length > 0;
      },
      {
        timeout: 8000,
        interval: 200,
      }
    );

    const rows = await $$(directSelector);
    if (rows.length === 0) {
      return false;
    }

    for (const row of rows) {
      const toggle = await row.$(Selectors.sensitivePatternToggle);
      if (!(await toggle.isExisting())) {
        continue;
      }

      const checked = await browser.execute((element) => {
        const input = element as HTMLInputElement;
        return !!input.checked;
      }, toggle);

      if (checked) {
        return true;
      }
    }

    return false;
  }

  async deleteCustomPatternByName(patternName: string): Promise<boolean> {
    const row = await this.findPatternRowByName(patternName);
    if (!row) {
      return false;
    }

    const deleteBtn = await row.$('[data-testid="sensitive-pattern-delete-btn"]');
    if (!(await deleteBtn.isExisting())) {
      return false;
    }

    await deleteBtn.click();
    await browser.pause(300);
    return true;
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
