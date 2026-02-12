# Specification: Release & Versioning

## Overview
Implement a complete release and versioning system that ensures version consistency across all configuration files, enforces conventional commits for automated changelog generation, and displays the current version dynamically in the UI.

## Functional Requirements

### 1. Version Management
- **Source of Truth**: Version is defined in `tauri.conf.json` (`version` field)
- **Sync Required**: Version must be synchronized across:
  - `tauri.conf.json` (source of truth)
  - `package.json` (npm/frontend)
  - `Cargo.toml` (Rust backend)
- **Validation**: CI must verify all three files have matching versions before builds

### 2. UI Version Display
- **Location**: Bottom-right corner of the application footer
- **Format**: Displayed as "v{version}" (e.g., "v1.0.0")
- **Dynamic**: Must read version from Tauri config at runtime using `getVersion()` from `@tauri-apps/api/app`
- **Fallback**: Display "v0.0.0" if version cannot be retrieved

### 3. Version Bump Process
- **CLI Tool**: `npm run version:bump <version> [--commit] [--tag] [--push]`
- **Automation**: Script updates all three files (tauri.conf.json, package.json, Cargo.toml)
- **Git Integration**: Optional flags to create commit, tag, and push
- **Trigger**: Tag push triggers release workflow

### 4. Conventional Commits
- **Enforcement**: Commit messages must follow conventional commit format
- **Tools**: 
  - `commitlint` with conventional config
  - Husky pre-commit and commit-msg hooks
- **CI Check**: All PRs validated for conventional commit format

### 5. Release Workflows

#### Tag-triggered Release (`.github/workflows/release.yml`)
- **Trigger**: Pushing a tag matching `v*` (e.g., `v1.0.0`)
- **Validation**: Version sync check before proceeding
- **Changelog**: Auto-generated from conventional commits with categories:
  - Features
  - Bug Fixes
  - Other Changes
- **Builds**: Windows, macOS (universal), Linux
- **Artifacts**: MSI, DMG, AppImage, DEB installers

#### Manual Release (`.github/workflows/manual-release.yml`)
- **Trigger**: Workflow dispatch with version input
- **Process**: Validates version, creates git tag, generates release notes
- **Platforms**: Independent builds on Windows, macOS, Linux

#### CI/CD Integration
- **Tests**: Run on every push/PR to master/main
- **Checks**: Version sync, commitlint, Rust tests, frontend tests, type checking, linting
- **Build Test**: All 3 platforms

## Documentation
- `RELEASE.md` - Comprehensive release process documentation
- `CHANGELOG.md` - Version history (manual tracking)

## Acceptance Criteria
- [x] Version is displayed dynamically in bottom-right corner (no hardcoded values)
- [x] All three version files (tauri.conf.json, package.json, Cargo.toml) stay in sync
- [x] CI validates version sync before builds
- [x] Conventional commits enforced locally and in CI
- [x] Changelogs auto-generated from commit history
- [x] Release workflow creates builds for all platforms
- [x] Version bump process documented and working

## Non-Functional Requirements
- **Reliability**: Version sync check prevents inconsistent releases
- **Automation**: Minimal manual steps for releasing
- **Traceability**: Git tags and changelogs provide clear version history
