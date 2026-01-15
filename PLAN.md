# Technical Blueprint for Cross-Platform AI Context Collector

Building an efficient, cross-platform desktop application for AI context collection requires careful architectural decisions balancing performance, bundle size, and browser automation capabilities. **Tauri 2.0 with a Rust backend emerges as the optimal framework**, delivering **100x smaller bundles** than Electron while handling 100k+ files through memory-safe streaming operations. Playwright provides the most reliable browser automation for filling AI chat interfaces, with native shadow DOM piercing and contenteditable support. The architecture centers on SQLite for disk-based file indexing, lazy-loaded virtual trees for UI performance, and a modular design optimized for AI agent implementation.

## Recommended tech stack and justification

The stack prioritizes memory efficiency, cross-platform reliability, and development velocity:

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Framework** | Tauri | 2.0+ | 3-4MB bundle vs 300MB+ Electron; Rust backend for safe 100k+ file handling |
| **Frontend** | React + TypeScript | 18.x + 5.x | Mature ecosystem, excellent virtual scrolling libraries |
| **Database** | SQLite (better-sqlite3/rusqlite) | 3.x / 9.x | 35% faster than filesystem I/O, SQL tree queries, single-file portability |
| **PDF Extraction** | pdfjs-dist | 4.x | Apache-2.0 license, streaming page-by-page, no native dependencies |
| **DOCX Extraction** | mammoth.js | 1.x | Semantic HTML/Markdown output, browser + Node.js compatible |
| **Tokenizer** | gpt-tokenizer | 2.4+ | Fastest JS tokenizer, offline, 100% accurate for OpenAI models |
| **Browser Automation** | Playwright | 1.57+ | Shadow DOM piercing, contenteditable support, persistent contexts |
| **Virtual Scrolling** | TanStack Virtual | 3.x | Headless, 60fps with 100k+ items, 10-15KB bundle |
| **File Watching** | chokidar | 4.x+ | 30M+ repos use it, native FSEvents on macOS |

**Why Tauri over Electron?** While Electron offers native Playwright integration, Tauri's memory efficiency is critical for handling 100k+ files. Browser automation runs as a spawned Node.js sidecar process communicating via IPC—a clean architectural separation that also enables the browser to remain open after automation completes.

## Project structure and module breakdown

```
ai-context-collector/
├── src-tauri/                      # Rust backend
│   ├── src/
│   │   ├── main.rs                 # Entry point, system tray
│   │   ├── commands/               # Tauri command handlers
│   │   │   ├── indexing.rs         # File traversal, SQLite operations
│   │   │   ├── extraction.rs       # Text extraction orchestration
│   │   │   ├── history.rs          # Session history management
│   │   │   └── browser.rs          # Playwright sidecar control
│   │   ├── db/
│   │   │   ├── schema.rs           # SQLite schema definitions
│   │   │   └── queries.rs          # Prepared statements
│   │   ├── cache/
│   │   │   ├── text_cache.rs       # LRU disk cache for extracted text
│   │   │   └── token_cache.rs      # Token count memoization
│   │   └── utils/
│   │       ├── encoding.rs         # File encoding detection
│   │       └── validation.rs       # Path validation helpers
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                            # React frontend
│   ├── components/
│   │   ├── FileTree/               # Virtual scrolling tree with checkboxes
│   │   ├── TokenCounter/           # Real-time token estimation display
│   │   ├── PromptBuilder/          # Template selection and customization
│   │   ├── HistoryPanel/           # Last 10 sessions with validation
│   │   └── Settings/               # Persistence configuration
│   ├── hooks/
│   │   ├── useFileIndex.ts         # SQLite query interface
│   │   ├── useTokenCount.ts        # gpt-tokenizer integration
│   │   └── useDragDrop.ts          # File/folder drop handling
│   ├── services/
│   │   ├── tokenizer.ts            # gpt-tokenizer wrapper
│   │   ├── extraction.ts           # PDF/DOCX extraction calls
│   │   └── browser.ts              # Playwright IPC commands
│   └── templates/                  # Prompt templates (agent, planning, debug, review)
│
├── sidecar/                        # Node.js Playwright process
│   ├── automation.js               # Browser control logic
│   ├── selectors.js                # AI chat interface selectors
│   └── package.json
│
├── installers/                     # Platform-specific context menu registration
│   ├── windows/
│   │   ├── context-menu.reg        # Registry entries
│   │   └── setup.nsi               # NSIS installer script
│   ├── macos/
│   │   └── FinderSync/             # Xcode extension project
│   └── linux/
│       ├── nautilus-extension.py
│       ├── dolphin.desktop
│       └── nemo.nemo_action
│
└── tests/
```

