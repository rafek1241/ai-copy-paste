# AI Context Collector

A cross-platform desktop application for collecting and organizing code context for AI assistants. Built with Tauri 2.0, Rust, and React.

## Features

### Phase 1-5: Complete AI Context Pipeline ✅
- **File Indexing**: Parallel traversal with batch SQLite inserts
- **Virtual Tree UI**: Handle 100k+ files with smooth 60fps scrolling
- **Text Extraction**: PDF, DOCX, Markdown with LRU caching
- **Token Counting**: Accurate GPT tokenization with gpt-tokenizer
- **Prompt Building**: Template-based prompt assembly with file contents
- **Smart Selection**: Parent-child checkbox propagation
- **Real-time Search**: Debounced file tree search

### Phase 6: Browser Automation ✅
- **AI Interface Support**: ChatGPT, Claude, Gemini, AI Studio
- **Persistent Browser**: Browser stays open after automation
- **Auto-fill Prompts**: Automatically fill chat interfaces with context
- **Selector Fallbacks**: Multiple strategies for robust automation
- **Session Persistence**: Maintains login state across launches

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- [Rust](https://rustup.rs/)
- Platform-specific dependencies (see [TESTING.md](TESTING.md))

### Installation

```bash
# Clone repository
git clone https://github.com/rafek1241/ai-copy-paste.git
cd ai-copy-paste

# Install frontend dependencies
npm install

# Install sidecar dependencies (for browser automation - Phase 6)
cd sidecar
npm install
npx playwright install chromium
cd ..

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Usage

### Main Application

1. **Add Folders**: Click "Add Folder" to select a directory to index
2. **Browse Files**: Expand folders and select files with checkboxes
3. **Build Prompts**: Configure template and custom instructions
4. **View Tokens**: Real-time token count with limit warnings
5. **Copy or Send**: Copy to clipboard or launch browser automation

### Browser Automation

Click "Browser Automation" in the header to:
1. Select an AI interface (ChatGPT, Claude, Gemini, AI Studio)
2. Enter or paste your prompt text
3. Click "Launch Browser"
4. Browser opens, navigates, and fills the prompt automatically
5. Review and submit manually

The browser remains open for user interaction after automation completes.

### Developer Console

You can also test commands via the browser developer console:

```javascript
const { invoke } = window.__TAURI__.core;

// Index a folder
await invoke('index_folder', { path: '/path/to/folder' });

// Get file tree
const entries = await invoke('get_children', { parentId: null });

// Extract text from file
const text = await invoke('extract_text', { path: '/path/to/file.pdf' });

// Build prompt
const prompt = await invoke('build_prompt_from_files', {
  fileIds: [1, 2, 3],
  templateId: 'agent',
  customPrompt: 'Review for security issues'
});

// Launch browser automation
await invoke('launch_browser', {
  interface: 'chatgpt',
  text: prompt,
  customUrl: null
});
```

## Project Structure

```
ai-copy-paste/
├── src/                          # React frontend
│   ├── components/
│   │   ├── FileTree/             # Virtual tree with lazy loading
│   │   ├── PromptBuilder.tsx     # Prompt assembly UI
│   │   └── TokenCounter.tsx      # Real-time token display
│   ├── BrowserAutomation.tsx     # Phase 6 test component
│   ├── services/                 # API service layer
│   └── types.ts                  # TypeScript types
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── commands/             # Tauri IPC commands
│       │   ├── indexing.rs       # File traversal
│       │   ├── extraction.rs     # Text extraction
│       │   ├── prompts.rs        # Prompt building
│       │   └── browser.rs        # Browser automation
│       ├── cache/                # LRU text cache
│       ├── db/                   # Database layer
│       └── templates.rs          # Prompt templates
├── sidecar/                      # Phase 6: Browser automation
│   ├── automation.js             # Playwright script
│   └── selectors.js              # AI interface configs
├── PLAN.md                       # Technical blueprint
├── TESTING.md                    # Testing guide
└── AGENTS.md                     # Development context
```

## Architecture

- **Frontend**: React 19 with TypeScript
- **Backend**: Rust with Tauri 2.0
- **Database**: SQLite with rusqlite
- **Virtual Scrolling**: TanStack Virtual
- **Text Extraction**: pdf.js, mammoth.js
- **Token Counting**: gpt-tokenizer
- **Browser Automation**: Node.js + Playwright (sidecar)

## Testing

See [TESTING.md](TESTING.md) for comprehensive testing instructions, including:
- Phase 1: Database and file indexing tests
- Phase 2: Parallel traversal performance tests
- Phase 3: Virtual tree UI tests
- Phase 4: Text extraction tests
- Phase 5: Token counting and prompt building tests
- Phase 6: Browser automation tests

## Roadmap

- ✅ Phase 1: Core infrastructure (SQLite, basic commands)
- ✅ Phase 2: Parallel file traversal with batch inserts
- ✅ Phase 3: Virtual tree UI with lazy loading
- ✅ Phase 4: Text extraction (PDF, DOCX, source files)
- ✅ Phase 5: Token counting and prompt building
- ✅ Phase 6: Browser automation sidecar
- 📋 Phase 7: History and persistence
- 📋 Phase 8: Context menu installers

See [PLAN.md](PLAN.md) for the complete technical blueprint.

## Technologies

- [Tauri](https://tauri.app/) - Desktop application framework
- [React](https://react.dev/) - UI framework
- [Rust](https://www.rust-lang.org/) - Backend language
- [SQLite](https://www.sqlite.org/) - Database
- [TanStack Virtual](https://tanstack.com/virtual) - Virtual scrolling
- [pdf.js](https://mozilla.github.io/pdf.js/) - PDF extraction
- [mammoth.js](https://github.com/mwilliamson/mammoth.js) - DOCX extraction
- [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) - Token counting
- [Playwright](https://playwright.dev/) - Browser automation

## Development

This is an AI-agent-developed project. Each phase is implemented incrementally following the blueprint in PLAN.md.

See [AGENTS.md](AGENTS.md) for development context and architectural decisions.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

MIT License - see [LICENSE](LICENSE) file for details.
