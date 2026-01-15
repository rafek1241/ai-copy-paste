# Testing Guide for AI Context Collector - Phases 1-4

This document provides instructions for testing the implementation of the AI Context Collector through Phase 4.

## Automated Testing (CI/CD)

The project includes a GitHub Actions workflow that automatically tests the application on all supported platforms.

### Continuous Integration Workflow

The CI workflow runs automatically on:
- Push to `main`, `master`, or any `claude/**` branches
- Pull requests to `main` or `master` branches

The workflow performs the following quality checks on **Windows, macOS, and Linux**:

1. **TypeScript Type Checking** - Validates all TypeScript code compiles without errors
2. **Rust Tests** - Runs the full Rust test suite (backend logic)
3. **Rust Clippy** - Lints Rust code for common issues and anti-patterns
4. **Frontend Build** - Builds the React/Vite frontend
5. **Tauri Build** - Compiles the full desktop application for each platform

### Viewing Test Results

Check the "Actions" tab in the GitHub repository to see test results:
- ✅ Green checkmark = All tests passed on all platforms
- ❌ Red X = Tests failed on one or more platforms
- 🟡 Yellow dot = Tests are currently running

### Running Tests Locally

To run the same checks locally before pushing:

```bash
# 1. TypeScript type check
npx tsc --noEmit

# 2. Run Rust tests
cd src-tauri
cargo test --verbose
cd ..

# 3. Run Rust clippy (linter)
cd src-tauri
cargo clippy -- -D warnings
cd ..

# 4. Build frontend
npm run build

# 5. Build Tauri application
npm run tauri build
```

All of these checks must pass for the CI quality gate to succeed.

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

After verifying Phase 1-4 work correctly:
1. Review AGENTS.md for context on implementing Phase 5
2. Phase 5 will add token counting and prompt building
3. Future phases will add browser automation and context menu installers

## Phase 4: Text Extraction Service Testing

Phase 4 adds text extraction capabilities with LRU caching and encoding detection.

### 1. Testing Backend Text Extraction

Test extracting text from source code files:

```javascript
const { invoke } = window.__TAURI__.core;

// Extract text from a source file
const result = await invoke('extract_text', { path: './src/App.tsx' });
console.log('Extraction result:', result);
console.log('Text length:', result.text.length);
console.log('Encoding:', result.encoding);
console.log('Error:', result.error);
```

**Expected Result:**
- `text` field should contain the file contents
- `encoding` should show detected encoding (e.g., "utf-8")
- `error` should be null for successful extraction
- Cache should store the result for subsequent calls

### 2. Testing Encoding Detection

Test with files in different encodings:

```javascript
// Test UTF-8 file
const utf8 = await invoke('extract_text', { path: './README.md' });
console.log('UTF-8 encoding:', utf8.encoding);

// Test ASCII file
const ascii = await invoke('extract_text', { path: './LICENSE' });
console.log('ASCII encoding:', ascii.encoding);

// Test file with special characters
const special = await invoke('extract_text', { path: './file-with-unicode.txt' });
console.log('Special chars:', special.text.includes('你好'));
```

**Expected Result:**
- UTF-8 files should be detected correctly
- ASCII is detected as UTF-8 (compatible)
- Unicode characters should be preserved
- No encoding errors or replacement characters

### 3. Testing LRU Cache

Test cache hit/miss behavior:

```javascript
// First extraction (cache miss)
console.time('First extraction');
const result1 = await invoke('extract_text', { path: './src/App.tsx' });
console.timeEnd('First extraction');

// Second extraction (cache hit)
console.time('Second extraction');
const result2 = await invoke('extract_text', { path: './src/App.tsx' });
console.timeEnd('Second extraction');

// Verify same content
console.log('Same content:', result1.text === result2.text);
```

**Expected Result:**
- First extraction should take longer (reads from disk)
- Second extraction should be very fast (reads from cache)
- Content should be identical
- Check Rust logs for "Cache hit" message

### 4. Testing Cache Invalidation

Test that cache invalidates when files change:

```javascript
// Extract file
const before = await invoke('extract_text', { path: './test-file.txt' });

// Manually modify the file (change content)
// ... wait a moment ...

// Re-index to update fingerprint
await invoke('index_folder', { path: './test-folder' });

// Extract again
const after = await invoke('extract_text', { path: './test-file.txt' });

console.log('Content changed:', before.text !== after.text);
```

