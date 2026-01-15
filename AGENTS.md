# Agent Context - AI Context Collector Development

This document provides context for AI agents working on different phases of the AI Context Collector project. It includes the current state, decisions made, and guidance for future phases.

## Project Overview

The AI Context Collector is a cross-platform desktop application built with Tauri 2.0 and React. It helps developers collect and organize code context for AI assistants. The project follows the technical blueprint defined in PLAN.md.

## Current Status: Phase 6 Complete ✓

### What Has Been Implemented

**Core Infrastructure (Phase 1):**
- ✅ Tauri 2.0 project skeleton with React TypeScript frontend
- ✅ SQLite database integration using rusqlite
- ✅ Database schema with three tables (files, history, settings)
- ✅ Database indices for efficient queries
- ✅ Basic IPC commands:
  - `index_folder(path: String)` - Index a folder and its contents recursively
  - `get_children(parent_id: Option<i64>)` - Get children of a node
  - `search_path(pattern: String)` - Search files by path pattern
- ✅ Error handling framework using thiserror
- ✅ Logging infrastructure using env_logger
- ✅ Testing documentation (TESTING.md)

**Browser Automation (Phase 6):**
- ✅ Node.js sidecar with Playwright integration
- ✅ Persistent browser context (stays open after script exits)
- ✅ Support for multiple AI interfaces (ChatGPT, Claude, Gemini, AI Studio)
- ✅ Multiple selector fallbacks for robust input detection
- ✅ Anti-automation mitigations
- ✅ Rust IPC commands:
  - `launch_browser(interface, text, custom_url)` - Launch and fill AI chat
  - `get_available_interfaces()` - Get list of supported interfaces
- ✅ Test UI component for browser automation
- ✅ Comprehensive testing documentation

### Project Structure

```
ai-copy-paste/
├── src/                          # React frontend
│   ├── BrowserAutomation.tsx     # Phase 6 test component
│   └── ...                       # Other frontend components
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── indexing.rs       # File indexing commands
│   │   │   └── browser.rs        # Browser automation commands (Phase 6)
│   │   ├── db/                   # Database layer
│   │   │   ├── mod.rs            # DB connection management
│   │   │   └── schema.rs         # Schema definition
│   │   ├── error.rs              # Error types
│   │   ├── lib.rs                # Application entry point
│   │   └── main.rs               # Binary entry point
│   └── Cargo.toml                # Rust dependencies
├── sidecar/                      # Phase 6: Node.js Playwright process
│   ├── automation.js             # Browser control logic
│   ├── selectors.js              # AI interface configurations
│   ├── package.json              # Sidecar dependencies
│   ├── .browser-data/            # Persistent browser context (gitignored)
│   └── README.md                 # Sidecar documentation
├── package.json                  # NPM dependencies
├── PLAN.md                       # Complete technical blueprint
├── TESTING.md                    # Testing instructions
└── AGENTS.md                     # This file
```

### Key Dependencies

**Rust (Cargo.toml):**
- tauri = "2" - Framework
- rusqlite = "0.31" with bundled feature - SQLite
- thiserror = "1" - Error handling
- log = "0.4", env_logger = "0.11" - Logging
- serde, serde_json - Serialization

**TypeScript (package.json):**
- @tauri-apps/api = "^2" - Tauri API
- react = "^19", react-dom = "^19" - Frontend
- vite = "^7" - Build tool

**Sidecar (sidecar/package.json):**
- playwright = "^1.57.0" - Browser automation

## Important Architectural Decisions

### 1. Database as Source of Truth
- SQLite stores all file metadata (not in-memory)
- Lazy loading pattern: UI queries DB on-demand
- Fingerprinting (mtime + size) for change detection
- This enables handling 100k+ files without memory issues

### 2. Error Handling Strategy
- All errors converted to AppError enum
- Logged but don't crash the app
- Failed file indexing continues with other files
- Frontend receives String error messages

### 3. Async Commands
- All Tauri commands are async
- Database uses Mutex for thread-safe access
- Long-running operations (indexing) should report progress (not yet implemented)

### 4. Cross-Platform Focus
- Primary target: Windows (per user request)
- Secondary: macOS, Linux
- Database paths use Tauri's app_data_dir() for platform compatibility
- File paths stored as strings (not PathBuf) in database

