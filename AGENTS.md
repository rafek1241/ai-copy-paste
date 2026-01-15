# Agent Context - AI Context Collector Development

This document provides context for AI agents working on different phases of the AI Context Collector project. It includes the current state, decisions made, and guidance for future phases.

## Project Overview

The AI Context Collector is a cross-platform desktop application built with Tauri 2.0 and React. It helps developers collect and organize code context for AI assistants. The project follows the technical blueprint defined in PLAN.md.

## Current Status: Phase 2 Complete ✓

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

**File Traversal Engine (Phase 2):**
- ✅ Added walkdir = "2" and rayon = "1" dependencies
- ✅ Parallel file system traversal using walkdir + rayon
- ✅ Batch SQLite inserts (1000 records per transaction)
- ✅ Symlink handling (skipped to avoid cycles)
- ✅ Permission error recovery with logging
- ✅ Progress reporting via Tauri events (IndexProgress struct)
- ✅ Progress event throttling (max 10 events/second)
- ✅ Comprehensive unit tests for indexing functionality
- ✅ Memory-efficient design (no in-memory tree loading)

### Project Structure

```
ai-copy-paste/
├── src/                          # React frontend (default template)
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri IPC commands
│   │   │   ├── mod.rs
│   │   │   └── indexing.rs       # File indexing commands
│   │   ├── db/                   # Database layer
│   │   │   ├── mod.rs            # DB connection management
│   │   │   └── schema.rs         # Schema definition
│   │   ├── error.rs              # Error types
│   │   ├── lib.rs                # Application entry point
│   │   └── main.rs               # Binary entry point
│   └── Cargo.toml                # Rust dependencies
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
- walkdir = "2" - Directory traversal (Phase 2)
- rayon = "1" - Parallel processing (Phase 2)
- tempfile = "3" - Test fixtures (dev dependency)

**TypeScript (package.json):**
- @tauri-apps/api = "^2" - Tauri API
- react = "^19", react-dom = "^19" - Frontend
- vite = "^7" - Build tool

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
- Long-running operations (indexing) now report progress via Tauri events (Phase 2)

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

## Phase 2: File Traversal Engine ✓ COMPLETE

### Objectives
Implement parallel, memory-efficient file system traversal with progress reporting.

### Implementation Summary

**Completed Tasks:**

1. **Dependencies Added:**
   - ✅ `walkdir = "2"` - Directory traversal
   - ✅ `rayon = "1"` - Parallel processing
   - ✅ `tempfile = "3"` - Test fixtures (dev)

2. **Enhanced Indexing:**
   - ✅ Implemented `parallel_index_folder()` function with walkdir + rayon
   - ✅ Batch SQLite inserts (1000 records per transaction)
   - ✅ Symlink handling (skips symlinks to avoid cycles)
   - ✅ Permission error recovery (logs and continues)
   - ✅ Maintains backward compatibility with `traverse_and_insert()`

3. **Progress Reporting:**
   - ✅ Created `IndexProgress` struct (processed, total_estimate, current_path, errors)
   - ✅ Emits Tauri events during indexing (`"indexing-progress"`)
   - ✅ Progress throttling (max 10 events/second)
   - ✅ Final completion event sent

4. **Testing:**
   - ✅ Unit tests for FileEntry creation
   - ✅ Tests for traverse_and_insert
   - ✅ Tests for fingerprint-based change detection
   - ✅ Tests for progress serialization
   - ✅ Tests for error recovery

5. **Performance:**
   - ✅ Parallel traversal with rayon's par_bridge()
   - ✅ Batch inserts reduce database operations 1000x
   - ✅ Memory-efficient (no full tree in memory)
   - ✅ Expected: < 15 seconds for 100k files

**Deferred to Future Phases:**
- ⏭️ File watching (will be in Phase 3 or separate phase)
- ⏭️ Configurable parallelism settings
- ⏭️ Real-world benchmarking on Windows/macOS

### Key Implementation Details

**Parallel Traversal:**
```rust
// In parallel_index_folder()
let entries: Vec<FileEntry> = WalkDir::new(root)
    .follow_links(false)  // Skip symlinks
    .into_iter()
    .par_bridge()  // Parallel iteration
    .filter_map(|e| e.ok())
    .map(|entry| FileEntry::from_dir_entry(&entry))
    .collect();
