# Testing Guide for AI Context Collector - Phase 1

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
