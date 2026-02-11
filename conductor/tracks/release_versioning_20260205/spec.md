# Release & Versioning

## Current State

### Version Management
- Version defined in `tauri.conf.json` (`version` field) and `package.json`
- Version in `Cargo.toml` should match
- Frontend reads version dynamically via `getVersion()` from `@tauri-apps/api/app`
- Footer displays the version from Tauri config (no longer hardcoded)

### Version Sync (NEW)
- `scripts/version-sync.ts` - Core module for reading/writing versions
- `scripts/bump-version.ts` - CLI tool to bump versions across all files
- `scripts/check-version.ts` - Validation script for CI
- `scripts/version-sync.test.ts` - Unit tests for version sync
- CI step `npm run version:check` validates sync before builds

### Conventional Commits (NEW)
- `commitlint.config.js` with conventional config
- Husky pre-commit hook runs version sync check
- Husky commit-msg hook validates commit format
- Changelog auto-generated from conventional commits in release workflow

### Release Workflows

#### Tag-triggered Release (`.github/workflows/release.yml`)
- Triggered by pushing a tag matching `v*` (e.g., `v1.0.0`)
- Validates version sync before proceeding
- Generates changelog from conventional commits
- Creates draft GitHub Release
- Builds on Windows, macOS (universal), Linux
- Uses `tauri-apps/tauri-action` for builds
- Uploads MSI, DMG, AppImage, DEB installers
- Auto-publishes release after all builds complete

#### Manual Release (`.github/workflows/manual-release.yml`)
- Triggered via workflow_dispatch with version input
- Validates version format, creates git tag
- Auto-generates categorized release notes from commit history
- Builds independently on each platform (Windows, macOS, Linux)
- Uploads platform-specific installers
- Publishes release when all builds succeed

#### CI/CD (`.github/workflows/tests.yml`, `build-test.yml`)
- Version sync check runs on every push
- Commitlint runs on all PRs
- Tests run on push/PR to master/main
- Rust tests, frontend tests, type checking, linting
- Build test on all 3 platforms

### Version Bump Process (Documented in RELEASE.md)
1. Run `npm run version:bump <version> [--commit] [--tag] [--push]`
2. Script updates all three files
3. Optional flags create commit, tag, and push
4. Tag push triggers release workflow

## Documentation
- `RELEASE.md` - Comprehensive release process documentation
- `CHANGELOG.md` - Version history

## Summary

All release and versioning features are now implemented:
- ✅ Version sync with CI enforcement
- ✅ Release documentation
- ✅ Conventional commits enforcement
- ✅ Auto-generated changelogs
