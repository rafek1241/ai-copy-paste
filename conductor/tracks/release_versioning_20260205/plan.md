# Implementation Plan: Release & Versioning

## Phase 1: Dynamic Version Display [COMPLETED]
- [x] Task 1.1: Use `getVersion()` from `@tauri-apps/api/app` in App.tsx
- [x] Task 1.2: Remove hardcoded version strings

## Phase 2: Version Sync (TODO)
- [ ] Task 2.1: Add script or CI step to ensure version in Cargo.toml, package.json, tauri.conf.json stay in sync
- [ ] Task 2.2: Document version bump process

## Phase 3: Changelog (TODO)
- [ ] Task 3.1: Consider adding conventional commits enforcement
- [ ] Task 3.2: Add auto-generated changelog to releases