### 5. Testing Without Linux Build
- Linux dependencies (webkit2gtk) not required for development
- Code can be verified on Windows/macOS
- CI/CD should test on all platforms
- Use TESTING.md for manual verification

### 6. Browser Automation Architecture (Phase 6)
- Separate Node.js sidecar process for browser control
- Uses Playwright's persistent context to keep browser open
- IPC communication via spawned child process (not WebSocket)
- Sidecar exits via `process.exit(0)` without closing browser
- Browser data stored in `.browser-data/` for session persistence
- Multiple selector fallbacks for robust AI interface interaction
- Anti-automation mitigations to avoid detection

## Phase 2: File Traversal Engine (Next)

### Objectives
Implement parallel, memory-efficient file system traversal with progress reporting.

### Tasks to Complete
1. **Add Dependencies:**
   - `walkdir = "2"` - Directory traversal
   - `rayon = "1"` - Parallel processing

2. **Enhance Indexing:**
   - Replace recursive approach with walkdir + rayon
   - Implement batch SQLite inserts (1000 records per transaction)
   - Add symlink handling (skip or follow based on settings)
   - Add permission error recovery

3. **Progress Reporting:**
   - Emit Tauri events during indexing
   - Report: files processed, errors, current directory
   - Frontend can display progress bar

4. **File Watching:**
   - Add `chokidar` to package.json (Node.js side)
   - Or use `notify` crate (Rust side)
   - Watch indexed folders for changes
   - Invalidate cache when files change

5. **Performance Optimization:**
   - Benchmark with 100k files
   - Target: < 15 seconds for initial index
   - Profile memory usage
   - Add configurable parallelism

### Key Code Patterns for Phase 2

**Parallel Traversal (Rust):**
```rust
use walkdir::WalkDir;
use rayon::prelude::*;

fn parallel_traverse(root: &Path) -> Vec<FileEntry> {
    WalkDir::new(root)
        .into_iter()
        .par_bridge()  // Parallel iteration
        .filter_map(|e| e.ok())
        .map(|entry| FileEntry::from_dir_entry(&entry))
        .collect()
}
```

**Batch Inserts:**
```rust
let mut stmt = conn.prepare("INSERT INTO files (...) VALUES (?, ?, ...)")?;
for chunk in entries.chunks(1000) {
    let tx = conn.transaction()?;
    for entry in chunk {
        stmt.execute(params![...])?;
    }
    tx.commit()?;
}
```

**Progress Events:**
```rust
app.emit("indexing-progress", IndexProgress {
    processed: count,
    total: estimated,
    current_path: path.to_string(),
})?;
```

### Testing Phase 2
- Index large directories (node_modules, system folders)
- Verify progress events are emitted
- Test with permission errors (restricted folders)
- Test with symlinks
- Measure performance with 10k, 100k files
- Verify memory usage stays reasonable

## Phase 2-5 and Phase 7-8 (Remaining Work)

See PLAN.md for complete details on remaining phases:
- Phase 2: File traversal engine with parallel processing
- Phase 3: Virtual tree UI with lazy loading
- Phase 4: Text extraction (PDF, DOCX, source files)
- Phase 5: Token counting and prompt building
- **Phase 6: Browser automation sidecar** ✅ **COMPLETE**
- Phase 7: History and persistence
- Phase 8: Context menu installers

## Phase 6 Implementation Notes (Completed)

### Architecture

The browser automation is implemented as a **separate Node.js sidecar process** that communicates with the main Tauri application. This design was chosen for several reasons:

1. **Browser Persistence**: Playwright's persistent context allows the browser to remain open after the Node.js process exits
2. **Isolation**: Browser automation logic is isolated from the Rust backend
3. **Flexibility**: Easy to update selectors without recompiling the entire app
4. **Dependencies**: Avoids bundling Playwright with the Tauri binary

### Key Implementation Decisions

**1. Persistent Context Pattern**
```javascript
const context = await chromium.launchPersistentContext('./browser-data', {
  headless: false,
  channel: 'chrome',
});
// ... do work ...
process.exit(0); // Browser stays open!
```

**2. Selector Fallback Chain**
Each AI interface has multiple selectors tried in order:
- Primary selector (most specific)
- Alternative selectors (for UI variations)
- Generic fallback (contenteditable)

**3. Fill Strategy Fallback**
Two strategies for filling input:
- `element.fill()` - Fast, works most of the time
- `element.click()` + `keyboard.type()` - Slower but more reliable

