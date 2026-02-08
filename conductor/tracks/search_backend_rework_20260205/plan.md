# Implementation Plan: Search & FileTree Backend-Driven Rework

## Phase 1: Fix Failing Tests [COMPLETED]
- [x] Task 1.1: Fix gitignore `is_ignored` / `is_ignored_with_type` — top-down traversal + directory inheritance
- [x] Task 1.2: Fix vitest config to include `src/lib/*.test.ts`
- [x] Task 1.3: Verify all 77→87 Rust tests pass, all 148→206 frontend tests pass

## Phase 2: Backend Search Enhancement [COMPLETED]
- [x] Task 2.1: Add `regex` crate to Cargo.toml
- [x] Task 2.2: Implement `parse_search_query` in Rust (file:, dir:, regex, plainText)
- [x] Task 2.3: Rewrite `search_path` command with SQL + Rust filtering
- [x] Task 2.4: Add 10 unit tests for parse_search_query

## Phase 3: Frontend Search Refactor [COMPLETED]
- [x] Task 3.1: Remove client-side search filtering from FileTreeContext.tsx
- [x] Task 3.2: Build tree from backend search results (path-segment based)
- [x] Task 3.3: Auto-expand directories in search result tree
- [x] Task 3.4: Simplify FileTree.tsx (remove parseSearchQuery dependency)

## Phase 4: Version Display [COMPLETED]
- [x] Task 4.1: Use `getVersion()` from `@tauri-apps/api/app` in App.tsx
- [x] Task 4.2: Remove hardcoded "0.1.0" strings