## Data flow architecture

The system processes files through a disk-first pipeline that minimizes RAM usage:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION                                │
│  [Context Menu / Drag-Drop / GUI Browse] → Selected Paths                   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FILE INDEXING PIPELINE                               │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  Parallel  │───▶│  SQLite     │───▶│  Fingerprint │───▶│  File Watch  │ │
│  │  Traversal │    │  Batch      │    │  (mtime+size)│    │  (chokidar)  │ │
│  │  (4 threads)│   │  Insert     │    │  Index       │    │  Invalidate  │ │
│  └────────────┘    └─────────────┘    └──────────────┘    └──────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UI RENDERING LAYER                                 │
│  ┌────────────────┐    ┌───────────────┐    ┌────────────────────────────┐ │
│  │  Lazy Tree     │───▶│  Virtual      │───▶│  Checkbox State Management │ │
│  │  Query         │    │  Scroll       │    │  (parent/child propagation)│ │
│  │  (on-demand)   │    │  (50 visible) │    │                            │ │
│  └────────────────┘    └───────────────┘    └────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONTEXT BUILDING PIPELINE                               │
│  ┌────────────────┐    ┌───────────────┐    ┌────────────────────────────┐ │
│  │  Selected      │───▶│  Text Extract │───▶│  Token Count               │ │
│  │  Files Queue   │    │  (disk cache) │    │  (gpt-tokenizer)           │ │
│  │                │    │  PDF/DOCX/MD  │    │  + cumulative display      │ │
│  └────────────────┘    └───────────────┘    └────────────────────────────┘ │
│                                                        │                     │
│                                                        ▼                     │
│                              ┌────────────────────────────────────────────┐ │
│                              │  Prompt Assembly                           │ │
│                              │  [Template] + [Custom Instructions] +     │ │
│                              │  [File Contents with paths]               │ │
│                              └────────────────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
        ┌─────────────────────┐    ┌─────────────────────────────────────────┐
        │  CLIPBOARD COPY     │    │  BROWSER AUTOMATION (Playwright Sidecar)│
        │  (system clipboard) │    │  ┌───────────────────────────────────┐  │
        └─────────────────────┘    │  │  Launch Persistent Context        │  │
                                   │  │  (headless: false, user-data-dir) │  │
                                   │  └───────────────────────────────────┘  │
                                   │                    │                    │
                                   │                    ▼                    │
                                   │  ┌───────────────────────────────────┐  │
                                   │  │  Navigate to AI Chat Interface    │  │
                                   │  │  (ChatGPT/Claude/Gemini/Studio)   │  │
                                   │  └───────────────────────────────────┘  │
                                   │                    │                    │
                                   │                    ▼                    │
                                   │  ┌───────────────────────────────────┐  │
                                   │  │  Fill [contenteditable] element   │  │
                                   │  │  → locator.fill(text)             │  │
                                   │  └───────────────────────────────────┘  │
                                   │                    │                    │
                                   │                    ▼                    │
                                   │  ┌───────────────────────────────────┐  │
                                   │  │  DISCONNECT (not close)           │  │
                                   │  │  Browser stays open for user      │  │
                                   │  └───────────────────────────────────┘  │
                                   └─────────────────────────────────────────┘
