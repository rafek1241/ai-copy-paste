# Implementation Plan: Release & Versioning

## Phase 1: UI Version Display
- [ ] Task: Implement `getVersion()` frontend hook/service
    - [ ] Create a service/hook to wrap `getVersion()` from `@tauri-apps/api/app`
    - [ ] Handle error cases (return fallback version "0.0.0")
    - [ ] Cache version to prevent multiple API calls
- [ ] Task: TDD - Version Display in Footer
    - [ ] Write failing tests for Footer component displaying version
    - [ ] Write failing tests for version prop passing through component tree
    - [ ] Implement version display in Footer component with "v" prefix
    - [ ] Pass version prop from App.tsx through PromptView/FilesView to Footer
    - [ ] Verify tests pass
- [ ] Task: Conductor - User Manual Verification 'Phase 1: UI Version Display' (Protocol in workflow.md)

## Phase 2: Version Sync System
- [ ] Task: Create Version Sync Core Module
    - [ ] Create `scripts/version-sync.ts` - Core module for reading/writing versions
    - [ ] Implement version parsing from tauri.conf.json, package.json, and Cargo.toml
    - [ ] Implement version writing/updating across all three files
- [ ] Task: TDD - Version Sync Validation
    - [ ] Write failing tests for version-sync.ts module
    - [ ] Write tests for version comparison logic
    - [ ] Write tests for version file parsing edge cases
    - [ ] Verify tests pass
- [ ] Task: Create CLI Bump Tool
    - [ ] Create `scripts/bump-version.ts` - CLI tool to bump versions
    - [ ] Add `--commit`, `--tag`, `--push` flag support
    - [ ] Add validation for semantic version format
- [ ] Task: Create CI Check Script
    - [ ] Create `scripts/check-version.ts` - Validation script
    - [ ] Add npm scripts: `version:check`, `version:bump`
    - [ ] Integrate into CI workflow
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Version Sync System' (Protocol in workflow.md)

## Phase 3: Release Documentation
- [ ] Task: Create RELEASE.md
    - [ ] Document version bump process
    - [ ] Document release workflow (tag-triggered vs manual)
    - [ ] Document rollback procedures
    - [ ] Add version numbering guidelines (semver)
- [ ] Task: TDD - Documentation Validation
    - [ ] Verify all npm scripts documented match actual scripts
    - [ ] Verify workflow file references are accurate
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Release Documentation' (Protocol in workflow.md)

## Phase 4: Conventional Commits & Changelog
- [ ] Task: Setup Commitlint
    - [ ] Add `commitlint.config.js` with conventional config
    - [ ] Add `@commitlint/cli` and `@commitlint/config-conventional` dependencies
    - [ ] Setup Husky hooks for commit-msg validation
- [ ] Task: TDD - Commit Message Validation
    - [ ] Write tests for commitlint configuration
    - [ ] Verify conventional commit format enforcement
    - [ ] Test invalid commit message rejection
- [ ] Task: Setup Auto-Generated Changelogs
    - [ ] Enhance `release.yml` with categorized changelog generation
    - [ ] Configure changelog groups: Features, Bug Fixes, Other Changes
    - [ ] Create `CHANGELOG.md` template
- [ ] Task: TDD - Changelog Generation
    - [ ] Write tests for changelog generation logic
    - [ ] Verify categorization of commits
    - [ ] Verify proper formatting of release notes
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Conventional Commits & Changelog' (Protocol in workflow.md)

## Phase 5: Release Workflows
- [ ] Task: Setup Tag-Triggered Release Workflow
    - [ ] Configure `.github/workflows/release.yml`
    - [ ] Add version sync validation step
    - [ ] Configure builds for Windows, macOS (universal), Linux
    - [ ] Setup artifact upload (MSI, DMG, AppImage, DEB)
    - [ ] Configure draft release creation
- [ ] Task: Setup Manual Release Workflow
    - [ ] Configure `.github/workflows/manual-release.yml`
    - [ ] Add version input validation
    - [ ] Add git tag creation step
    - [ ] Configure platform-specific builds
- [ ] Task: TDD - Workflow Validation
    - [ ] Test workflow YAML syntax
    - [ ] Verify workflow triggers correctly
    - [ ] Test version validation step
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Release Workflows' (Protocol in workflow.md)
