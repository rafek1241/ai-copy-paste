# Agent Context - AI Context Collector Development

This document provides context for AI agents working on different phases of the AI Context Collector project. It includes the current state, decisions made, and guidance for future phases.

## Project Overview

The AI Context Collector is a cross-platform desktop application built with Tauri 2.0 and React. It helps developers collect and organize code context for AI assistants. The project follows the technical blueprint defined in PLAN.md.

## Current Status: Phase 1 Complete ✓

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
- Phase 3: Virtual tree UI with lazy loading
- Phase 4: Text extraction (PDF, DOCX, source files)
- Phase 5: Token counting and prompt building
- Phase 6: Browser automation sidecar
- Phase 7: History and persistence
- Phase 8: Context menu installers ✓ (Complete)

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

## Phase 8: Context Menu Installers (Complete) ✓

### Objectives
Implement platform-specific shell integration for Windows, macOS, and Linux file managers.

### What Was Implemented

**Windows Integration:**
- ✅ Registry file (`context-menu.reg`) for manual installation
- ✅ Uninstall registry file (`uninstall-context-menu.reg`)
- ✅ NSIS installer script (`setup.nsi`) with full automation
- ✅ Support for files, folders, and directory backgrounds
- ✅ Comprehensive documentation with troubleshooting

**macOS Integration:**
- ✅ Finder Sync Extension implementation (`FinderSync.m`)
- ✅ Extension metadata and configuration (`Info.plist`)
- ✅ Security entitlements (`entitlements.plist`)
- ✅ Code signing script (`sign.sh`)
- ✅ Notarization script (`notarize.sh`)
- ✅ DMG creation script (`create-dmg.sh`)
- ✅ Comprehensive documentation with Xcode integration guide

**Linux Integration:**
- ✅ Nautilus extension for GNOME (`nautilus-extension.py`)
- ✅ Dolphin service menu for KDE (`dolphin.desktop`)
- ✅ Nemo action file for Cinnamon (`nemo.nemo_action`)
- ✅ Automated installation script with DE detection (`install.sh`)
- ✅ Comprehensive documentation with troubleshooting

**Documentation:**
- ✅ Main installers README with overview and quick start
- ✅ Platform-specific READMEs with detailed instructions
- ✅ Security considerations for each platform
- ✅ Debugging and troubleshooting guides
- ✅ Distribution checklist

### Directory Structure Created

```
installers/
├── README.md                          # Main documentation
├── windows/
│   ├── README.md
│   ├── context-menu.reg
│   ├── uninstall-context-menu.reg
│   └── setup.nsi
├── macos/
│   ├── README.md
│   ├── FinderSync.m
│   ├── Info.plist
│   ├── entitlements.plist
│   ├── sign.sh
│   ├── notarize.sh
│   └── create-dmg.sh
└── linux/
    ├── README.md
    ├── nautilus-extension.py
    ├── dolphin.desktop
    ├── nemo.nemo_action
    └── install.sh
```

### Key Implementation Details

**Windows:**
- Registry-based approach for simplicity and compatibility
- Supports Windows 7, 8, 10, and 11
- NSIS installer includes uninstaller and Add/Remove Programs integration
- Context menu appears under "Show more options" on Windows 11 (registry method)

**macOS:**
- Finder Sync Extension provides native integration
- Requires Xcode to build the extension
- Code signing and notarization scripts included for distribution
- User must enable extension in System Settings

**Linux:**
- Supports three major desktop environments (GNOME, KDE, Cinnamon)
- Auto-detection of desktop environment
- User-level installation (no root required)
- Python-based Nautilus extension with compatibility for both 3.x and 4.x

### Application Integration Required

The main Tauri application needs to handle command-line arguments:

```rust
// In main.rs or lib.rs
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let args: Vec<String> = std::env::args().skip(1).collect();
            if !args.is_empty() {
                // Process paths received from context menu
                app.emit_all("paths-received", args).ok();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Testing Phase 8

For each platform:
1. Build the application in release mode
2. Install context menu integration
3. Right-click on files/folders in file manager
4. Verify "Send to AI Context Collector" appears
5. Click menu item and verify app launches with correct paths
6. Test with multiple files, folders, special characters
7. Test uninstallation

### Known Limitations

**Windows:**
- Registry approach places menu under "Show more options" in Windows 11
- For top-level Windows 11 integration, would need IExplorerCommand implementation

**macOS:**
- Requires separate Xcode project for Finder Sync Extension
- Tauri doesn't natively support app extensions
- Requires Apple Developer account for distribution (code signing + notarization)
- Users must manually enable extension in System Settings

**Linux:**
- Nautilus extension requires python-nautilus package
- Different file managers have different integration methods
- Each user must install separately (no system-wide installation)

### Future Enhancements

Potential improvements for future agents:
1. **Windows 11 Native:** Implement IExplorerCommand for top-level menu
2. **macOS Automation:** Script to build Finder extension from Tauri build
3. **Linux Packages:** Create .deb and .rpm packages with auto-installation
4. **Multi-selection:** Enhanced handling of multiple file selections
5. **Deep Links:** Support app-specific URL scheme (ai-context-collector://)

## Contact/Notes

This is an agent-developed project. Each phase should be:
1. Independently testable
2. Well-documented
3. Incrementally valuable
4. Following the blueprint in PLAN.md

Phase 8 is now complete! All platform-specific context menu installers are implemented with comprehensive documentation. 🚀