```

## SQLite schema for efficient tree queries

The database design enables sub-millisecond lookups even with 500k files:

```sql
-- Core file index table
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER REFERENCES files(id),
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  size INTEGER,
  mtime INTEGER,                    -- Unix timestamp for change detection
  is_dir INTEGER DEFAULT 0,
  token_count INTEGER,              -- Cached token count (nullable)
  fingerprint TEXT                  -- mtime_size for quick invalidation
);

CREATE INDEX idx_parent ON files(parent_id);
CREATE INDEX idx_path ON files(path);
CREATE INDEX idx_fingerprint ON files(fingerprint);

-- Session history (paths only, not content)
CREATE TABLE history (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL,
  root_paths TEXT NOT NULL,         -- JSON array of root paths
  selected_paths TEXT NOT NULL,     -- JSON array of selected file paths
  template_id TEXT,
  custom_prompt TEXT
);

-- Settings persistence
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## Implementation phases for AI coding agents

This breakdown structures the project into **8 discrete modules** that AI agents can implement independently, with clear interfaces between them:

### Phase 1: Core infrastructure (Agent 1)

**Objective:** Establish Tauri project skeleton and SQLite integration

**Tasks:**
- Initialize Tauri 2.0 project with React frontend
- Implement SQLite connection management in Rust (rusqlite)
- Create schema migration system
- Build basic IPC command structure (index_folder, get_children, search_path)
- Implement error handling and logging framework

**Deliverables:** Working Tauri app that can persist and query file paths

**Key code pattern:**
```rust
#[tauri::command]
async fn index_folder(path: String, db: State<'_, DbPool>) -> Result<u64, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let count = indexing::traverse_and_insert(&conn, &path).await?;
    Ok(count)
}
```

### Phase 2: File traversal engine (Agent 2)

**Objective:** Implement parallel file system traversal with memory efficiency

**Tasks:**
- Use `walkdir` crate with 4-thread parallel traversal
- Implement batch SQLite inserts (1000 records per transaction)
- Add symlink handling (skip or follow based on settings)
- Implement permission error recovery (log and continue)
- Build fingerprint-based change detection (mtime + size)
- Add progress reporting via Tauri events

**Performance target:** Index 100k files in under 15 seconds

**Key code pattern:**
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

### Phase 3: Virtual tree UI (Agent 3)

**Objective:** Build performant file tree with checkboxes supporting 100k+ items

**Tasks:**
- Implement TanStack Virtual with tree flattening
- Build lazy-loading tree node component
- Implement checkbox state propagation (parent ↔ child)
- Add expand/collapse with SQLite child queries
- Implement search/filter with debouncing
- Build drag-drop zone for adding new folders

**Key code pattern:**
```typescript
const virtualizer = useVirtualizer({
  count: flattenedTree.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 28,
  overscan: 10,
});

// Only query children when node is expanded
const loadChildren = async (nodeId: number) => {
  const children = await invoke('get_children', { parentId: nodeId });
  updateTree(nodeId, children);
};
```

### Phase 4: Text extraction service (Agent 4)

**Objective:** Extract text from PDF, DOCX, Markdown, and source files

**Tasks:**
- Integrate pdfjs-dist with page-by-page streaming
- Integrate mammoth.js for DOCX → plain text
- Implement encoding detection (chardet) for plain text files
- Build disk-based LRU cache for extracted text (~100MB limit)
- Add extraction progress events
- Handle corrupted files gracefully (skip with warning)

**Key code pattern:**
```javascript
// Streaming PDF extraction
async function* extractPdfPages(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    yield content.items.map(item => item.str).join(' ');
  }
}
```

### Phase 5: Token counting and prompt building (Agent 5)

**Objective:** Real-time token estimation and template-based prompt assembly

**Tasks:**
- Integrate gpt-tokenizer with model-specific encodings
- Build cumulative token counter UI component
- Implement prompt templates (agent, planning, debugging, review)
- Build prompt preview with syntax highlighting
- Add token limit warnings (configurable thresholds)
- Implement `isWithinTokenLimit()` for efficient limit checking

