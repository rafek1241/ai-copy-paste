# Testing Guide for AI Context Collector - Phases 1-3

This document provides instructions for testing the implementation of the AI Context Collector through Phase 3.

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

## Known Limitations (Phase 1-3)

1. No text extraction yet - only file metadata is indexed
2. No token counting - token_count field will be NULL
3. No history management UI
4. No settings UI
5. No browser automation
6. Drag-and-drop shows a message to use the "Add Folder" button (getting folder paths from drag-drop is limited in Tauri)

These features will be implemented in subsequent phases.

## Testing Phase 3 Features

Phase 3 adds a complete UI with virtual scrolling tree, checkboxes, search, and folder selection.

### 1. Starting the Application

Run the application in development mode:
```bash
npm run tauri dev
```

The application should open with:
- A header showing "AI Context Collector" 
- A search bar and "Add Folder" button
- An empty state message: "No files indexed. Click 'Add Folder' or drag and drop a folder to start."

### 2. Testing Folder Indexing

**Add a folder:**
1. Click the "Add Folder" button
2. Select a folder from your filesystem (try a small folder first with ~100 files)
3. Wait for indexing to complete

**Expected Result:** 
- The folder and its contents should appear in the tree
- Folders are shown with 📁 icon
- Files are shown with 📄 icon
- The tree should be collapsed by default

### 3. Testing Tree Navigation

**Expand/Collapse:**
1. Click the ▶ arrow next to a folder
2. The folder should expand, showing its children
3. The arrow should rotate to point down (▼)
4. Click again to collapse

**Expected Result:** 
- Children are loaded lazily from the database when expanded
- Folders are sorted before files
- Items within each category are sorted alphabetically

### 4. Testing Checkbox Selection

**Select files:**
1. Check a file's checkbox - it should become checked
2. Check a folder's checkbox - all its children should become checked
3. Partially check a folder's children - the parent checkbox should show indeterminate state
4. The header should show "X file(s) selected"

**Expected Result:**
- Checking a parent checks all children
- Unchecking a parent unchecks all children
- Parent checkboxes show indeterminate state when some (but not all) children are checked
- The selection count updates in the header

### 5. Testing Search

**Search for files:**
1. Type a search term in the search bar (e.g., "test")
2. Wait 150ms (debounce delay)
3. The tree should update to show only matching items

**Expected Result:**
- Search is debounced (waits 150ms after typing stops)
- Up to 100 matching items are shown
- Both file names and paths are searched
- Clear the search box to return to normal view

### 6. Testing Virtual Scrolling

**Test with large folder:**
1. Index a folder with many files (e.g., node_modules)
2. Expand folders with hundreds of children
3. Scroll through the list

**Expected Result:**
- Scrolling should be smooth (60fps)
- Only visible items + ~10 overscan are rendered
- Memory usage should remain stable even with 100k+ files
- Tree height adjusts dynamically as you expand/collapse

### 7. Testing File Size Display

**View file sizes:**
1. Files should show their size on the right side (e.g., "1.2 KB", "5.4 MB")
2. Folders should not show sizes

**Expected Result:**
- Sizes are formatted human-readable (B, KB, MB, GB)
- Sizes update if files change (on re-indexing)

### 8. Testing Persistence

**Database persistence:**
1. Index a folder
2. Close the application
3. Reopen the application
4. Click "Add Folder" and select the same folder

**Expected Result:**
- Previously indexed files are still in the database
- Re-indexing the same folder updates changed files (via fingerprint)
- The tree should load the existing data on startup

### 9. Performance Testing

Test the application with various folder sizes:

| Folder Type | Expected Files | Target Index Time | UI Responsiveness |
|-------------|---------------|-------------------|-------------------|
| Small project | ~100 files | < 1 second | Instant |
| Medium project | ~1,000 files | < 5 seconds | Smooth scrolling |
| Large project | ~10,000 files | < 15 seconds | 60fps scrolling |
| node_modules | ~100,000 files | < 60 seconds | Should remain responsive |

### 10. Testing UI Responsiveness

**Hover effects:**
- Tree nodes should highlight on hover
- Buttons should show hover states
- Expand icons should be interactive

**Keyboard navigation:**
- Tab should move focus between controls
- Space/Enter should work on buttons
- (Tree keyboard navigation not implemented yet)

## Known Issues in Phase 3

1. Drag-and-drop doesn't extract folder paths (shows message to use button)
2. No way to remove indexed folders from the tree
3. No way to clear the database
4. Search doesn't highlight matching text
5. No keyboard shortcuts for tree navigation
6. No multi-select with Shift/Ctrl
7. Root level entries are always shown (no way to start fresh without deleting database)