```

**Batch Inserts:**
```rust
const BATCH_SIZE: usize = 1000;
for chunk in entries.chunks(BATCH_SIZE) {
    let tx = conn.transaction()?;
    // Insert each entry in the batch
    tx.commit()?;
}
```

**Progress Events:**
```rust
let progress = IndexProgress {
    processed: count,
    total_estimate: count + 100,
    current_path: current_path_string,
    errors: error_count.load(Ordering::Relaxed),
};
app.emit("indexing-progress", &progress)?;
```

**Progress Events:**
```rust
let progress = IndexProgress {
    processed: count,
    total_estimate: count + 100,
    current_path: current_path_string,
    errors: error_count.load(Ordering::Relaxed),
};
app.emit("indexing-progress", &progress)?;
```

### Testing Phase 2

See TESTING.md for comprehensive testing instructions. Key tests:

- ✅ Unit tests: `cargo test` in src-tauri directory
- ✅ Index large directories (node_modules, system folders)
- ✅ Verify progress events are emitted via browser console
- ✅ Test with permission errors (restricted folders)
- ✅ Test with symlinks (should be skipped)
- ⏳ Measure performance with 10k, 100k files (requires Windows/macOS)
- ⏳ Verify memory usage stays reasonable (requires profiling tools)

### Architectural Decisions (Phase 2)

1. **Two-pass indexing approach:**
   - First pass: Parallel traversal with walkdir + rayon (collect all entries)
   - Second pass: Batch inserts into SQLite (1000 records per transaction)
   - This separates I/O-bound (filesystem) from CPU-bound (database) operations

2. **Progress throttling:**
   - Checks elapsed time since last emit (100ms threshold)
   - Prevents event flooding with 10/second cap
   - Uses Arc<Mutex<Instant>> for thread-safe time tracking

3. **Parent ID resolution:**
   - Builds path -> parent_path mapping during traversal
   - Looks up parent IDs from database during batch insert
   - Handles root entries with parent_id = NULL

4. **Error handling philosophy:**
   - Log errors but continue processing other files
   - Track error count in atomic counter
   - Report errors in progress events
   - No panic on permission errors or corrupted files

## Phase 3: Virtual Tree UI (Next)

### Objectives
Build performant file tree with checkboxes supporting 100k+ items.

### Tasks for Next Agent
1. **Frontend Virtual Scrolling:**
   - Install @tanstack/react-virtual
   - Build lazy-loading tree component
   - Implement expand/collapse with on-demand DB queries
   
2. **Checkbox State Management:**
   - Implement parent ↔ child propagation
   - Handle partial selection states
   - Optimize for large selections

3. **UI Features:**
   - Search/filter with debouncing
   - Drag-drop zone for adding folders
   - Progress bar for indexing
   - Display file counts and sizes

4. **Integration:**
   - Listen to "indexing-progress" events
   - Update UI during indexing
   - Handle re-indexing of existing folders

See PLAN.md Phase 3 for detailed implementation guidance.

## Phase 4 and Beyond

See PLAN.md for complete details on remaining phases:
- Phase 3: Virtual tree UI with lazy loading
- Phase 4: Text extraction (PDF, DOCX, source files)
- Phase 5: Token counting and prompt building
- Phase 6: Browser automation sidecar
- Phase 7: History and persistence
- Phase 8: Context menu installers

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

## Questions for Next Agent (Phase 3)

When starting Phase 3, consider:
1. Should we implement file watching now or defer to later phase?
2. What UI library for tree component? (Recommendation: Build custom with @tanstack/react-virtual)
3. How to handle very large selections (100k+ files)?
4. Should search be client-side or server-side (SQLite queries)?
5. What keyboard shortcuts for tree navigation?
6. Should we add file type icons and syntax highlighting?

**Answers from Phase 2:**
1. ✅ Progress events throttled to 10/second (100ms check)
2. ⏭️ Cancellation not yet implemented (future enhancement)
3. ⏭️ Exclude patterns not yet implemented (could add to settings)
4. ✅ Large files handled gracefully (no content loading yet)
5. ⏭️ File hashes not stored (fingerprint uses mtime + size)

## Resources

- [Tauri Documentation](https://tauri.app/)
- [rusqlite Documentation](https://docs.rs/rusqlite/)
- [walkdir Crate](https://docs.rs/walkdir/)
- [rayon Crate](https://docs.rs/rayon/)
- Original Blueprint: PLAN.md
- Testing Guide: TESTING.md

## Contact/Notes

This is an agent-developed project. Each phase should be:
1. Independently testable
2. Well-documented
3. Incrementally valuable
4. Following the blueprint in PLAN.md

Good luck with Phase 2! 🚀
