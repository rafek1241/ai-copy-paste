# Agent Context - AI Context Collector Development

This document provides context for AI agents working on different phases of the AI Context Collector project. It includes the current state, decisions made, and guidance for future phases.

## Project Overview

The AI Context Collector is a cross-platform desktop application built with Tauri 2.0 and React. It helps developers collect and organize code context for AI assistants. The project follows the technical blueprint defined in PLAN.md.

## Current Status: Phase 3 Complete ✓

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

### Project Structure

```
ai-copy-paste/
├── src/                          # React frontend
│   ├── components/
│   │   └── FileTree/             # Virtual tree component
│   │       ├── FileTree.tsx      # Main tree with virtual scrolling
│   │       ├── FileTree.css      # Tree styling
│   │       └── index.ts          # Exports
│   ├── types.ts                  # TypeScript types
│   ├── App.tsx                   # Main application
│   ├── App.css                   # Application styling
│   └── main.tsx                  # Entry point
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
├── TESTING.md                    # Testing instructions (Phases 1-3)
└── AGENTS.md                     # This file
```

### Key Dependencies

**Rust (Cargo.toml):**
- tauri = "2" - Framework
- tauri-plugin-dialog = "2" - File dialog plugin
- rusqlite = "0.31" with bundled feature - SQLite
- thiserror = "1" - Error handling
- log = "0.4", env_logger = "0.11" - Logging
- serde, serde_json - Serialization

**TypeScript (package.json):**
- @tauri-apps/api = "^2" - Tauri API
- @tauri-apps/plugin-dialog = "^2" - File dialog
- @tanstack/react-virtual = "^3" - Virtual scrolling
- react = "^19", react-dom = "^19" - Frontend
- vite = "^7" - Build tool

**Rust (Cargo.toml):**
- tauri = "2" - Framework
- tauri-plugin-dialog = "2" - File dialog plugin
- rusqlite = "0.31" with bundled feature - SQLite
- thiserror = "1" - Error handling
- log = "0.4", env_logger = "0.11" - Logging
- serde, serde_json - Serialization

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

## Phase 4: Text Extraction Service (Next)

### Objectives
Extract text from PDF, DOCX, Markdown, and source files with disk-based caching.

### Tasks to Complete
1. **Add Dependencies:**
   - `pdfjs-dist = "4.x"` - PDF extraction
   - `mammoth = "1.x"` - DOCX extraction

2. **Implement Text Extraction:**
   - Create extraction service in frontend
   - Implement PDF page-by-page streaming
   - Implement DOCX to plain text conversion
   - Handle encoding detection for source files
   - Build disk-based LRU cache (~100MB limit)

3. **Progress Reporting:**
   - Show extraction progress in UI
   - Handle corrupted files gracefully
   - Display extraction status per file

4. **Cache Management:**
   - Store extracted text on disk
   - Implement LRU eviction policy
   - Invalidate cache when files change

### Key Considerations for Phase 4
- Text extraction runs on frontend (JavaScript) not backend (Rust)
- Use streaming for large files to avoid memory issues
- Cache extracted text to avoid re-extraction
- Show progress during extraction for user feedback

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
