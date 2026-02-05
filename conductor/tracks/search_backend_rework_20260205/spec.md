# Search & FileTree Backend-Driven Rework

## Overview
Rework search to be backend-driven (Rust) instead of depending on frontend rendered/virtual data. Fix file tree to always display as tree structure. Fix several bugs and test issues.

## Problems Addressed
1. **Search depended on rendered data**: Virtual scrolling means not all nodes are loaded in frontend. Search filtering on `state.nodesMap` missed unloaded entries.
2. **File tree didn't behave like file explorer in search mode**: Search results were displayed as flat list instead of tree hierarchy.
3. **Gitignore tests failing**: 6 Rust tests failed due to bugs in `is_ignored`/`is_ignored_with_type` methods.
4. **Version hardcoded**: `v0.1.0` was hardcoded in `App.tsx` instead of reading from Tauri config.
5. **Test files excluded**: `src/lib/*.test.ts` files were not included in vitest config.

## Changes Made

### Backend (Rust)
- **gitignore.rs**: Rewrote `is_ignored` and `is_ignored_with_type` to share a unified `check_ignored` method with:
  - Top-down ancestor traversal (root first, nearest last) for correct precedence
  - Directory inheritance (if `node_modules/` is ignored, children are too)
- **indexing.rs**: Enhanced `search_path` command with:
  - `parse_search_query` function supporting `file:`, `dir:`, regex, plain text
  - SQL-based filtering for file/dir/plainText, Rust-based regex filtering
  - Added `regex` crate dependency
  - 10 new unit tests for search filter parsing

### Frontend (TypeScript/React)
- **FileTreeContext.tsx**: Removed client-side search filtering (`matchesSearchFilters`, `getMatchScore`, `matchesNameOnly`, complex `searchRootPaths`). Now relies on backend `search_path` results. Search results displayed as proper tree with auto-expanded directories.
- **FileTree.tsx**: Removed `parseSearchQuery` import. Simplified highlight query extraction.
- **App.tsx**: Replaced hardcoded `version="0.1.0"` with dynamic `getVersion()` from `@tauri-apps/api/app`.
- **vitest.config.ts**: Added `src/**/*.test.{ts,tsx}` to include patterns.

## Test Results
- Rust: 87 pass, 0 fail (was 71 pass, 6 fail)
- Frontend: 206 pass, 0 fail (was 148 pass, 0 fail — 58 tests were previously excluded)