**Token counting strategy:**
```typescript
import { encode, isWithinTokenLimit } from 'gpt-tokenizer/model/gpt-4o';

function countTokens(text: string): number {
  // Fast path: check if within limit without full encoding
  const withinLimit = isWithinTokenLimit(text, 200000);
  if (withinLimit === false) return 200001; // Over limit
  return withinLimit; // Returns actual count
}
```

### Phase 6: Browser automation sidecar (Agent 6)

**Objective:** Playwright-based browser control that keeps windows open

**Tasks:**
- Create Node.js sidecar with Playwright persistent context
- Implement AI chat selectors (ChatGPT, Claude.ai, Gemini, AI Studio)
- Build fill operation with contenteditable fallbacks
- Implement disconnect pattern (browser stays open)
- Add anti-automation mitigations
- Build IPC communication with Tauri main process

**Critical code pattern:**
```javascript
// sidecar/automation.js
const { chromium } = require('playwright');

async function fillAndLeaveOpen(url, text) {
  const context = await chromium.launchPersistentContext('./browser-data', {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const page = context.pages()[0] || await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Fill contenteditable with fallback chain
  const input = page.locator('[contenteditable="true"]').first();
  try {
    await input.fill(text);
  } catch {
    await input.click();
    await page.keyboard.type(text, { delay: 10 });
  }
  
  // DISCONNECT instead of close - browser stays running
  console.log('Browser open. User can interact. Script exiting.');
  process.exit(0); // Node exits, browser persists
}
```

### Phase 7: History and persistence (Agent 7)

**Objective:** Session history with path validation on restore

**Tasks:**
- Implement history table with 10-entry limit (FIFO eviction)
- Build path validation on restore (check `fs.access`)
- Create notification system for missing paths
- Implement settings persistence (excluded extensions, token limit, default template)
- Add export/import for settings backup

**Validation pattern:**
```typescript
async function validateHistory(session: HistoryEntry): Promise<ValidationResult> {
  const missing: string[] = [];
  for (const path of session.selectedPaths) {
    try {
      await fs.access(path, fs.constants.R_OK);
    } catch {
      missing.push(path);
    }
  }
  return { valid: missing.length === 0, missingPaths: missing };
}
```

### Phase 8: Context menu installers (Agent 8)

**Objective:** Platform-specific shell integration

**Tasks:**

**Windows:**
- Create `.reg` file for registry-based context menu
- Build NSIS installer script with registry writes
- Optionally: IExplorerCommand + Sparse Package for Windows 11 native

**macOS:**
- Create Finder Sync Extension Xcode project
- Implement XPC communication to main app
- Add code signing and notarization scripts

**Linux:**
- Create Nautilus Python extension
- Create Dolphin `.desktop` service menu
- Create Nemo `.nemo_action` file
- Build install script detecting desktop environment

## Key libraries with specific versions

| Library | Version | Installation | Purpose |
|---------|---------|--------------|---------|
| `@tauri-apps/api` | 2.0.x | `npm install @tauri-apps/api` | Tauri IPC |
| `@tanstack/react-virtual` | 3.x | `npm install @tanstack/react-virtual` | Virtual scrolling |
| `gpt-tokenizer` | 2.4+ | `npm install gpt-tokenizer` | Token counting |
| `pdfjs-dist` | 4.x | `npm install pdfjs-dist` | PDF extraction |
| `mammoth` | 1.x | `npm install mammoth` | DOCX extraction |
| `chokidar` | 4.x | `npm install chokidar` | File watching |
| `playwright` | 1.57+ | `npm install playwright` | Browser automation |
| `better-sqlite3` | 9.x | `npm install better-sqlite3` | SQLite (Node sidecar) |
| `rusqlite` | 0.31+ | `cargo add rusqlite` | SQLite (Rust backend) |
| `walkdir` | 2.x | `cargo add walkdir` | Directory traversal |
| `rayon` | 1.x | `cargo add rayon` | Parallel processing |
| `chardetng` | 0.1+ | `cargo add chardetng` | Encoding detection |

## Potential challenges and solutions

### Challenge 1: Browser automation browser closing on script exit

