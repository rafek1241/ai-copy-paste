# Implementation Plan: Release & Versioning

## Phase 1: Dynamic Version Display [COMPLETED]
- [x] Task 1.1: Use `getVersion()` from `@tauri-apps/api/app` in App.tsx
- [x] Task 1.2: Remove hardcoded version strings

## Phase 2: Version Sync [COMPLETED]
- [x] Task 2.1: Add script or CI step to ensure version in Cargo.toml, package.json, tauri.conf.json stay in sync
  - Created `scripts/version-sync.ts` - Core module for reading/writing versions
  - Created `scripts/bump-version.ts` - CLI tool to bump versions across all files
  - Created `scripts/check-version.ts` - Validation script for CI
  - Added tests in `scripts/version-sync.test.ts`
  - Added npm scripts: `version:check`, `version:bump`
  - Added CI check in tests workflow
- [x] Task 2.2: Document version bump process
  - Created comprehensive `RELEASE.md` documentation

## Phase 3: Changelog [COMPLETED]
- [x] Task 3.1: Add conventional commits enforcement with commitlint
  - Added `commitlint.config.js` with conventional config
  - Added `@commitlint/cli` and `@commitlint/config-conventional` dependencies
  - Added Husky hooks for commit-msg and pre-commit
  - Added CI check for PR commit messages
- [x] Task 3.2: Add auto-generated changelog to releases
  - Enhanced `release.yml` with categorized changelog generation
  - Changelog groups: Features, Bug Fixes, Other Changes
  - Created `CHANGELOG.md` for manual tracking

## Summary

All release and versioning tasks are now complete:
- Version sync is automated with CI enforcement
- Release process is documented in `RELEASE.md`
- Conventional commits are enforced in PRs and locally via Husky
- Changelogs are auto-generated from commit history
