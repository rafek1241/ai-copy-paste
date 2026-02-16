import type { Options } from "@wdio/types";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { AppPage, FileTreePage } from "./utils/pages/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __baseDir = path.join(__dirname, "..", "..");
const __testResultsDir = path.join(__dirname, "..", "..", "tests", "e2e");

// Possible binary names (Cargo.toml name vs tauri.conf.json productName)
const BINARY_NAMES = ["ai-context-collector", "ai-copy-paste-temp"];

// Determine the path to the Tauri application binary
function getTauriAppPath(): string {
  const platform = os.platform();
  const ext = platform === "win32" ? ".exe" : "";
  const baseDir = path.join(__baseDir, "src-tauri", "target");

  console.log("=== Searching for Tauri binary ===");
  // Check all combinations of binary names and build types
  // Prioritize debug (easier for testing with devtools) over release
  const buildTypes = ["debug", "release"];

  for (const buildType of buildTypes) {
    for (const binaryName of BINARY_NAMES) {
      const binaryPath = path.join(baseDir, buildType, `${binaryName}${ext}`);
      console.log(`Checking: ${binaryPath}`);

      if (fs.existsSync(binaryPath)) {
        return binaryPath;
      }
    }
  }

  // Default to first binary name in release (will be built before tests)
  const defaultPath = path.join(baseDir, "release", `${BINARY_NAMES[0]}${ext}`);
  console.log(`Binary not found, using default path: ${defaultPath}`);
  return defaultPath;
}

