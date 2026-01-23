# AI Copy Paste (AI Context Collector)

A cross-platform desktop application designed to collect, organize, and paste code context into AI assistants (ChatGPT, Claude, Gemini, etc.). It features high-performance file indexing, text extraction, token counting, and browser automation.

## Project Overview

*   **Framework**: Tauri 2.0 (Rust Backend) + React 19 (Frontend).
*   **Purpose**: Streamline the process of gathering code context for AI prompts.
*   **Key Features**:
    *   **File Indexing**: Fast, parallel traversal of large directories (100k+ files) using SQLite.
    *   **Virtual Tree UI**: Smooth scrolling for large file trees.
    *   **Text Extraction**: Support for PDF, DOCX, and code files.
    *   **Token Counting**: Accurate tokenizer (gpt-tokenizer) with limit warnings.
    *   **Browser Automation**: Playwright integration to automatically fill prompts in AI web interfaces.
    *   **Persistence**: Session history and user settings.

## Architecture

*   **Frontend**: React, TypeScript, Tailwind CSS, TanStack Virtual.
*   **Backend**: Rust (Tauri commands), SQLite (rusqlite), Walkdir, Rayon.
*   **Sidecar**: Node.js process running Playwright for browser automation (`sidecar/`).
*   **Database**: SQLite for storing file indices and history (`src-tauri/src/db/`).

## Setup & Development

### Prerequisites
*   Node.js v18+
*   Rust (latest stable)
*   Platform-specific build tools (VS C++ Build Tools on Windows, Xcode on macOS, etc.)

### Installation
1.  **Frontend Dependencies**:
    ```bash
    npm install
    ```
2.  **Sidecar Dependencies**:
    ```bash
    cd sidecar
    npm install
    npx playwright install chromium
    cd ..
    ```

### Running the App
*   **Development Mode**:
    ```bash
    npm run tauri dev
    ```
*   **Production Build**:
    ```bash
    npm run tauri build
    ```

## Testing Strategy

*   **Frontend Unit/Integration**:
    ```bash
    npm run test
    # or
    npm run test:ui
    ```
    Uses **Vitest**.

*   **Backend (Rust)**:
    ```bash
    npm run test:rust
    # or inside src-tauri/
    cargo test
    ```

*   **End-to-End (E2E)**:
    ```bash
    npm run test:e2e
    ```
    Uses **WebdriverIO**.

## Directory Structure

*   `src/`: React frontend source code.
    *   `components/`: UI components (FileTree, PromptBuilder, etc.).
    *   `services/`: API layer communicating with Tauri backend.
*   `src-tauri/`: Rust backend source code.
    *   `src/commands/`: Tauri IPC commands (indexing, extraction, browser control).
    *   `src/db/`: Database schema and queries.
*   `sidecar/`: Node.js script for Playwright automation.
*   `installers/`: Platform-specific installer assets (Windows Registry, macOS Finder Sync, Linux scripts).
*   `PLAN.md`: Detailed project roadmap and architectural blueprint.

## Key Files
*   `PLAN.md`: The "Source of Truth" for architectural decisions and phase tracking.
*   `TESTING.md`: Comprehensive guide on testing procedures for each phase.
*   `AGENTS.md`: Context specific to AI agents working on this project.
*   `src-tauri/tauri.conf.json`: Tauri configuration.
