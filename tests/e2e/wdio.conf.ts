import type { Options } from "@wdio/types";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { AppPage, FileTreePage } from "./utils/pages/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Possible binary names (Cargo.toml name vs tauri.conf.json productName)
const BINARY_NAMES = ["ai-context-collector", "ai-copy-paste-temp"];

// Determine the path to the Tauri application binary
function getTauriAppPath(): string {
  const platform = os.platform();
  const ext = platform === "win32" ? ".exe" : "";
  const baseDir = path.join(__dirname, "..", "..", "src-tauri", "target");

  console.log("=== Searching for Tauri binary ===");
  console.log(`Base directory: ${baseDir}`);
  console.log(`Platform: ${platform}, Extension: ${ext || "(none)"}`);

  // Check all combinations of binary names and build types
  // Prioritize debug (easier for testing with devtools) over release
  const buildTypes = ["debug", "release"];

  for (const buildType of buildTypes) {
    for (const binaryName of BINARY_NAMES) {
      const binaryPath = path.join(baseDir, buildType, `${binaryName}${ext}`);
      console.log(`Checking: ${binaryPath}`);

      if (fs.existsSync(binaryPath)) {
        console.log(`Found Tauri app at: ${binaryPath}`);
        return binaryPath;
      }
    }
  }

  // List what's actually in the debug directory for debugging
  const debugDir = path.join(baseDir, "debug");
  if (fs.existsSync(debugDir)) {
    console.log(`Contents of ${debugDir}:`);
    try {
      const files = fs.readdirSync(debugDir).filter((f) => !f.startsWith("."));
      console.log(files.slice(0, 20).join(", "));
    } catch (e) {
      console.log(`Error listing directory: ${e}`);
    }
  }

  // Default to first binary name in release (will be built before tests)
  const defaultPath = path.join(baseDir, "release", `${BINARY_NAMES[0]}${ext}`);
  console.log(`Binary not found, using default path: ${defaultPath}`);
  return defaultPath;
}

