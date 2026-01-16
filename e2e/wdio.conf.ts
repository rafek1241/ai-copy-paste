import type { Options } from "@wdio/types";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Possible binary names (Cargo.toml name vs tauri.conf.json productName)
const BINARY_NAMES = ["ai-context-collector", "ai-copy-paste-temp"];

// Determine the path to the Tauri application binary
function getTauriAppPath(): string {
  const platform = os.platform();
  const ext = platform === "win32" ? ".exe" : "";
  const baseDir = path.join(__dirname, "..", "src-tauri", "target");

  console.log("=== Searching for Tauri binary ===");
  console.log(`Base directory: ${baseDir}`);
  console.log(`Platform: ${platform}, Extension: ${ext || "(none)"}`);

  // Check all combinations of binary names and build types
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

  // Default to first binary name in debug (will be built before tests)
  const defaultPath = path.join(baseDir, "debug", `${BINARY_NAMES[0]}${ext}`);
  console.log(`Binary not found, using default path: ${defaultPath}`);
  return defaultPath;
}

export const config: Options.Testrunner = {
  // Specify test files
  specs: ["./tests/**/*.spec.ts"],
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
      esm: true,
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
    timeout: 120000, // 2 minutes per test
    retries: 1, // Retry failed tests once
  },

  // Reporters
  reporters: [
    "spec",
    [
      "junit",
      {
        outputDir: "./e2e/reports",
        outputFileFormat: function (options: any) {
          return `e2e-results-${options.cid}.xml`;
        },
      },
    ],
  ],

  // Logging
  logLevel: "info",
  outputDir: "./e2e/logs",

  // Timeouts
  waitforTimeout: 30000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // No services needed - tauri-driver is started externally
  services: [],

  // Hooks
  beforeSession: async function () {
    // Create test fixtures directory
    const fixturesDir = path.join(__dirname, "fixtures", "test-data");
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

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

        // Also log a snippet of the page source to console
        console.log("=== Page Source Snippet ===");
        console.log(pageSource.substring(0, 2000));
        console.log("=== End Snippet ===");
      } catch (sourceError) {
        console.error("Failed to capture page source:", sourceError);
      }
    }
  },

  onComplete: async function () {
    console.log("E2E tests completed");
  },
};