const isCI = !!process.env.CI;

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

  // Connect to tauri-driver (WebDriver server on port 4445)
  hostname: "localhost",
  port: 4445,
  path: "/",

  // Framework
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: isCI ? 60000 : 10000,
    retries: isCI ? 1 : 0,
  },

  // Reporters
  reporters: [
    "spec",
    [
      "junit",
      {
        outputDir: path.join(__testResultsDir, "reports"),
        outputFileFormat: function (options: any) {
          return `e2e-results-${options.cid}.xml`;
        },
      },
    ],
  ],

  // Logging
  logLevel: "warn",
  outputDir: path.join(__testResultsDir, "logs"), 

  // Timeouts - CI needs longer due to Xvfb + webkit2gtk startup
  waitforTimeout: isCI ? 15000 : 5000,
  connectionRetryTimeout: isCI ? 30000 : 5000,
  connectionRetryCount: isCI ? 5 : 3,

  // No services needed - tauri-driver is started externally
  services: [],

  // Hooks
  beforeSession: async function () {
    // Create test fixtures directory
    const fixturesDir = path.join(__dirname,  "fixtures", "test-data");
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

    // Create sensitive data test fixture files
    const sensitiveDir = path.join(fixturesDir, "sensitive-test");
    if (fs.existsSync(sensitiveDir)) {
      fs.rmSync(sensitiveDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sensitiveDir, { recursive: true });

    // Files with various types of sensitive data
    const sensitiveFiles = [
      {
        name: ".env",
        content: `# Database configuration
DB_HOST=localhost
DB_USER=admin
DB_PASSWORD=super_secret_password_123
DB_NAME=myapp

# API Keys
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456
OPENAI_API_KEY=sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890
GOOGLE_API_KEY=AIzaSyDExample1234567890abcdefghij

# JWT Token
JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
`,
      },
      {
        name: "api-config.ts",
        content: `// API configuration with bearer tokens
const API_CONFIG = {
  baseUrl: "https://api.example.com",
  headers: {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "X-API-Key": "api_key_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  },
  timeout: 30000,
};

export default API_CONFIG;
`,
      },
      {
        name: "database.ts",
        content: `// Database connection strings
const DB_CONNECTION = {
  // PostgreSQL connection
  postgres: "postgresql://admin:secret_password_123@db.example.com:5432/production",
  // MySQL connection  
  mysql: "mysql://root:another_password@mysql.example.com:3306/mydb",
  // MongoDB connection
  mongodb: "mongodb+srv://mongouser:mongopass@cluster.mongodb.net/test?retryWrites=true",
  // Redis connection
  redis: "redis://:redispass@redis.example.com:6379/0",
};

export default DB_CONNECTION;
`,
      },
      {
        name: "credentials.json",
        content: `{
  "client_id": "1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com",
  "client_secret": "GOCSPX-abcdefghijklmnopqrstuvwxyz",
  "refresh_token": "1//0gabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU",
  "azure_key": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
`,
      },
      {
        name: "auth-service.js",
        content: `// Authentication with Basic Auth
const AUTH_CONFIG = {
  basic: {
    username: "admin",
    password: "admin_secret_password_xyz",
  },
  bearer: "Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop",
  jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
};

export default AUTH_CONFIG;
`,
      },
      {
        name: "config.yaml",
        content: `# Application Configuration
app:
  name: MyApp
  version: 1.0.0
  
database:
  host: localhost
  port: 5432
  username: dbuser
  password: db_password_123
  name: myapp_db

api:
  key: api_key_live_example_123456789
  secret: super_secret_api_key_abc

s3:
  bucket: my-bucket
  region: us-east-1
  access_key: AKIAIOSFODNN7EXAMPLE
  secret_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
`,
      },
      // Regular non-sensitive file for comparison
      {
        name: "safe-code.ts",
        content: `// This is a safe file without sensitive data
export function calculateSum(a: number, b: number): number {
  return a + b;
}

export function calculateProduct(a: number, b: number): number {
  return a * b;
}

const config = {
  debug: true,
  timeout: 5000,
};

export default config;
`,
      },
    ];

    for (const file of sensitiveFiles) {
      const filePath = path.join(sensitiveDir, file.name);
      fs.writeFileSync(filePath, file.content);
    }

    const sensitiveExampleDir = path.join(sensitiveDir, "example-dir");
    fs.mkdirSync(sensitiveExampleDir, { recursive: true });

    const sensitiveExampleFiles = [
      {
        name: "safe-example.ts",
        content: `export const greeting = "hello";
export const retries = 3;
`,
      },
      {
        name: "sensitive-example.ts",
        content: `export const apiConfig = {
  apiKey: "api_key_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
};
`,
      },
      {
        name: "custom-rule.ts",
        content: `export const markerValue = "CUSTOM_MARKER_ABC123XYZ";
export const note = "This value should become sensitive after adding a custom regex rule.";
`,
      },
    ];

    for (const file of sensitiveExampleFiles) {
      const filePath = path.join(sensitiveExampleDir, file.name);
      fs.writeFileSync(filePath, file.content);
    }
  },

  before: async function () {
    const appPage = new AppPage();
    const fileTreePage = new FileTreePage();

    // Initial wait for app load - CI needs longer due to Xvfb + webkit2gtk
    const loadTimeout = isCI ? 30000 : 10000;
    await appPage.waitForLoad(loadTimeout);
    await appPage.waitForTauriReady(loadTimeout);
    await appPage.navigateToMain();

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
      const screenshotDir = path.join(__testResultsDir, "screenshots");
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      try {
        const screenshotPath = path.join(
          screenshotDir,
          `${testName}-${timestamp}.png`
        );
        await browser.saveScreenshot(screenshotPath);
      } catch (screenshotError) {
        console.error("Failed to take screenshot:", screenshotError);
      }

      // Capture page source for debugging
      try {
        const pageSource = await browser.getPageSource();
        const logsDir = path.join(__testResultsDir, "logs");
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        const sourcePath = path.join(
          logsDir,
          `${testName}-${timestamp}.html`
        );
        fs.writeFileSync(sourcePath, pageSource);
      } catch (sourceError) {
        console.error("Failed to capture page source:", sourceError);
      }
    }
  },

  onComplete: async function () {
    console.log("E2E tests completed");
  },
};
