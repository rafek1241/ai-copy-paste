# Testing Guide for AI Context Collector - Phase 1-6

This document provides instructions for testing the Phase 1 implementation of the AI Context Collector.

## Prerequisites

### Windows
1. Install [Node.js](https://nodejs.org/) (v18 or later)
2. Install [Rust](https://rustup.rs/)
3. Install [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
4. Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10/11)

### macOS
1. Install [Node.js](https://nodejs.org/) (v18 or later)
2. Install [Rust](https://rustup.rs/)
3. Install Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```

### Linux (Ubuntu/Debian)
1. Install Node.js (v18 or later)
2. Install Rust from https://rustup.rs/
3. Install required system dependencies:
   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev \
     build-essential \
     curl \
     wget \
     file \
     libssl-dev \
     libayatana-appindicator3-dev \
     librsvg2-dev
   ```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/rafek1241/ai-copy-paste.git
   cd ai-copy-paste
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Install sidecar dependencies (for Phase 6 browser automation):
   ```bash
   cd sidecar
   npm install
   npx playwright install chromium
   cd ..
   ```

## Building the Application

### Development Mode (Recommended for Testing)
```bash
npm run tauri dev
```

This will:
- Start the Vite development server
- Compile the Rust backend
- Launch the application in development mode with hot-reload

### Production Build
```bash
npm run tauri build
```

This will create optimized binaries in `src-tauri/target/release/`.

## Testing Phase 1 Features

### 1. Database Initialization
When you start the application, check the console logs (visible in dev mode) for:
```
Starting AI Context Collector application
Database path: <path-to-app-data>/ai-context-collector.db
Database initialized successfully
```

**Expected Result:** The database file should be created in your system's app data directory:
- Windows: `%APPDATA%\com.aicontextcollector.app\ai-context-collector.db`
- macOS: `~/Library/Application Support/com.aicontextcollector.app/ai-context-collector.db`
- Linux: `~/.local/share/com.aicontextcollector.app/ai-context-collector.db`

### 2. Testing IPC Commands

You can test the Tauri commands using the browser developer tools console (right-click → Inspect → Console tab):

#### Test index_folder command
```javascript
// Import the invoke function
const { invoke } = window.__TAURI__.core;

// Index a folder (use an actual path on your system)
await invoke('index_folder', { path: 'C:\\Users\\YourName\\Documents' });
// On macOS/Linux: await invoke('index_folder', { path: '/Users/yourname/Documents' });
```

**Expected Result:** The command should return the number of files/folders indexed. Check console logs for progress.

#### Test get_children command
```javascript
// Get root-level entries (parent_id = null)
const rootEntries = await invoke('get_children', { parentId: null });
console.log('Root entries:', rootEntries);

// Get children of a specific folder (use an actual id from rootEntries)
const children = await invoke('get_children', { parentId: rootEntries[0].id });
console.log('Children:', children);
```

**Expected Result:** Should return an array of FileEntry objects with properties: id, parent_id, name, path, size, mtime, is_dir, etc.

#### Test search_path command
```javascript
// Search for files/folders matching a pattern
const results = await invoke('search_path', { pattern: 'test' });
console.log('Search results:', results);
```

**Expected Result:** Should return up to 100 matching entries.

### 3. Database Schema Verification

You can inspect the database using any SQLite viewer (e.g., [DB Browser for SQLite](https://sqlitebrowser.org/)):

1. Locate the database file (see paths above)
2. Open it with a SQLite viewer
3. Verify the following tables exist:
   - `files` (with columns: id, parent_id, name, path, size, mtime, is_dir, token_count, fingerprint)
   - `history` (with columns: id, created_at, root_paths, selected_paths, template_id, custom_prompt)
   - `settings` (with columns: key, value)
4. Verify the following indices exist:
   - `idx_parent` on files(parent_id)
   - `idx_path` on files(path)
   - `idx_fingerprint` on files(fingerprint)

### 4. Error Handling Tests

Test error handling by trying invalid operations:

```javascript
// Try to index a non-existent path
try {
  await invoke('index_folder', { path: '/this/path/does/not/exist' });
} catch (error) {
  console.log('Expected error:', error);
}

// Try to get children with invalid parent_id
const invalidChildren = await invoke('get_children', { parentId: 999999 });
console.log('Invalid parent (should be empty):', invalidChildren);
```

**Expected Result:** Appropriate error messages should be returned, and the application should not crash.

### 5. Performance Tests

Test with larger directories:

```javascript
// Index a large directory (e.g., node_modules or similar)
const startTime = Date.now();
const count = await invoke('index_folder', { path: './node_modules' });
const endTime = Date.now();
console.log(`Indexed ${count} entries in ${endTime - startTime}ms`);
```

**Expected Result:** 
- Should handle thousands of files without crashing
- Should complete in reasonable time (< 30 seconds for 10k files)
- Memory usage should remain stable

## Known Limitations (Phase 1)

1. No UI yet - testing must be done via developer console
2. No file watching - changes to filesystem are not automatically detected
3. No text extraction - only file metadata is indexed
4. No token counting - token_count field will be NULL
5. No history management UI
6. No settings UI

These features will be implemented in subsequent phases.

## Troubleshooting

### Build Fails on Windows
- Ensure Visual Studio C++ Build Tools are installed
- Make sure WebView2 is installed
- Try running from PowerShell as Administrator

### Build Fails on Linux
- Install all system dependencies listed above
- If webkit2gtk-4.1 is not available, try webkit2gtk-4.0:
  ```bash
  sudo apt install libwebkit2gtk-4.0-dev
  ```

### Database Lock Errors
- Close any SQLite viewers that might have the database open
- Restart the application
- Delete the database file and let it regenerate

### Application Won't Start
- Check console logs for errors
- Ensure no other instance is running
- Try deleting the app data directory and starting fresh

## Reporting Issues

If you encounter any issues:
1. Check the console logs (dev mode)
2. Check the Rust logs (visible in terminal when running `npm run tauri dev`)
3. Note your operating system and version
4. Provide steps to reproduce the issue
5. Include any error messages

## Next Steps

After verifying Phase 1 works correctly:
1. Review AGENTS.md for context on implementing Phase 2
2. Phase 2 will add the file traversal engine with parallel processing
3. Future phases will add the UI components and user-facing features

## Testing Phase 6 Features: Browser Automation

### Prerequisites

Phase 6 requires Node.js and Playwright installed in the sidecar directory:

```bash
cd sidecar
npm install
npx playwright install chromium
cd ..
```

### 1. Testing via UI

When you run the application in development mode, you'll see a "Browser Automation Test" interface:

1. Start the application:
   ```bash
   npm run tauri dev
   ```

2. The UI will show:
   - Dropdown to select AI interface (ChatGPT, Claude, Gemini, AI Studio)
   - Text area to enter your prompt
   - Optional custom URL field
   - Launch button

3. Enter a test prompt (e.g., "Explain how React hooks work")

4. Click "Launch Browser"

**Expected Result:**
- A browser window should open
- The browser navigates to the selected AI interface
- The prompt is automatically filled in the input field
- The browser remains open for you to review and submit
- Status message shows "Browser launched successfully"

### 2. Testing via Developer Console

You can test the browser automation commands directly:

```javascript
const { invoke } = window.__TAURI__.core;

// Get available interfaces
const interfaces = await invoke('get_available_interfaces');
console.log('Available interfaces:', interfaces);

// Launch browser with ChatGPT
await invoke('launch_browser', {
  interface: 'chatgpt',
  text: 'Explain how React hooks work in simple terms.',
  customUrl: null
});

// Launch with custom URL
await invoke('launch_browser', {
  interface: 'claude',
  text: 'Review this code for security issues:\n\nfunction login(user, pass) { ... }',
  customUrl: 'https://claude.ai/new'
});
```

### 3. Testing Standalone Sidecar

You can test the Node.js sidecar independently:

```bash
cd sidecar
node automation.js chatgpt "Test prompt goes here"
```

**Expected Result:**
- Browser launches with Chrome/Chromium
- Navigates to chat.openai.com
- Logs show selector attempts
- Prompt is filled in the input field
- Script exits but browser stays open

### 4. Testing Different AI Interfaces

Test each supported interface:

```bash
# ChatGPT
node automation.js chatgpt "Explain quantum computing"

# Claude
node automation.js claude "Write a Python function to sort a list"

# Gemini
node automation.js gemini "What is machine learning?"

# AI Studio
node automation.js aistudio "Summarize this text"
```

### 5. Testing Persistent Context

The browser should maintain login sessions across launches:

1. Launch browser and log in to an AI interface
2. Close the application
3. Launch browser again with a new prompt
4. **Expected:** You should still be logged in

The session is stored in `sidecar/.browser-data/`

### 6. Testing Error Recovery

Test fallback mechanisms:

```javascript
// Test with invalid interface (should fail gracefully)
try {
  await invoke('launch_browser', {
    interface: 'unknown',
    text: 'Test'
  });
} catch (error) {
  console.log('Expected error:', error);
}

// Test with empty prompt
await invoke('launch_browser', {
  interface: 'chatgpt',
  text: ''
});
```

### 7. Verifying Anti-Automation Features

Check that anti-automation mitigations are working:

1. Open browser DevTools in the automated browser
2. Run in console: `navigator.webdriver`
3. **Expected:** Should be `undefined` (not detected as automated)

### 8. Performance Tests

Test with large prompts:

```javascript
// Generate large prompt
const largePrompt = 'Explain this code:\n\n' + 'console.log("test");\n'.repeat(1000);

await invoke('launch_browser', {
  interface: 'chatgpt',
  text: largePrompt
});
```

**Expected Result:**
- Should handle prompts up to 100KB
- Typing should complete within reasonable time
- No browser crashes

## Phase 6 Troubleshooting

### Browser Doesn't Launch

**Problem:** Browser fails to launch
**Solutions:**
- Check Node.js is installed: `node --version`
- Install Playwright: `cd sidecar && npm install`
- Install browsers: `npx playwright install chromium`
- Check console logs for specific error

### Prompt Not Filled

**Problem:** Browser opens but prompt is not filled
**Solutions:**
- Check console output for selector attempts
- AI interface may have updated their UI - update `sidecar/selectors.js`
- Try manual selector with DevTools inspection
- Check if login is required (some interfaces require authentication)

### Browser Closes Immediately

**Problem:** Browser window closes right after opening
**Solutions:**
- Verify `automation.js` doesn't call `context.close()`
- Check that script exits with `process.exit(0)`
- Ensure persistent context is used (not regular launch)
- Check for Node.js process crashes in console

### "node: command not found"

**Problem:** Rust can't find Node.js executable
**Solutions:**
- Add Node.js to system PATH
- On Windows: Restart after installing Node.js
- Verify: `node --version` works in terminal

### Permission Errors

**Problem:** Permission denied errors on `.browser-data/`
**Solutions:**
- Check directory permissions
- Run without elevated privileges (don't use sudo)
- Delete `.browser-data/` and let it recreate

### Selector Failures

**Problem:** All selectors fail to find input field
**Solutions:**
- AI interface may require login first
- Page may still be loading - increase timeout
- Inspect element in browser DevTools
- Update selectors in `sidecar/selectors.js`
- Try custom URL if default URL changed

## Phase 6 Known Limitations

1. **No multi-tab support** - Opens in single tab/window
2. **No progress bar** - User doesn't see filling progress for large prompts
3. **No reconnection** - Can't reconnect to browser after script exits
4. **Login required** - User must manually log in to AI interfaces
5. **Selector maintenance** - May need updates when AI interfaces change UI

These limitations may be addressed in future updates.

## Phase 6 Security Considerations

⚠️ **Important Security Notes:**

1. **Credentials**: The browser stores cookies in `.browser-data/`. Keep this directory secure.
2. **Prompts**: Prompts may contain sensitive data. They are not logged or stored by the sidecar.
3. **Auto-detection**: Anti-automation features may fail on some sites, leading to detection.
4. **Updates**: AI interfaces may block automation - keep Playwright updated.

## Reporting Phase 6 Issues

If you encounter browser automation issues:
1. Check sidecar console output (`node automation.js` logs)
2. Check browser DevTools console
3. Note which AI interface you're testing
4. Provide the selector that failed (from logs)
5. Note if login is required
6. Include browser version and OS