These will be addressed in future phases or can be added as enhancements.

## Known Limitations (Phase 1)

Phase 2 adds parallel file traversal, batch inserts, and progress reporting.

### 1. Running Unit Tests

Test the core indexing functionality:

```bash
cd src-tauri
cargo test
```

**Expected Result:** All tests should pass, including:
- `test_file_entry_from_path` - FileEntry creation
- `test_traverse_and_insert` - Basic traversal
- `test_fingerprint_update` - Change detection
- `test_index_progress_serialization` - Progress events
- `test_permission_error_recovery` - Error handling

### 2. Testing Parallel Indexing

Test with a large directory (e.g., node_modules):

```javascript
const { invoke } = window.__TAURI__.core;

// Index a large directory with progress tracking
const startTime = Date.now();
const count = await invoke('index_folder', { path: './node_modules' });
const endTime = Date.now();
console.log(`Indexed ${count} entries in ${endTime - startTime}ms`);
```

**Expected Result:**
- Should be significantly faster than Phase 1 (target: < 15s for 100k files)
- No memory spikes during indexing
- Database correctly populated with all entries

### 3. Testing Progress Events

Listen for progress events during indexing:

```javascript
const { listen } = window.__TAURI__.event;

// Set up progress listener
const unlisten = await listen('indexing-progress', (event) => {
  console.log('Progress:', event.payload);
  console.log(`  Processed: ${event.payload.processed}`);
  console.log(`  Current: ${event.payload.current_path}`);
  console.log(`  Errors: ${event.payload.errors}`);
});

// Start indexing
await invoke('index_folder', { path: '/path/to/large/folder' });

// Clean up listener
unlisten();
```

**Expected Result:**
- Progress events should be emitted during indexing
- Events should be throttled (max 10 per second)
- Final event should have `current_path: "Complete"`
- Error count should be accurate

### 4. Testing Batch Insert Performance

Compare performance between small and large directories:

```javascript
// Test 1: Small directory (< 100 files)
let start = Date.now();
await invoke('index_folder', { path: './src' });
console.log(`Small dir: ${Date.now() - start}ms`);

// Test 2: Medium directory (1k-10k files)
start = Date.now();
await invoke('index_folder', { path: './node_modules' });
console.log(`Medium dir: ${Date.now() - start}ms`);
```

**Expected Result:**
- Batch inserts should show significant speedup
- Large directories should scale linearly (not exponentially)
- No database lock errors

### 5. Testing Symlink Handling

Create a test with symlinks:

```bash
# On Linux/macOS
mkdir test-symlinks
cd test-symlinks
mkdir real-folder
echo "content" > real-folder/file.txt
ln -s real-folder symlink-folder
```

```javascript
await invoke('index_folder', { path: './test-symlinks' });
```

**Expected Result:**
- Symlinks should be skipped (not followed)
- No infinite loops or crashes
- Warning logged for skipped symlinks

### 6. Testing Error Recovery

Test with permission errors:

```javascript
// Try to index a restricted directory (adjust path for your OS)
try {
  await invoke('index_folder', { path: '/root' }); // Linux
  // await invoke('index_folder', { path: 'C:\\System Volume Information' }); // Windows
} catch (error) {
  console.log('Expected error:', error);
}

// Verify app is still responsive
await invoke('get_children', { parentId: null });
```

**Expected Result:**
- Permission errors should be logged but not crash the app
- Indexing should continue with accessible files
- Error count should be reflected in progress events

### 7. Performance Benchmarks

Expected performance targets:

| File Count | Expected Time | Memory Usage |
|-----------|---------------|--------------|
| 1,000 files | < 1 second | < 50 MB |
| 10,000 files | < 3 seconds | < 100 MB |
| 100,000 files | < 15 seconds | < 200 MB |

Test with real directories:
- Small project: `./src` (few hundred files)
- Medium project: `./node_modules` (10k-50k files)
- Large project: System folder (100k+ files)

## Known Limitations (Phase 1 & 2)

**Phase 1 Limitations:**
1. No UI yet - testing must be done via developer console
2. No text extraction - only file metadata is indexed
3. No token counting - token_count field will be NULL
4. No history management UI
5. No settings UI

**Phase 2 Improvements:**
- ✅ Parallel file traversal with rayon
- ✅ Batch SQLite inserts (1000 records per transaction)
- ✅ Progress reporting via Tauri events
- ✅ Symlink handling (skipped to avoid cycles)
- ✅ Permission error recovery

**Still Missing (Future Phases):**
- File watching for automatic re-indexing
- Virtual tree UI with lazy loading
- Text extraction from PDF, DOCX, etc.
- Token counting
- Browser automation

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
