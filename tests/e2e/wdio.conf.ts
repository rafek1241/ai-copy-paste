import type { Options } from "@wdio/types";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppPage, FileTreePage } from "./utils/pages/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __baseDir = path.join(__dirname, "..", "..");
const __testResultsDir = path.join(__baseDir, "tests", "e2e");

const BINARY_NAMES = ["ai-context-collector", "ai-copy-paste-temp"];
const isCI = Boolean(process.env.CI);
const shouldAcceleratePauses = !isCI && process.env.E2E_FAST !== "0";
const pauseCapMs = Number(process.env.E2E_PAUSE_CAP_MS ?? "200");
const effectivePauseCapMs = Number.isFinite(pauseCapMs) && pauseCapMs > 0 ? pauseCapMs : 200;

function getTauriAppPath(): string {
  const platform = os.platform();
  const ext = platform === "win32" ? ".exe" : "";
  const targetDir = path.join(__baseDir, "src-tauri", "target");

  for (const buildType of ["debug", "release"]) {
    for (const binaryName of BINARY_NAMES) {
      const binaryPath = path.join(targetDir, buildType, `${binaryName}${ext}`);
      if (fs.existsSync(binaryPath)) {
        return binaryPath;
      }
    }
  }

  return path.join(targetDir, "debug", `${BINARY_NAMES[0]}${ext}`);
}

function assertFixturesPresent(): void {
  const fixturesDir = path.join(__dirname, "fixtures", "test-data");
  const requiredFixturePaths = [
    "sample.ts",
    "sample.js",
    "sample.md",
    "sample.json",
    "sample.txt",
    path.join("subfolder", "nested.ts"),
    path.join("hierarchical-test", "track1", "plan.ts"),
    path.join("sensitive-test", "example-dir", "sensitive-example.ts"),
    path.join("sensitive-test", "example-dir", "custom-rule.ts"),
  ];

  if (!fs.existsSync(fixturesDir)) {
    throw new Error(`Missing E2E fixtures directory: ${fixturesDir}`);
  }

  const missing = requiredFixturePaths
    .map((relativePath) => path.join(fixturesDir, relativePath))
    .filter((absolutePath) => !fs.existsSync(absolutePath));

  if (missing.length > 0) {
    throw new Error(`Missing required fixture files:\n${missing.join("\n")}`);
  }
}

function patchBrowserPauseIfNeeded(): void {
  if (!shouldAcceleratePauses) {
    return;
  }

  if ((globalThis as any).__e2ePausePatched) {
    return;
  }

  const originalPause = browser.pause.bind(browser);
  (browser as any).pause = async (ms: number = 0) => {
    const requested = Number.isFinite(ms) ? ms : 0;
    return originalPause(Math.min(requested, effectivePauseCapMs));
  };

  (globalThis as any).__e2ePausePatched = true;
  console.log(`E2E pause acceleration active (cap: ${effectivePauseCapMs}ms)`);
}

export const config: Options.Testrunner = {
  specs: ["./tests/**/*.spec.ts"],
  exclude: [],

  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      browserName: "wry",
      "tauri:options": {
        application: getTauriAppPath(),
      },
    } as any,
  ],

  runner: "local",
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: path.join(__dirname, "tsconfig.json"),
    },
  },

  // tauri-driver is started externally on port 4445.
  hostname: "localhost",
  port: 4445,
  path: "/",

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: isCI ? 60000 : 20000,
    retries: isCI ? 1 : 0,
  },

  reporters: ["spec"],

  logLevel: "warn",
  outputDir: path.join(__testResultsDir, "logs"),

  waitforTimeout: isCI ? 15000 : 7000,
  connectionRetryTimeout: isCI ? 30000 : 7000,
  connectionRetryCount: isCI ? 5 : 3,

  services: [],

  beforeSession: async function () {
    assertFixturesPresent();
  },

  before: async function () {
    patchBrowserPauseIfNeeded();

    const appPage = new AppPage();
    const fileTreePage = new FileTreePage();

    const loadTimeout = isCI ? 30000 : 12000;
    await appPage.waitForLoad(loadTimeout);
    await appPage.waitForTauriReady(loadTimeout);
    await appPage.navigateToMain();

    try {
      await appPage.clearContext();
      await browser.execute(async () => {
        const tauri = (window as any).__TAURI__;
        if (tauri?.core?.invoke) {
          await tauri.core.invoke("clear_index");
        }
      });
    } catch (error) {
      console.warn("Failed to clear context/index:", error);
    }

    try {
      await fileTreePage.waitForReady();
    } catch (error) {
      console.warn("File tree not ready:", error);
    }
  },

  afterTest: async function (test, _context, { error }) {
    if (!error) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const testName = test.title.replace(/[^a-zA-Z0-9]/g, "_");

    const screenshotDir = path.join(__testResultsDir, "screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    try {
      const screenshotPath = path.join(screenshotDir, `${testName}-${timestamp}.png`);
      await browser.saveScreenshot(screenshotPath);
    } catch (screenshotError) {
      console.error("Failed to take screenshot:", screenshotError);
    }

    try {
      const pageSource = await browser.getPageSource();
      const logsDir = path.join(__testResultsDir, "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const sourcePath = path.join(logsDir, `${testName}-${timestamp}.html`);
      fs.writeFileSync(sourcePath, pageSource);
    } catch (sourceError) {
      console.error("Failed to capture page source:", sourceError);
    }
  },

  onComplete: async function () {
    console.log("E2E tests completed");
  },
};