**Problem:** Playwright closes browser when Node.js process exits
**Solution:** Use `launchPersistentContext` with user data directory. Call `process.exit(0)` without cleanup—browser process is independent and survives Node.js termination. Store WebSocket endpoint for potential reconnection.

### Challenge 2: Memory explosion with large file counts

**Problem:** Loading 100k file metadata into RAM crashes app
**Solution:** Never load full tree into memory. Use SQLite as source of truth with lazy queries (`SELECT * FROM files WHERE parent_id = ?`). Virtual scrolling renders only ~50 visible nodes. Extracted text goes to disk cache, not RAM.

### Challenge 3: Context menu on Windows 11

**Problem:** Windows 11 hides shell extensions in "Show more options" submenu
**Solution:** For top-level visibility, implement `IExplorerCommand` interface with Sparse Package app identity. For MVP, accept "Show more options" placement—registry approach still works and is simpler.

### Challenge 4: macOS Finder extension sandboxing

**Problem:** Finder Sync Extension runs in separate sandbox, cannot directly communicate with main app
**Solution:** Use App Groups shared container for file-based IPC, or distributed notifications for simple signals. Extension writes selected paths to shared file; main app watches via FSEvents.

### Challenge 5: Token counting accuracy across models

**Problem:** Different AI models use different tokenizers (GPT-4 vs Claude vs Gemini)
**Solution:** Use `gpt-tokenizer` as primary (exact for OpenAI). For Claude/Gemini, show "~estimated" label with ±15% warning. Offer API-based exact count as optional feature when online.

### Challenge 6: Text extraction from malformed PDFs

**Problem:** PDFs with encoding issues or corrupted structure crash extractors
**Solution:** Wrap all extraction in try-catch. Log errors and skip problematic files with user notification. Use `pypdf` (Python) or `pdfjs-dist` (JS) which have robust error recovery. Display extraction status per file.

## Performance optimization strategies

**File indexing optimization:**
- Batch SQLite inserts: 1000 records per transaction (100x faster than individual inserts)
- Parallel traversal: 4 worker threads with work-stealing queue
- Fingerprint caching: Skip unchanged files (`mtime_size` comparison)
- Incremental updates: File watcher only reindexes changed subtrees

**UI rendering optimization:**
- Virtual scrolling: Only render visible rows + 10 overscan
- Lazy tree loading: Query children only on expand
- Debounced search: 150ms delay before filtering
- Memoized components: `React.memo` on tree nodes

**Text extraction optimization:**
- Disk LRU cache: 100MB limit, LRU eviction
- Streaming PDFs: Process page-by-page, not full load
- Priority queue: Extract visible/selected files first
- Parallel extraction: 4 concurrent file reads with `p-limit`

**Token counting optimization:**
- `isWithinTokenLimit()`: Fast limit check without full encoding
- Incremental counting: Cache per-file token counts in SQLite
- Background updates: Recount only when file changes

**Expected performance benchmarks:**

| Operation | 100k files | 500k files |
|-----------|-----------|------------|
| Initial index | 5-15s | 20-60s |
| SQLite lookup | <1ms | <1ms |
| Tree render | <16ms (60fps) | <16ms (60fps) |
| Token count (1MB text) | <50ms | <50ms |
| PDF extract (100 pages) | 2-5s | 2-5s |

## Final architecture summary

This design achieves the core requirements through strategic technology choices:

- **Memory constraint (no RAM for file content):** SQLite stores metadata, disk cache stores extracted text, virtual scrolling minimizes DOM nodes
- **100k+ files:** Rust's memory safety + parallel traversal + lazy loading tree
- **Browser stays open:** Playwright persistent context + disconnect pattern + separate Node.js sidecar
- **Cross-platform context menus:** Platform-specific implementations (registry/FinderSync/Nautilus) bundled with installers
- **Token counting accuracy:** gpt-tokenizer for exact OpenAI counts, estimation fallback for other models

The 8-phase AI agent breakdown ensures each module has clear inputs/outputs and can be developed independently, with integration points defined by Tauri IPC commands and SQLite schema contracts.