**4. Anti-Automation Mitigations**
- Disable blink features that indicate automation
- Use system Chrome instead of bundled Chromium
- Persistent context maintains normal user session

### Files Added

- `sidecar/automation.js` - Main browser control script
- `sidecar/selectors.js` - AI interface configurations
- `sidecar/package.json` - Node.js dependencies
- `sidecar/README.md` - Sidecar documentation
- `src-tauri/src/commands/browser.rs` - Rust IPC commands
- `src/BrowserAutomation.tsx` - Test UI component

### Testing Phase 6

Use the TESTING.md guide for complete testing instructions. Quick start:

```bash
# Install sidecar dependencies
cd sidecar
npm install
npx playwright install chromium
cd ..

# Run application
npm run tauri dev

# Use the "Browser Automation Test" UI to test
```

### Known Limitations

1. **No progress reporting** - User doesn't see filling progress
2. **No reconnection** - Can't reconnect to browser after sidecar exits
3. **Manual login required** - User must log in to AI interfaces first
4. **Selector maintenance** - AI interfaces change, selectors need updates
5. **No bundling yet** - Production builds need proper sidecar bundling

### Future Improvements (Out of Scope for Phase 6)

- [ ] Bundle sidecar with Tauri binary
- [ ] Add progress events during prompt filling
- [ ] Support for reconnecting to existing browser
- [ ] Automatic login handling
- [ ] Multi-tab support
- [ ] Screenshot capture after filling
- [ ] Automatic selector updates via AI inspection

## Development Guidelines

### Code Style
- Use Rust conventions (snake_case, descriptive names)
- Add doc comments for public functions
- Use `log::info!`, `log::warn!`, `log::error!` for logging
- Handle errors explicitly, don't unwrap in production code

### Testing Strategy
- Write unit tests for core logic
- Use `#[cfg(test)]` modules
- Test error cases
- Manual testing via TESTING.md for integration tests
- No automated UI tests yet (Phase 1-2)

### Git Workflow
- Small, focused commits
- Descriptive commit messages
- One phase per PR (or major feature)
- Update AGENTS.md when phase is complete

### Documentation
- Update TESTING.md with new features
- Update AGENTS.md when architectural decisions are made
- Add inline comments for complex logic
- Keep README.md user-facing and simple

## Common Pitfalls to Avoid

1. **Memory Loading All Files:**
   - ❌ Don't load entire file tree into memory
   - ✅ Query database on-demand

2. **Blocking UI:**
   - ❌ Don't make synchronous IPC calls
   - ✅ Use async/await in frontend

3. **Database Locks:**
   - ❌ Don't hold locks during long operations
   - ✅ Release lock between operations

4. **Path Handling:**
   - ❌ Don't use platform-specific path separators
   - ✅ Use PathBuf and to_string_lossy()

5. **Error Swallowing:**
   - ❌ Don't silently ignore errors
   - ✅ Log warnings, propagate critical errors

6. **Browser Context Closing (Phase 6):**
   - ❌ Don't call `context.close()` in sidecar
   - ✅ Exit with `process.exit(0)` to keep browser open

## Questions for Next Agent

When starting Phase 2, consider:
1. Should progress events be throttled (e.g., max 10/second)?
2. What should happen if indexing is cancelled mid-way?
3. Should we support excluding patterns (e.g., node_modules)?
4. How to handle very large files (>1GB)?
5. Should we store file hashes for integrity checking?

When continuing Phase 6 work, consider:
1. How to bundle the sidecar with the production build?
2. Should we add reconnection capability to running browsers?
3. How to handle automatic selector updates when AI interfaces change?
4. Should we support saving browser sessions for later use?
5. How to handle rate limiting from AI interfaces?

## Resources

- [Tauri Documentation](https://tauri.app/)
- [rusqlite Documentation](https://docs.rs/rusqlite/)
- [walkdir Crate](https://docs.rs/walkdir/)
- [rayon Crate](https://docs.rs/rayon/)
- [Playwright Documentation](https://playwright.dev/)
- [Playwright Node.js API](https://playwright.dev/docs/api/class-playwright)
- Original Blueprint: PLAN.md
- Testing Guide: TESTING.md

## Contact/Notes

This is an agent-developed project. Each phase should be:
1. Independently testable
2. Well-documented
3. Incrementally valuable
4. Following the blueprint in PLAN.md

Good luck with Phase 2! 🚀
