# Technology Stack - AI Context Collector

## Core Framework
- **Application**: Tauri 2.0 (Rust backend, web frontend)
- **Language (Backend)**: Rust (Edition 2021)
- **Language (Frontend)**: TypeScript

## Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Component Library**: Radix UI (Primitives)
- **State Management**: React Context / Hooks
- **Virtualization**: TanStack Virtual (for large file lists)

## Backend (Rust)
- **Database**: SQLite (via `rusqlite` bundled)
- **Concurrency**: `rayon` (for parallel processing)
- **File System**: `walkdir` (for efficient directory traversal)
- **Serialization**: `serde`, `serde_json`
- **Logging**: `env_logger`, `log`

## Browser Automation (Sidecar)
- **Runtime**: Node.js
- **Automation Library**: Playwright
- **Inter-Process Communication**: Standard I/O (Tauri Sidecar)

## Key Libraries & Tools
- **Token Counting**: `gpt-tokenizer`
- **Document Extraction**:
    - PDF: `pdfjs-dist`
    - DOCX: `mammoth`
- **Encoding Detection**: `chardetng`, `encoding_rs`
- **Testing**:
    - Frontend: Vitest, React Testing Library
    - Backend: Cargo Test
    - E2E: WebdriverIO
