# AI Context Collector

A cross-platform desktop application for collecting and organizing code context for AI assistants, built with Tauri 2.0 and React.

## Current Status

**Phase 1**: ✅ Core infrastructure with SQLite database  
**Phase 6**: ✅ Browser automation with Playwright (sidecar)

See [PLAN.md](PLAN.md) for the complete technical blueprint and [AGENTS.md](AGENTS.md) for implementation details.

## Features (Phase 1 & 6)

- **File Indexing**: Index folders and store file metadata in SQLite
- **Database Queries**: Lazy-loaded tree queries for 100k+ files
- **Browser Automation**: Automatically fill AI chat interfaces (ChatGPT, Claude, Gemini, AI Studio)
- **Persistent Browser**: Browser stays open after automation for user review
- **Cross-Platform**: Windows, macOS, Linux support

## Installation

### Prerequisites

- Node.js 18+
- Rust (via [rustup](https://rustup.rs/))
- Platform-specific dependencies (see [TESTING.md](TESTING.md))

### Setup

```bash
# Clone repository
git clone https://github.com/rafek1241/ai-copy-paste.git
cd ai-copy-paste

# Install frontend dependencies
npm install

# Install sidecar dependencies (for browser automation)
cd sidecar
npm install
npx playwright install chromium
cd ..

# Run in development mode
npm run tauri dev
```

## Usage

### Browser Automation Test

When you run the application, you'll see a "Browser Automation Test" interface where you can:

1. Select an AI interface (ChatGPT, Claude, Gemini, AI Studio)
2. Enter your prompt text
3. Click "Launch Browser"
4. The browser opens, navigates to the AI interface, and fills your prompt
5. Review and submit manually

The browser remains open after automation completes.

### Developer Console

You can also test commands via the browser developer console:

```javascript
const { invoke } = window.__TAURI__.core;

// Index a folder
await invoke('index_folder', { path: '/path/to/folder' });

// Get root-level entries
const entries = await invoke('get_children', { parentId: null });

// Launch browser with prompt
await invoke('launch_browser', {
  interface: 'chatgpt',
  text: 'Explain React hooks',
  customUrl: null
});
```

## Testing

See [TESTING.md](TESTING.md) for comprehensive testing instructions, including:
- Phase 1: Database and file indexing tests
- Phase 6: Browser automation tests

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri 2.0
- **Database**: SQLite (via rusqlite)
- **Browser Automation**: Node.js + Playwright (sidecar process)

See [PLAN.md](PLAN.md) for detailed architecture documentation.

## Project Structure

```
ai-copy-paste/
├── src/                    # React frontend
│   └── BrowserAutomation.tsx  # Phase 6 test component
├── src-tauri/             # Rust backend
│   └── src/
│       ├── commands/      # IPC command handlers
│       ├── db/           # Database layer
│       └── error.rs      # Error handling
├── sidecar/              # Node.js browser automation
│   ├── automation.js     # Playwright script
│   └── selectors.js      # AI interface configs
├── PLAN.md              # Technical blueprint
├── AGENTS.md            # Development context
└── TESTING.md           # Testing guide
```

## Roadmap

- [x] Phase 1: Core infrastructure
- [ ] Phase 2: File traversal engine
- [ ] Phase 3: Virtual tree UI
- [ ] Phase 4: Text extraction
- [ ] Phase 5: Token counting
- [x] Phase 6: Browser automation
- [ ] Phase 7: History & persistence
- [ ] Phase 8: Context menu installers

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Contributing

This is an AI-agent-developed project. Each phase is implemented incrementally following the blueprint in PLAN.md.

## License

MIT License - see [LICENSE](LICENSE) file for details.
