# AI Context Collector

A cross-platform desktop application for collecting and organizing code context for AI assistants. Built with Tauri 2.0, Rust, and React.

## Features

### Phase 3 - Virtual Tree UI ✅
- **Virtual Scrolling**: Handle 100k+ files with smooth 60fps scrolling
- **Lazy Loading**: Load file tree nodes on-demand from SQLite database
- **Smart Checkboxes**: Parent-child state propagation with indeterminate states
- **Real-time Search**: Debounced search with 150ms delay
- **File Indexing**: Index folders with fingerprint-based change detection
- **Dark Theme**: VS Code-inspired UI

### Phase 1 - Core Infrastructure ✅
- SQLite database for file metadata storage
- Recursive file system traversal
- Efficient database queries with indices
- Cross-platform support (Windows, macOS, Linux)

### Phase 2 - Parallel Traversal ✅
- Parallel file system traversal with walkdir + rayon
- Batch SQLite inserts (1000 records/transaction)
- Progress reporting via Tauri events
- Error recovery and symlink handling
- Memory-efficient design

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- [Rust](https://rustup.rs/)
- Platform-specific dependencies (see [TESTING.md](TESTING.md))

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Usage

1. **Add Folders**: Click "Add Folder" to select a directory to index
2. **Browse Files**: Expand folders by clicking the arrow icon
3. **Select Files**: Check files and folders to select them
4. **Search**: Use the search bar to find specific files or folders

## Project Structure

```
ai-copy-paste/
├── src/                    # React frontend
│   ├── components/
│   │   └── FileTree/       # Virtual tree component
│   └── types.ts            # TypeScript types
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Tauri IPC commands
│       └── db/             # Database layer
├── PLAN.md                 # Technical blueprint
├── TESTING.md              # Testing guide
└── AGENTS.md               # Development context
```

## Architecture

- **Frontend**: React 19 with TypeScript
- **Backend**: Rust with Tauri 2.0
- **Database**: SQLite with rusqlite
- **Virtual Scrolling**: TanStack Virtual
- **UI Theme**: Dark mode inspired by VS Code

## Development

See [TESTING.md](TESTING.md) for detailed testing instructions and [AGENTS.md](AGENTS.md) for development context.

## Roadmap

- ✅ Phase 1: Core infrastructure (SQLite, basic commands)
- ✅ Phase 2: Parallel file traversal with batch inserts
- ✅ Phase 3: Virtual tree UI with lazy loading
- 🔄 Phase 4: Text extraction (PDF, DOCX, source files)
- 📋 Phase 5: Token counting and prompt building
- 📋 Phase 6: Browser automation
- 📋 Phase 7: History and persistence
- 📋 Phase 8: Context menu installers

See [PLAN.md](PLAN.md) for the complete technical blueprint.

## Technologies

- [Tauri](https://tauri.app/) - Desktop application framework
- [React](https://react.dev/) - UI framework
- [Rust](https://www.rust-lang.org/) - Backend language
- [SQLite](https://www.sqlite.org/) - Database
- [TanStack Virtual](https://tanstack.com/virtual) - Virtual scrolling
- [Vite](https://vitejs.dev/) - Build tool

## License

MIT

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
