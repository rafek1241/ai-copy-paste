import { AppPage, FileTreePage, SettingsPage } from "../utils/pages/index.js";
import path from "node:path";

type PatternRecord = {
  id: string;
  name: string;
  builtin: boolean;
  enabled: boolean;
};

type BuildPromptResponse = {
  prompt: string;
};

describe("Sensitive Data Protection", () => {
  const appPage = new AppPage();
  const fileTreePage = new FileTreePage();
  const settingsPage = new SettingsPage();

  const fixturesBase = path.join(process.cwd(), "tests", "e2e", "fixtures", "test-data");
  const sensitiveTestPath = path.join(fixturesBase, "sensitive-test");
  const sensitiveExampleDirPath = path.join(sensitiveTestPath, "example-dir");

  const envFilePath = path.join(sensitiveTestPath, ".env").replace(/\\/g, "/");
  const safeCodePath = path.join(sensitiveTestPath, "safe-code.ts").replace(/\\/g, "/");
  const exampleSafePath = path.join(sensitiveExampleDirPath, "safe-example.ts").replace(/\\/g, "/");
  const exampleSensitivePath = path.join(sensitiveExampleDirPath, "sensitive-example.ts").replace(/\\/g, "/");
  const customRulePath = path.join(sensitiveExampleDirPath, "custom-rule.ts").replace(/\\/g, "/");

  const customPatternName = "Custom Rule Marker";
  const customPatternRegex = "CUSTOM_MARKER_[A-Z0-9]+";
  const customPatternPlaceholder = "[CUSTOM_RULE_ALIAS]";
  const customPatternInputSample = "token=CUSTOM_MARKER_ABC123XYZ";

  async function resetSensitiveSettings(): Promise<void> {
    await browser.execute(async () => {
      const tauri = (window as any).__TAURI__;
      if (!tauri?.core?.invoke) {
        return;
      }

      const keysToClear = [
        "sensitive_data_enabled",
        "sensitive_prevent_selection",
        "sensitive_custom_patterns",
        "sensitive_builtin_overrides",
      ];

      for (const key of keysToClear) {
        try {
          await tauri.core.invoke("delete_setting", { key });
        } catch {
          // Ignore missing key failures
        }
      }

      if (tauri?.event?.emit) {
        await tauri.event.emit("sensitive-settings-changed");
      }
    });
  }

  async function expandSensitiveFixtureFolders(): Promise<void> {
    await fileTreePage.waitForReady();

    const sensitiveRoot = await fileTreePage.findNodeByName("sensitive-test");
    expect(sensitiveRoot).toBeTruthy();

    await fileTreePage.expandFolderIfCollapsed("sensitive-test");
    await browser.pause(400);

    const exampleDir = await fileTreePage.findNodeByName("example-dir");
    expect(exampleDir).toBeTruthy();

    await fileTreePage.expandFolderIfCollapsed("example-dir");
    await browser.pause(400);
  }

  async function clearAndIndexSensitiveFolder(): Promise<void> {
    await appPage.navigateToMain();
    await fileTreePage.waitForReady();

    await appPage.clearContext();
    await browser.pause(500);

    await fileTreePage.indexFolder(sensitiveTestPath);
    await fileTreePage.refresh();
    await browser.pause(800);

    await expandSensitiveFixtureFolders();
  }

  async function getContextFromClipboardOrFallback(candidatePaths: string[]): Promise<string> {
    await appPage.clickCopyContext();

    const clipboardText = await appPage.getClipboardText();
    if (clipboardText && clipboardText.trim().length > 0) {
      return clipboardText;
    }

    const selectedPaths: string[] = [];
    for (const filePath of candidatePaths) {
      const fileName = path.basename(filePath);
      if (await fileTreePage.isNodeSelected(fileName)) {
        selectedPaths.push(filePath);
      }
    }

    if (selectedPaths.length === 0) {
      return "";
    }

    return browser.execute(async (filePaths: string[]) => {
      const tauri = (window as any).__TAURI__;
      if (!tauri?.core?.invoke) {
        return "";
      }

      const response = await tauri.core.invoke("build_prompt_from_files", {
        request: {
          template_id: "custom",
          custom_instructions: "---CONTEXT:\n\n{{files}}",
          file_paths: filePaths,
        },
      });

      return (response as BuildPromptResponse).prompt || "";
    }, selectedPaths);
  }

  function toCanonicalPath(inputPath: string): string {
    const normalized = inputPath.replace(/\\/g, "/");

    if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith("//")) {
      return normalized.toLowerCase();
    }

    return normalized;
  }

  async function waitForPatternEnabledInBackend(
    patternName: string,
    expected: boolean,
    timeout: number = 15000
  ): Promise<void> {
    await browser.waitUntil(
      async () => {
        return browser.execute(async (name: string, expectedState: boolean) => {
          const tauri = (window as any).__TAURI__;
          if (!tauri?.core?.invoke) {
            return false;
          }

          const patterns = (await tauri.core.invoke("get_sensitive_patterns")) as PatternRecord[];
          const matchingPatterns = patterns.filter((pattern) => pattern.name === name);
          if (matchingPatterns.length === 0) {
            return false;
          }

          const hasExpected = matchingPatterns.some((pattern) => !!pattern.enabled === expectedState);
          return hasExpected;
        }, patternName, expected);
      },
      {
        timeout,
        interval: 200,
        timeoutMsg: `Pattern \"${patternName}\" did not reach enabled=${expected}`,
      }
    );
  }

  async function waitForMarkedPathInBackend(
    filePath: string,
    expected: boolean,
    timeout: number = 15000
  ): Promise<void> {
    const canonicalTarget = toCanonicalPath(filePath);

    await browser.waitUntil(
      async () => {
        return browser.execute(async (targetPath: string, expectedState: boolean) => {
          const tauri = (window as any).__TAURI__;
          if (!tauri?.core?.invoke) {
            return false;
          }

          const marked = (await tauri.core.invoke("get_sensitive_marked_paths", {
            paths: [targetPath],
          })) as string[];

          const canonicalMarked = marked.map((path) => {
            const normalized = path.replace(/\\/g, "/");
            if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith("//")) {
              return normalized.toLowerCase();
            }
            return normalized;
          });

          const isMarked = canonicalMarked.includes(targetPath);
          return isMarked === expectedState;
        }, canonicalTarget, expected);
      },
      {
        timeout,
        interval: 200,
        timeoutMsg: `Backend mark for \"${filePath}\" did not become ${expected}`,
      }
    );
  }

  async function emitSensitiveSettingsChanged(): Promise<void> {
    await browser.execute(async () => {
      const tauri = (window as any).__TAURI__;
      if (!tauri?.event?.emit) {
        return;
      }

      await tauri.event.emit("sensitive-settings-changed");
    });
  }

  before(async function () {
    this.timeout(60000);
    await appPage.waitForLoad();
    await appPage.navigateToMain();
    await resetSensitiveSettings();
  });

  describe("Scenario 1: markers, redaction, and prevention", () => {
    beforeEach(async function () {
      this.timeout(60000);
      await resetSensitiveSettings();
      await clearAndIndexSensitiveFolder();
    });

    it("should mark sensitive files, redact on copy, and exclude sensitive files when prevention is enabled", async function () {
      this.timeout(90000);

      // a/b/c: open settings, enable protection, ensure prevention is disabled
      await appPage.navigateToSettings();
      await settingsPage.waitForReady();
      await settingsPage.setSensitiveProtectionEnabled(true);
      await settingsPage.setPreventSelectionEnabled(false);
      expect(await settingsPage.isSensitiveProtectionEnabled()).toBe(true);
      expect(await settingsPage.isPreventSelectionEnabled()).toBe(false);

      await settingsPage.addCustomSensitivePattern({
        name: customPatternName,
        regex: customPatternRegex,
        placeholder: customPatternPlaceholder,
        testInput: customPatternInputSample,
      });
      await settingsPage.clickSaveSettings();
      await waitForPatternEnabledInBackend(customPatternName, true);
      await waitForMarkedPathInBackend(customRulePath, true);

      // d/e1: open file tree and verify markers + checkboxes
      await appPage.navigateToMain();
      await expandSensitiveFixtureFolders();
      await emitSensitiveSettingsChanged();
      await browser.pause(800);

      await fileTreePage.waitForSensitiveIndicatorState("custom-rule.ts", true);
      expect(await fileTreePage.hasSensitiveIndicator("safe-code.ts")).toBe(false);

      expect(await fileTreePage.hasSelectionCheckbox("custom-rule.ts")).toBe(true);
      expect(await fileTreePage.hasSelectionCheckbox("safe-code.ts")).toBe(true);

      // e2/e3/e4: select sensitive + safe files, copy, verify sensitive values are redacted
      await fileTreePage.selectNode("custom-rule.ts");
      await fileTreePage.selectNode("safe-code.ts");
      await browser.pause(300);

      const redactedContext = await getContextFromClipboardOrFallback([
        customRulePath,
        safeCodePath,
      ]);

      expect(redactedContext.length).toBeGreaterThan(0);
      expect(redactedContext.includes("CUSTOM_MARKER_ABC123XYZ")).toBe(false);
      expect(redactedContext.includes(customPatternPlaceholder)).toBe(true);
      expect(redactedContext.includes("calculateSum")).toBe(true);
      expect(/\[[A-Z_]+\]/.test(redactedContext)).toBe(true);

      // f/g: enable prevention
      await appPage.navigateToSettings();
      await settingsPage.waitForReady();
      await settingsPage.setPreventSelectionEnabled(true);
      await settingsPage.clickSaveSettings();
      expect(await settingsPage.isPreventSelectionEnabled()).toBe(true);

      // h/i: verify sensitive checkboxes are hidden/blocked
      await appPage.navigateToMain();
      await expandSensitiveFixtureFolders();
      await emitSensitiveSettingsChanged();
      await browser.pause(800);

      expect(await fileTreePage.hasSelectionCheckbox("custom-rule.ts")).toBe(false);
      expect(await fileTreePage.isSelectionBlocked("custom-rule.ts")).toBe(true);
      expect(await fileTreePage.hasSelectionCheckbox("safe-example.ts")).toBe(true);

      // j/k/l: selecting parent excludes sensitive child from copied context
      await fileTreePage.selectNode("example-dir");
      await browser.pause(500);

      expect(await fileTreePage.isNodeSelected("custom-rule.ts")).toBe(false);
      expect(await fileTreePage.isNodeSelected("safe-example.ts")).toBe(true);

      const preventionContext = await getContextFromClipboardOrFallback([
        exampleSafePath,
        exampleSensitivePath,
        customRulePath,
      ]);

      expect(preventionContext.length).toBeGreaterThan(0);
      expect(preventionContext.includes("api_key_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890")).toBe(false);
      expect(preventionContext.includes("export const greeting = \"hello\";")).toBe(true);
      expect(preventionContext.includes("CUSTOM_MARKER_ABC123XYZ")).toBe(false);
    });
  });

  describe("Scenario 2: custom rule detection", () => {
    beforeEach(async function () {
      this.timeout(60000);
      await resetSensitiveSettings();
      await clearAndIndexSensitiveFolder();
    });

    it("should treat custom-rule file as sensitive only after adding a custom regex rule", async function () {
      this.timeout(90000);

      // a/b/c: enable protection, keep prevention disabled
      await appPage.navigateToSettings();
      await settingsPage.waitForReady();
      await settingsPage.setSensitiveProtectionEnabled(true);
      await settingsPage.setPreventSelectionEnabled(false);
      await settingsPage.clickSaveSettings();

      // d/e: custom-rule file is initially not marked sensitive
      await appPage.navigateToMain();
      await expandSensitiveFixtureFolders();
      await emitSensitiveSettingsChanged();
      await browser.pause(800);

      expect(await fileTreePage.hasSensitiveIndicator("custom-rule.ts")).toBe(false);

      // f/g/h: select + copy custom-rule file and verify marker value is visible
      await fileTreePage.selectNode("custom-rule.ts");
      await browser.pause(300);

      const beforeRuleContext = await getContextFromClipboardOrFallback([customRulePath]);
      expect(beforeRuleContext.length).toBeGreaterThan(0);
      expect(beforeRuleContext.includes("CUSTOM_MARKER_ABC123XYZ")).toBe(true);

      // i/j/k/l: add and enable custom rule via settings form
      await appPage.navigateToSettings();
      await settingsPage.waitForReady();

      await settingsPage.addCustomSensitivePattern({
        name: customPatternName,
        regex: customPatternRegex,
        placeholder: customPatternPlaceholder,
        testInput: customPatternInputSample,
      });
      await settingsPage.clickSaveSettings();
      await waitForPatternEnabledInBackend(customPatternName, true);
      await waitForMarkedPathInBackend(customRulePath, true);

      // m/n: back to files and verify marker appears on custom-rule file
      await appPage.navigateToMain();
      await expandSensitiveFixtureFolders();
      await browser.pause(800);

      await fileTreePage.waitForSensitiveIndicatorState("custom-rule.ts", true);

      // o/u/p: copy again and verify value is redacted by custom alias
      await fileTreePage.selectNode("custom-rule.ts");
      await browser.pause(300);

      const afterRuleContext = await getContextFromClipboardOrFallback([customRulePath]);
      expect(afterRuleContext.length).toBeGreaterThan(0);
      expect(afterRuleContext.includes("CUSTOM_MARKER_ABC123XYZ")).toBe(false);
      expect(afterRuleContext.includes(customPatternPlaceholder)).toBe(true);
    });
  });
});
