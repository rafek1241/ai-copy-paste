# Testing Guide for AI Context Collector

This document provides instructions for testing the AI Context Collector implementation.

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

## Testing Phase 5 Features

Phase 5 adds token counting and prompt building capabilities. See [PHASE5.md](PHASE5.md) for comprehensive documentation.

### 1. Template Loading Test

Open the application and verify templates are loaded:

```javascript
const { invoke } = window.__TAURI__.core;

// Get all available templates
const templates = await invoke('get_templates');
console.log('Templates:', templates);
```

**Expected Result:** Should return 6 templates:
- agent (General purpose AI agent)
- planning (Project planning and architecture)
- debugging (Code debugging and troubleshooting)
- review (Code review)
- documentation (Generate documentation)
- testing (Generate test cases)

### 2. File Content Retrieval Test

After indexing some files, test content retrieval:

```javascript
// Get file content by ID (use an actual file ID from your database)
const fileContent = await invoke('get_file_content', { fileId: 1 });
console.log('File content:', fileContent);

// Get multiple file contents
const contents = await invoke('get_file_contents', { fileIds: [1, 2, 3] });
console.log('Multiple file contents:', contents);
```

**Expected Result:** Should return file path and content as text.

### 3. Prompt Building Test

Build a prompt from selected files:

```javascript
// Build prompt using template
const response = await invoke('build_prompt_from_files', {
  request: {
    template_id: 'agent',
    custom_instructions: 'Please review this code for bugs',
    file_ids: [1, 2, 3]
  }
});

console.log('Prompt:', response.prompt);
console.log('File count:', response.file_count);
console.log('Total chars:', response.total_chars);
```

**Expected Result:** Should return a formatted prompt containing:
- Template text
- Custom instructions
- File paths and contents

### 4. Token Counting Test (Frontend)

The token counting is done on the frontend using `gpt-tokenizer`. Test in browser console:

```javascript
// Import tokenizer (if you've exposed it globally)
import { countTokens } from './services/tokenizer';

const text = "Hello, world! This is a test.";
const count = countTokens(text);
console.log('Token count:', count);
```

Or use the UI components:
1. Open the demo UI (click "Show Demo UI" button)
2. Select a template
3. Enter custom instructions
4. Click "Build Prompt"
5. Verify token counter displays
6. Check color coding:
   - Green: < 50% of limit
   - Yellow: 50-75%
   - Orange: 75-90%
   - Red: > 90%

### 5. Copy to Clipboard Test

1. Build a prompt using the UI
2. Click "Copy to Clipboard" button
3. Paste into text editor
4. Verify full prompt is copied correctly

### 6. Model Selection Test

1. Select different models from dropdown
2. Verify token limits update:
   - GPT-4o: 128,000 tokens
   - GPT-4: 8,192 tokens
   - Claude 3: 200,000 tokens
   - Gemini Pro: 32,768 tokens
3. Build a large prompt and verify progress bar adjusts based on model

### 7. Error Handling Tests

Test error scenarios:

```javascript
// Try to build prompt with no files
await invoke('build_prompt_from_files', {
  request: {
    template_id: 'agent',
    file_ids: []
  }
});
// Should handle gracefully

// Try invalid template ID
await invoke('build_prompt_from_files', {
  request: {
    template_id: 'invalid_template',
    file_ids: [1]
  }
});
// Should return error: "Template not found"

// Try invalid file ID
await invoke('get_file_content', { fileId: 999999 });
// Should return error
```

### 8. Performance Tests

Test with larger files:

```javascript
// Build prompt with many files
const largeFileIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const startTime = Date.now();
const response = await invoke('build_prompt_from_files', {
  request: {
    template_id: 'agent',
    file_ids: largeFileIds
  }
});
const endTime = Date.now();

console.log(`Built prompt with ${response.file_count} files in ${endTime - startTime}ms`);
console.log(`Total characters: ${response.total_chars}`);
```

**Expected Result:**
- Should handle 10+ files without issues
- Should complete in < 5 seconds
- Token counting should complete in < 1 second

### 9. Integration Test

Full workflow test:

1. Index a folder with code files:
   ```javascript
   await invoke('index_folder', { path: '/path/to/your/project' });
   ```

2. Get root files:
   ```javascript
   const files = await invoke('get_children', { parentId: null });
   ```

3. Build prompt with selected files:
   ```javascript
   const fileIds = files.slice(0, 3).map(f => f.id);
   const response = await invoke('build_prompt_from_files', {
     request: {
       template_id: 'review',
       custom_instructions: 'Focus on security issues',
       file_ids: fileIds
     }
   });
   ```

4. Verify prompt contains all files
5. Copy to clipboard and paste into AI chat

## Known Limitations

### Phase 1 Limitations
1. No UI yet - testing must be done via developer console
2. No file watching - changes to filesystem are not automatically detected
3. No text extraction - only file metadata is indexed
4. No token counting - token_count field will be NULL
5. No history management UI
6. No settings UI

### Phase 5 Limitations
1. Token counting only supports OpenAI encoding (gpt-tokenizer)
2. Claude/Gemini token counts are estimates (±15% accuracy)
3. No token count caching in database yet
4. No custom template creation UI
5. No syntax highlighting in preview
6. Limited to text files only (binary files will show error)

These features may be implemented in subsequent phases.