export const config: Options.Testrunner = {
  // Specify test files
  specs: [
    "./tests/**/*.spec.ts",
  ],
  exclude: [],

  // Capabilities - connect to tauri-driver running on port 4444
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

  // Test runner
  runner: "local",
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: path.join(__dirname, "tsconfig.json"),
    },
  },

  // Connect to tauri-driver (WebDriver server on port 4444)
  hostname: "localhost",
  port: 4444,
  path: "/",

  // Framework
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 5000, // 5 seconds per test
    retries: 1, // Retry failed tests once
  },

  // Reporters
  reporters: [
    "spec",
    [
      "junit",
      {
        outputDir: "./reports",
        outputFileFormat: function (options: any) {
          return `e2e-results-${options.cid}.xml`;
        },
      },
    ],
  ],

  // Logging
  logLevel: "info",
  outputDir: "./logs",

  // Timeouts
  waitforTimeout: 5000,
  connectionRetryTimeout: 5000,
  connectionRetryCount: 3,

  // No services needed - tauri-driver is started externally
  services: [],

  // Hooks
  beforeSession: async function () {
    // Create test fixtures directory
    const fixturesDir = path.join(process.cwd(), "tests", "e2e", "fixtures", "test-data");
    if (fs.existsSync(fixturesDir)) {
      fs.rmSync(fixturesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(fixturesDir, { recursive: true });

    // Create sample test files
    const sampleFiles = [
      { name: "sample.ts", content: 'export const hello = "world";' },
      { name: "sample.js", content: 'const x = 42;\nconsole.log(x);' },
      { name: "sample.md", content: "# Hello\n\nThis is a test file." },
      { name: "sample.json", content: '{"key": "value", "number": 123}' },
      { name: "sample.txt", content: "Plain text content for testing." },
    ];

    for (const file of sampleFiles) {
      const filePath = path.join(fixturesDir, file.name);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, file.content);
      }
    }

    // Create a subdirectory with more files
    const subDir = path.join(fixturesDir, "subfolder");
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }

    const subFiles = [
      { name: "nested.ts", content: 'export const nested = true;' },
      { name: "nested.css", content: ".container { display: flex; }" },
    ];

    for (const file of subFiles) {
      const filePath = path.join(subDir, file.name);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, file.content);
      }
    }

    const hierarchicalDir = path.join(fixturesDir, "hierarchical-test");
    const trackData = [
      {
        name: "track1",
        files: [
          { name: "plan.ts", content: 'export const plan = "track1 plan";' },
          { name: "spec.ts", content: 'export const spec = "track1 spec";' },
        ],
      },
      {
        name: "track2",
        files: [{ name: "notes.md", content: "# Track 2 Notes\n\nNotes for track2." }],
      },
      {
        name: "track3",
        files: [{ name: "todo.txt", content: "track3 todo item" }],
      },
    ];

    for (const track of trackData) {
      const trackDir = path.join(hierarchicalDir, track.name);
      if (!fs.existsSync(trackDir)) {
        fs.mkdirSync(trackDir, { recursive: true });
      }
      for (const file of track.files) {
        const filePath = path.join(trackDir, file.name);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, file.content);
        }
      }
    }

    const extraFiles = [
      { name: "clipboard-test.ts", content: 'export const test = "clipboard test";' },
      { name: "persistence-test.ts", content: 'export const persist = "test";' },
      { name: "sample-code.ts", content: 'export function hello() {\n  return "world";\n}' },
      { name: "sample-util.js", content: "const util = (x) => x * 2;\nmodule.exports = { util };" },
      {
        name: "component.tsx",
        content: "import React from 'react';\nexport const Component = () => <div>Hello World</div>;",
      },
      {
        name: "utils.ts",
        content: "export const sum = (a: number, b: number) => a + b;\nexport const multiply = (a: number, b: number) => a * b;",
      },
      { name: "config.json", content: '{"name": "test", "version": "1.0.0"}' },
      { name: "README.md", content: "# Test Project\n\nThis is a test project for E2E testing." },
    ];

    for (const file of extraFiles) {
      const filePath = path.join(fixturesDir, file.name);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, file.content);
      }
    }
  },

  before: async function () {
    const appPage = new AppPage();
    const fileTreePage = new FileTreePage();
    
    // Initial wait for app load
    await appPage.waitForLoad(10000);
    await appPage.navigateToMain();
    await appPage.waitForTauriReady(10000);

    // Try to clear previous state
    try {
      await appPage.clearContext();
      await browser.execute(() => {
        const tauri = (window as any).__TAURI__;
        if (tauri) {
          tauri.core.invoke("clear_index");
        }
      });
    } catch (e) {
      console.warn("Failed to clear context/index:", e);
    }

    // Wait for empty state
    try {
      await fileTreePage.waitForReady();
    } catch (e) {
      console.warn("File tree not ready:", e);
    }
  },

  afterTest: async function (test, _context, { error }) {
    if (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const testName = test.title.replace(/[^a-zA-Z0-9]/g, "_");

      // Take screenshot on failure
      const screenshotDir = path.join(__dirname, "screenshots");
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      try {
        const screenshotPath = path.join(
          screenshotDir,
          `${testName}-${timestamp}.png`
        );
        await browser.saveScreenshot(screenshotPath);
        console.log(`Screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error("Failed to take screenshot:", screenshotError);
      }

      // Capture page source for debugging
      try {
        const pageSource = await browser.getPageSource();
        const logsDir = path.join(__dirname, "logs");
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        const sourcePath = path.join(
          logsDir,
          `${testName}-${timestamp}.html`
        );
        fs.writeFileSync(sourcePath, pageSource);
        console.log(`Page source saved: ${sourcePath}`);
      } catch (sourceError) {
        console.error("Failed to capture page source:", sourceError);
      }
    }
  },

  onComplete: async function () {
    console.log("E2E tests completed");
  },
};
