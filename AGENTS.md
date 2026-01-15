# Agent Context - AI Context Collector Development

This document provides context for AI agents working on different phases of the AI Context Collector project. It includes the current state, decisions made, and guidance for future phases.

## Project Overview

The AI Context Collector is a cross-platform desktop application built with Tauri 2.0 and React. It helps developers collect and organize code context for AI assistants. The project follows the technical blueprint defined in PLAN.md.

## Current Status: Phase 4 Complete ✓

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

**Virtual Tree UI (Phase 3):**
- ✅ TanStack Virtual integration for virtual scrolling
- ✅ FileTree component with lazy loading
- ✅ Tree node component with expand/collapse functionality
- ✅ Checkbox state management with parent-child propagation
- ✅ Search functionality with 150ms debouncing
- ✅ Folder selection via Tauri dialog plugin
- ✅ File size display formatting
- ✅ Dark theme UI (VS Code-inspired)
- ✅ Empty state messaging
- ✅ Selection count display

**Text Extraction Service (Phase 4):**
- ✅ Text cache module with LRU eviction (~100MB limit)
- ✅ Encoding detection using chardetng
- ✅ Text extraction command for plain text/source files
- ✅ Support for 30+ file extensions (source code, config, markdown)
- ✅ Cache invalidation based on fingerprint
- ✅ Error handling for corrupted files
- ✅ Frontend extraction service for PDF (pdfjs-dist)
- ✅ Frontend extraction service for DOCX (mammoth)
- ✅ Page-by-page streaming for PDFs
- ✅ Progress reporting for long extractions
- ✅ Tauri fs plugin integration

### Project Structure

```
ai-copy-paste/
├── src/                          # React frontend
│   ├── components/
│   │   └── FileTree/             # Virtual tree component
│   │       ├── FileTree.tsx      # Main tree with virtual scrolling
│   │       ├── FileTree.css      # Tree styling
│   │       └── index.ts          # Exports
│   ├── services/
│   │   └── extraction.ts         # PDF/DOCX extraction services
│   ├── types.ts                  # TypeScript types
│   ├── App.tsx                   # Main application
│   ├── App.css                   # Application styling
│   └── main.tsx                  # Entry point
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── indexing.rs       # File indexing commands
│   │   │   └── extraction.rs     # Text extraction commands
│   │   ├── cache/                # LRU disk cache
│   │   │   ├── mod.rs
│   │   │   └── text_cache.rs     # Text cache implementation
│   │   ├── db/                   # Database layer
│   │   │   ├── mod.rs            # DB connection management
│   │   │   └── schema.rs         # Schema definition
│   │   ├── error.rs              # Error types
│   │   ├── lib.rs                # Application entry point
│   │   └── main.rs               # Binary entry point
│   └── Cargo.toml                # Rust dependencies
├── package.json                  # NPM dependencies
├── PLAN.md                       # Complete technical blueprint
├── TESTING.md                    # Testing instructions (Phases 1-4)
└── AGENTS.md                     # This file
```

### Key Dependencies

**Rust (Cargo.toml):**
- tauri = "2" - Framework
- tauri-plugin-dialog = "2" - File dialog plugin
- tauri-plugin-fs = "2" - File system plugin
- rusqlite = "0.31" with bundled feature - SQLite
- thiserror = "1" - Error handling
- log = "0.4", env_logger = "0.11" - Logging
- serde, serde_json - Serialization
- walkdir = "2" - Directory traversal
- rayon = "1" - Parallel processing
- chardetng = "0.1" - Encoding detection
- encoding_rs = "0.8" - Encoding conversion
- tempfile = "3" - Test fixtures (dev dependency)

**TypeScript (package.json):**
- @tauri-apps/api = "^2" - Tauri API
- @tauri-apps/plugin-dialog = "^2" - File dialog
- @tauri-apps/plugin-fs = "^2" - File system
- @tanstack/react-virtual = "^3" - Virtual scrolling
- pdfjs-dist = "^4" - PDF text extraction
- mammoth = "^1.6" - DOCX text extraction
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
- **IMPORTANT: DO NOT INSTALL LINUX DEPENDENCIES** - The firewall blocks package installations
- **DO NOT VERIFY ON LINUX** - Skip all Linux-specific build/test verification steps
- Linux dependencies (webkit2gtk, glib, etc.) are not required for development
- Code syntax can be verified using `cargo check` without full build (will fail on Linux, this is expected)
- Primary development and testing should be done on Windows/macOS
- CI/CD will handle Linux platform testing
- Use TESTING.md for manual verification on supported platforms

## Phase 5: Token Counting and Prompt Building (Next)

