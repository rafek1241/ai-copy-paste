# Agent Context - AI Context Collector Development

This document provides context for AI agents working on different phases of the AI Context Collector project. It includes the current state, decisions made, and guidance for future phases.

## Project Overview

The AI Context Collector is a cross-platform desktop application built with Tauri 2.0 and React. It helps developers collect and organize code context for AI assistants. The project follows the technical blueprint defined in PLAN.md.

## Current Status: Phase 1 & Phase 5 Complete ✓

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

**Token Counting and Prompt Building (Phase 5):**
- ✅ Token counting using gpt-tokenizer
- ✅ 6 built-in prompt templates (agent, planning, debugging, review, documentation, testing)
- ✅ Template variable substitution system
- ✅ Prompt building from selected files
- ✅ New IPC commands:
  - `get_templates()` - Get all available prompt templates
  - `get_file_content(file_id)` - Get content of a single file
  - `get_file_contents(file_ids)` - Get content of multiple files
  - `build_prompt_from_files(request)` - Build prompt from template and files
- ✅ TokenCounter React component with visual indicators
- ✅ PromptBuilder React component with full UI
- ✅ Support for 9 AI models with correct token limits
- ✅ Token limit warnings and color-coded progress bar
- ✅ Copy to clipboard functionality
- ✅ Comprehensive documentation (PHASE5.md)

### Project Structure

```
ai-copy-paste/
├── src/                          # React frontend
│   ├── components/               # React components
│   │   ├── TokenCounter.tsx      # Token counter with visual indicators
│   │   └── PromptBuilder.tsx     # Prompt building interface
│   ├── services/                 # Service layer
│   │   ├── tokenizer.ts          # Token counting utilities
│   │   └── prompts.ts            # Prompt API wrapper
│   └── App.tsx                   # Main application component
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── indexing.rs       # File indexing commands
│   │   │   └── prompts.rs        # Prompt and file content commands
│   │   ├── db/                   # Database layer
│   │   │   ├── mod.rs            # DB connection management
│   │   │   └── schema.rs         # Schema definition
│   │   ├── templates.rs          # Prompt template system
│   │   ├── error.rs              # Error types
│   │   ├── lib.rs                # Application entry point
│   │   └── main.rs               # Binary entry point
│   └── Cargo.toml                # Rust dependencies
├── package.json                  # NPM dependencies
├── PLAN.md                       # Complete technical blueprint
├── TESTING.md                    # Testing instructions
├── PHASE5.md                     # Phase 5 documentation
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
- gpt-tokenizer = "^2.4" - Token counting (Phase 5)

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

## Phase 3 and Beyond

See PLAN.md for complete details on remaining phases:
- Phase 2: File traversal engine (pending)
- Phase 3: Virtual tree UI with lazy loading (pending)
- Phase 4: Text extraction (PDF, DOCX, source files) (pending)
- **Phase 5: Token counting and prompt building (COMPLETED ✓)** - See details below
- Phase 6: Browser automation sidecar (pending)
- Phase 7: History and persistence (pending)
- Phase 8: Context menu installers (pending)

## Phase 5 Implementation Summary

Phase 5 has been successfully completed! Key achievements:

### Backend Components
- **templates.rs**: 6 built-in prompt templates with variable substitution
- **commands/prompts.rs**: Commands for template and file operations
  - `get_templates()` - Returns all template definitions
  - `get_file_content(file_id)` - Reads single file
  - `get_file_contents(file_ids)` - Batch file reading
  - `build_prompt_from_files(request)` - Assembles prompts

### Frontend Components
- **services/tokenizer.ts**: Token counting with gpt-tokenizer
  - Support for 9 AI models (GPT-4o, Claude, Gemini, etc.)
  - Color-coded usage indicators
- **services/prompts.ts**: API wrapper for Tauri commands
- **components/TokenCounter.tsx**: Real-time token counter with visual progress
- **components/PromptBuilder.tsx**: Complete prompt building interface

### Features Delivered
✅ Real-time token counting with 300ms debouncing
✅ Support for 9 AI models with accurate token limits
✅ 6 built-in prompt templates (agent, planning, debugging, review, docs, testing)
✅ Custom instructions support
✅ Visual token limit warnings (color-coded progress bar)
✅ Prompt preview and copy to clipboard
✅ Comprehensive error handling
✅ Full documentation in PHASE5.md

**Testing:** See TESTING.md for Phase 5 testing procedures.
**Documentation:** See PHASE5.md for detailed architecture and usage guide.

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

## Questions for Next Agent

When starting Phase 2, consider:
1. Should progress events be throttled (e.g., max 10/second)?
2. What should happen if indexing is cancelled mid-way?
3. Should we support excluding patterns (e.g., node_modules)?
4. How to handle very large files (>1GB)?
5. Should we store file hashes for integrity checking?

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