**Expected Result:**
- Changed files should be re-extracted
- Cache should recognize fingerprint mismatch
- Check Rust logs for "Cache fingerprint mismatch" message

### 5. Testing Supported File Types

Test getting supported file types:

```javascript
const types = await invoke('get_supported_file_types');
console.log('Supported types:', types);
console.log('Supports .rs:', types.includes('rs'));
console.log('Supports .pdf:', types.includes('pdf'));
```

**Expected Result:**
- Should return array of supported extensions
- Should include common source code extensions
- Should include text file extensions

### 6. Testing Error Handling

Test with non-existent files:

```javascript
try {
  await invoke('extract_text', { path: './non-existent-file.txt' });
} catch (error) {
  console.log('Expected error:', error);
}
```

**Expected Result:**
- Should return error message, not crash
- Error should indicate file not found
- App should remain responsive

### 7. Testing PDF Extraction (Frontend)

Test PDF extraction using the frontend service:

```javascript
import { extractText } from './services/extraction';

// Extract from PDF file
const result = await extractText('./sample.pdf', (progress) => {
  console.log(`Extracting: ${progress.current}/${progress.total} pages`);
  console.log(`Status: ${progress.status}`);
});

console.log('PDF text:', result.text);
console.log('Page count:', result.pageCount);
console.log('Error:', result.error);
```

**Expected Result:**
- Progress callback should be called for each page
- Text should contain PDF content
- pageCount should match actual pages
- error should be null for valid PDFs

### 8. Testing DOCX Extraction (Frontend)

Test DOCX extraction:

```javascript
import { extractText } from './services/extraction';

// Extract from DOCX file
const result = await extractText('./document.docx');

console.log('DOCX text:', result.text);
console.log('Error:', result.error);
```

**Expected Result:**
- Text should contain document content
- Formatting should be stripped (plain text)
- error should be null for valid DOCX files

### 9. Testing Cache Size Limits

Test LRU eviction with large files:

```javascript
// Extract multiple large files to fill cache
const files = [
  './large-file-1.txt',
  './large-file-2.txt',
  './large-file-3.txt',
  // ... add more files to exceed 100MB
];

for (const file of files) {
  await invoke('extract_text', { path: file });
}

// Check cache size (via Rust logs)
// Should see "Evicting LRU cache entry" messages
```

**Expected Result:**
- Cache should stay under 100MB limit
- Least recently used entries should be evicted
- Check Rust logs for eviction messages
- Cache should still function correctly

### 10. Testing Frontend Integration

Test extraction in the UI context:

```javascript
// In FileTree component or similar
const handleExtractClick = async (filePath: string) => {
  try {
    const result = await invoke('extract_text', { path: filePath });
    
    if (result.error) {
      console.error('Extraction failed:', result.error);
      return;
    }
    
    console.log(`Extracted ${result.text.length} characters`);
    // Display in UI or use for token counting
  } catch (error) {
    console.error('Error:', error);
  }
};
```

**Expected Result:**
- Should integrate smoothly with existing UI
- Errors should be handled gracefully
- User should see extraction progress
- Extracted text should be usable for next phases

## Phase 4 Known Limitations

1. PDF and DOCX extraction require files to be readable in Tauri's file system
2. Very large files (>100MB) may be slow to extract
3. Cache is disk-based, so first access after app restart may be slow
4. Some PDF files with complex formatting may not extract perfectly
5. Binary files are not supported (returns empty text)

## Phase 4 Performance Targets

| Operation | Expected Time |
|-----------|---------------|
| Small text file (< 10KB) cache miss | < 50ms |
| Small text file cache hit | < 5ms |
| Medium source file (100KB) | < 100ms |
| Large text file (1MB) | < 500ms |
| PDF (100 pages) | 2-5 seconds |
| DOCX (20 pages) | 1-2 seconds |

## Troubleshooting Phase 4

### PDF Extraction Fails
- Ensure pdfjs-dist is installed: `npm install`
- Check browser console for worker loading errors
- Verify file is accessible via Tauri fs plugin

### DOCX Extraction Fails
- Ensure mammoth is installed: `npm install`
- Check if file is valid DOCX format
- Try opening in Word to verify

### Cache Not Working
- Check app cache directory exists
- Verify fingerprints are being generated correctly
- Check Rust logs for cache-related messages
- Delete cache directory to start fresh