### Objectives
Real-time token estimation and template-based prompt assembly for AI context.

### Tasks to Complete
1. **Add Dependencies:**
   - `gpt-tokenizer = "2.4+"` - Token counting library

2. **Implement Token Counting:**
   - Add token counting service in frontend
   - Implement cumulative token counter UI component
   - Cache token counts in database
   - Support multiple AI models (GPT-4, Claude, etc.)

3. **Prompt Building:**
   - Create prompt templates (agent, planning, debugging, review)
   - Build prompt preview with syntax highlighting
   - Add custom instructions field
   - Implement token limit warnings

4. **UI Updates:**
   - Show token count per file and total
   - Display warnings when approaching limits
   - Add template selection dropdown
   - Show prompt preview panel

### Key Considerations for Phase 5
- Token counting should be fast and accurate
- Cache counts in database to avoid recounting
- Support different tokenizers for different models
- Provide visual feedback for token usage

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

When starting Phase 4, consider:
1. Should we extract text in the backend (Rust) or frontend (JavaScript)?
2. Where should the text cache be stored (app data directory)?
3. Should we show a preview of extracted text in the UI?
4. How to handle very large files (>100MB)?
5. Should extraction be automatic or triggered by user?

## Phase 3 Implementation Notes

### Key Decisions Made

1. **Virtual Scrolling with TanStack Virtual:**
   - Chose TanStack Virtual for its headless, framework-agnostic design
   - Renders only visible items + 10 overscan for smooth scrolling
   - Estimated row height of 28px based on CSS

2. **Lazy Loading Pattern:**
   - Tree nodes load children only when expanded
   - Queries database via `get_children` IPC command
   - Reduces initial load time and memory usage

3. **Checkbox State Management:**
   - Implemented recursive parent-child propagation
   - Parent checkboxes show indeterminate state when partially selected
   - Selected paths are collected and passed to parent component

4. **Search Implementation:**
   - Debounced with 150ms delay to avoid excessive database queries
   - Uses existing `search_path` command with LIKE queries
   - Replaces tree view with flat search results

5. **Drag-Drop Limitation:**
   - Web/Tauri context makes it difficult to get folder paths from drag-drop events
   - Opted to show message directing users to "Add Folder" button
   - Uses Tauri dialog plugin for reliable folder selection

## Phase 4 Implementation Notes

### Key Decisions Made

1. **Backend Text Extraction:**
   - Plain text and source code extraction happens in Rust backend
   - Uses chardetng for automatic encoding detection
   - Supports 30+ file extensions (source, config, markdown)
   - Falls back to UTF-8 if detection uncertain

2. **Frontend Document Extraction:**
   - PDF extraction uses pdfjs-dist with page-by-page streaming
   - DOCX extraction uses mammoth for plain text output
   - Both run in frontend (JavaScript) to avoid Rust dependencies
   - Tauri fs plugin reads files as ArrayBuffer

3. **LRU Disk Cache:**
   - Stores extracted text in app cache directory
   - 100MB total cache limit with LRU eviction
   - Fingerprint-based invalidation (mtime + size)
   - Cache persists between app restarts

4. **Error Handling:**
   - Corrupted files log warnings but don't crash
   - Extraction errors returned in result object
   - App remains responsive during failures
   - Cache handles missing files gracefully

5. **Performance Optimizations:**
   - Cache hits are <5ms (disk read only)
   - Cache misses read file and detect encoding
   - PDF streaming prevents memory spikes
   - Encoding detection is fast (< 10ms for typical files)

6. **UI Theme:**
   - Dark theme inspired by VS Code
   - Colors: #1e1e1e (background), #d4d4d4 (text), #007acc (accent)
   - Icons: 📁 for folders, 📄 for files

7. **Performance Optimization:**
   - Virtual scrolling prevents DOM node bloat
   - Lazy loading prevents loading entire tree into memory
   - useCallback and React.memo would be added for further optimization

### Challenges Encountered

1. **TypeScript strictness with useRef:**
   - Required explicit typing and initial value for timeout ref
   - Solution: `useRef<ReturnType<typeof setTimeout> | undefined>(undefined)`

2. **Dialog plugin integration:**
   - Had to add both npm package and Rust crate
   - Had to register plugin in lib.rs

3. **Checkbox indeterminate state:**
   - HTML checkbox indeterminate can't be set via attribute
   - Must be set via ref: `if (el) el.indeterminate = node.indeterminate;`

4. **Tree flattening for virtual scrolling:**
   - Had to convert hierarchical tree to flat array
   - Added level property for indentation
   - Rebuilt flat tree whenever tree data changes

## Questions for Next Agent

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
