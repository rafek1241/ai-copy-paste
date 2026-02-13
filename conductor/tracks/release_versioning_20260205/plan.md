# Implementation Plan: Release & Versioning

## Phase 1: UI Version Display [checkpoint: complete]
- [x] Task: Implement `getVersion()` frontend hook/service
    - [x] Create a service/hook to wrap `getVersion()` from `@tauri-apps/api/app`
    - [x] Handle error cases (return fallback version "0.0.0")
    - [x] Cache version to prevent multiple API calls
- [x] Task: TDD - Version Display in Footer
    - [x] Write failing tests for Footer component displaying version
    - [x] Write failing tests for version prop passing through component tree
    - [x] Implement version display in Footer component with "v" prefix
    - [x] Pass version prop from App.tsx through PromptView/FilesView to Footer
    - [x] Verify tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 1: UI Version Display' (Protocol in workflow.md)

## Phase 2: Version Sync System
- [x] Task: Create Version Sync Core Module
    - [x] Create `scripts/version-sync.ts` - Core module for reading/writing versions
    - [x] Implement version parsing from tauri.conf.json, package.json, and Cargo.toml
    - [x] Implement version writing/updating across all three files
- [x] Task: TDD - Version Sync Validation
    - [x] Write failing tests for version-sync.ts module
    - [x] Write tests for version comparison logic
    - [x] Write tests for version file parsing edge cases
    - [x] Verify tests pass
- [x] Task: Create CLI Bump Tool
    - [x] Create `scripts/bump-version.ts` - CLI tool to bump versions
    - [x] Add `--commit`, `--tag`, `--push` flag support
    - [x] Add validation for semantic version format
- [x] Task: Create CI Check Script
    - [x] Create `scripts/check-version.ts` - Validation script
    - [x] Add npm scripts: `version:check`, `version:bump`
    - [x] Integrate into CI workflow
- [x] Task: Conductor - User Manual Verification 'Phase 2: Version Sync System' (Protocol in workflow.md)

## Phase 3: Release Documentation
- [x] Task: Create RELEASE.md
    - [x] Document version bump process
    - [x] Document release workflow (tag-triggered vs manual)
    - [x] Document rollback procedures
    - [x] Add version numbering guidelines (semver)
- [x] Task: TDD - Documentation Validation
    - [x] Verify all npm scripts documented match actual scripts
    - [x] Verify workflow file references are accurate
- [x] Task: Conductor - User Manual Verification 'Phase 3: Release Documentation' (Protocol in workflow.md)

## Phase 4: Conventional Commits & Changelog
- [x] Task: Setup Commitlint
    - [x] Add `commitlint.config.js` with conventional config
    - [x] Add `@commitlint/cli` and `@commitlint/config-conventional` dependencies
    - [x] Setup Husky hooks for commit-msg validation
- [x] Task: TDD - Commit Message Validation
    - [x] Write tests for commitlint configuration
    - [x] Verify conventional commit format enforcement
    - [x] Test invalid commit message rejection
- [x] Task: Setup Auto-Generated Changelogs
    - [x] Enhance `release.yml` with categorized changelog generation
    - [x] Configure changelog groups: Features, Bug Fixes, Other Changes
    - [x] Create `CHANGELOG.md` template
- [x] Task: TDD - Changelog Generation
    - [x] Write tests for changelog generation logic
    - [x] Verify categorization of commits
    - [x] Verify proper formatting of release notes
- [x] Task: Conductor - User Manual Verification 'Phase 4: Conventional Commits & Changelog' (Protocol in workflow.md)

## Phase 5: Release Workflows
- [x] Task: Setup Tag-Triggered Release Workflow
    - [x] Configure `.github/workflows/release.yml`
    - [x] Add version sync validation step
    - [x] Configure builds for Windows, macOS (universal), Linux
    - [x] Setup artifact upload (MSI, DMG, AppImage, DEB)
    - [x] Configure draft release creation
- [x] Task: Setup Manual Release Workflow
    - [x] Configure `.github/workflows/manual-release.yml`
    - [x] Add version input validation
    - [x] Add git tag creation step
    - [x] Configure platform-specific builds
- [x] Task: TDD - Workflow Validation
    - [x] Test workflow YAML syntax
    - [x] Verify workflow triggers correctly
    - [x] Test version validation step
- [x] Task: Conductor - User Manual Verification 'Phase 5: Release Workflows' (Protocol in workflow.md)
