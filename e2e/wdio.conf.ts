import type { Options } from "@wdio/types";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

// Determine the path to the Tauri application binary
function getTauriAppPath(): string {
  const platform = os.platform();
  const ext = platform === "win32" ? ".exe" : "";

  // Check for debug build first (faster for testing)
  const debugPath = path.join(
    __dirname,
    "..",
    "src-tauri",
    "target",
    "debug",
    `ai-context-collector${ext}`
  );

  // Check for release build
  const releasePath = path.join(
    __dirname,
    "..",
    "src-tauri",
    "target",
    "release",
    `ai-context-collector${ext}`
  );

  // Return first existing path
  for (const p of [debugPath, releasePath]) {
    if (fs.existsSync(p)) {
      console.log(`Found Tauri app at: ${p}`);
      return p;
    }
  }

  // Default to debug path (will be built before tests)
  console.log(`Tauri app not found, using default path: ${debugPath}`);
  return debugPath;
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
      // Take screenshot on failure
      const screenshotDir = path.join(__dirname, "screenshots");
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const screenshotPath = path.join(
          screenshotDir,
          `${test.title.replace(/[^a-zA-Z0-9]/g, "_")}-${timestamp}.png`
        );
        await browser.saveScreenshot(screenshotPath);
        console.log(`Screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error("Failed to take screenshot:", screenshotError);
      }
    }
  },

  onComplete: async function () {
    console.log("E2E tests completed");
  },
};
