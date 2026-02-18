/**
 * Base Page Object for common operations
 */
export class BasePage {
  /**
   * Wait for the application to be ready
   * Checks for the root React element instead of title (more reliable in CI)
   */
  async waitForAppReady(timeout: number = 2000): Promise<void> {

    // First wait for any content to load
    await browser.waitUntil(
      async () => {
        try {
          // Check if the #root element exists and has children
          const rootExists = await browser.execute(() => {
            const root = document.getElementById("root");
            return root !== null && root.children.length > 0;
          });
          if (rootExists) {
            return true;
          }

          // Fallback: check for any app-related element
          const appContainer = await $('[data-testid="app-container"]');
          if (await appContainer.isExisting()) {
            return true;
          }

          // Another fallback: check for main element
          const mainEl = await $("main");
          if (await mainEl.isExisting()) {
            return true;
          }

          return false;
        } catch (e) {
          console.log("Error checking app readiness:", e);
          return false;
        }
      },
      {
        timeout,
        interval: 200,
        timeoutMsg: `Application did not load within ${timeout / 1000} seconds`,
      }
    );
  }

  async waitForTauriReady(timeout: number = 10000): Promise<void> {
    await browser.waitUntil(
      async () => {
        try {
          return await browser.execute(() => {
            const tauri = (window as any).__TAURI__;
            return !!tauri && !!tauri.core?.invoke && !!tauri.event?.emit;
          });
        } catch {
          return false;
        }
      },
      {
        timeout,
        interval: 200,
        timeoutMsg: `Tauri API was not available within ${timeout / 1000} seconds`,
      }
    );
  }

  /**
   * Wait for an element to be displayed
   */
  async waitForElement(
    selector: string,
    timeout: number = 5000
  ): Promise<WebdriverIO.Element> {
    const element = await $(selector);
    await element.waitForDisplayed({ timeout });
    return element;
  }

  /**
   * Wait for an element to be clickable
   */
  async waitForClickable(
    selector: string,
    timeout: number = 5000
  ): Promise<WebdriverIO.Element> {
    const element = await $(selector);
    await element.waitForClickable({ timeout });
    return element;
  }

  /**
   * Safe click with retry
   */
  async safeClick(selector: string, retries: number = 3): Promise<void> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const element = await this.waitForClickable(selector);
        await element.click();
        return;
      } catch (error) {
        lastError = error as Error;
        await browser.pause(100);
      }
    }

    throw lastError;
  }

  /**
   * Safe setValue with clear - handles webkit2gtk quirks
   */
  async safeSetValue(selector: string, value: string): Promise<void> {
    const element = await this.waitForElement(selector);
    try {
      await element.clearValue();
      if (value) {
        await element.setValue(value);
      }
    } catch {
      // Fallback for webkit2gtk "Missing text parameter" error
      await browser.execute((sel: string, val: string) => {
        const el = document.querySelector(sel) as HTMLTextAreaElement | HTMLInputElement;
        if (el) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(el, val);
          } else {
            el.value = val;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, selector, value);
    }
  }

  /**
   * Get text content of an element
   */
  async getText(selector: string): Promise<string> {
    const element = await this.waitForElement(selector);
    return element.getText();
  }

  /**
   * Check if element exists and is displayed
   */
  async isDisplayed(selector: string): Promise<boolean> {
    try {
      const element = await $(selector);
      return await element.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Wait for text to contain a specific value
   */
  async waitForTextContains(
    selector: string,
    text: string,
    timeout: number = 5000
  ): Promise<void> {
    await browser.waitUntil(
      async () => {
        const element = await $(selector);
        const actualText = await element.getText();
        return actualText.includes(text);
      },
      {
        timeout,
        timeoutMsg: `Element ${selector} did not contain text "${text}" within ${timeout}ms`,
      }
    );
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await browser.saveScreenshot(`./e2e/screenshots/${name}-${timestamp}.png`);
  }

  /**
   * Execute script in the browser context
   */
  async executeScript<T>(script: string | ((...args: any[]) => T), ...args: any[]): Promise<T> {
    return browser.execute(script, ...args);
  }

  /**
   * Wait for debounced UI updates without relying on browser.pause caps.
   */
  async waitForDebounce(ms: number = 300): Promise<void> {
    await browser.executeAsync((delay: number, done: (result: boolean) => void) => {
      setTimeout(() => done(true), delay);
    }, ms);
  }
}
