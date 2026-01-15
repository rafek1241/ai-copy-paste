# AI Context Collector

A cross-platform desktop application built with Tauri 2.0 and React for collecting and organizing code context for AI assistants.

## Current Status: Phase 2 Complete ✓

### Implemented Features

**Phase 1: Core Infrastructure**
- ✅ Tauri 2.0 + React + TypeScript setup
- ✅ SQLite database with file indexing
- ✅ Basic IPC commands (index_folder, get_children, search_path)
- ✅ Error handling and logging framework

**Phase 2: File Traversal Engine**
- ✅ Parallel file system traversal (walkdir + rayon)
- ✅ Batch SQLite inserts (1000 records/transaction)
- ✅ Real-time progress reporting via Tauri events
- ✅ Symlink handling and permission error recovery
- ✅ Comprehensive unit tests
- ✅ Demo UI with progress tracking

### Performance

- **Target:** Index 100k files in < 15 seconds
- **Memory:** Efficient design, no in-memory tree loading
- **Scalability:** Handles large directories with ease

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://rustup.rs/)
- Platform-specific dependencies (see [TESTING.md](TESTING.md))

### Installation

```bash
# Clone the repository
git clone https://github.com/rafek1241/ai-copy-paste.git
cd ai-copy-paste

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Building

```bash
# Build for production
npm run tauri build
```

## Testing

See [TESTING.md](TESTING.md) for comprehensive testing instructions including:
- Unit tests (`cargo test`)
- Integration tests via browser console
- Performance benchmarks
- Manual testing scenarios

## Documentation

- **[PLAN.md](PLAN.md)** - Complete technical blueprint (8 phases)
- **[AGENTS.md](AGENTS.md)** - Context for AI agents, implementation notes
- **[TESTING.md](TESTING.md)** - Testing guide for all phases

## Project Structure

```
ai-copy-paste/
├── src/                    # React frontend
│   └── App.tsx            # Demo UI with progress tracking
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/      # Tauri IPC commands
│   │   ├── db/           # SQLite database layer
│   │   └── error.rs      # Error handling
│   └── Cargo.toml        # Rust dependencies
└── package.json          # NPM dependencies
```

## Roadmap

- [x] **Phase 1:** Core infrastructure
- [x] **Phase 2:** File traversal engine
- [ ] **Phase 3:** Virtual tree UI with lazy loading
- [ ] **Phase 4:** Text extraction (PDF, DOCX, source files)
- [ ] **Phase 5:** Token counting and prompt building
- [ ] **Phase 6:** Browser automation sidecar
- [ ] **Phase 7:** History and persistence
- [ ] **Phase 8:** Context menu installers

See [PLAN.md](PLAN.md) for detailed phase descriptions.

## Technology Stack

- **Framework:** Tauri 2.0 (Rust + WebView)
- **Frontend:** React 19 + TypeScript + Vite
- **Database:** SQLite with rusqlite
- **Parallel Processing:** rayon + walkdir
- **Bundle Size:** 3-4MB (vs 300MB+ Electron)

## Contributing

This is an AI agent-developed project. Each phase is independently testable and follows the blueprint in PLAN.md.

## License

See [LICENSE](LICENSE)

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
