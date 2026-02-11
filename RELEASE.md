# Release Process

This document describes how to create a new release with executable installers for Windows, macOS, and Linux.

## Overview

The project uses GitHub Actions to automatically build and publish installers when version tags are created. The workflows are located in `.github/workflows/`:

- **`release.yml`** - Builds installers and creates a GitHub release when a version tag is pushed
- **`build-test.yml`** - Tests builds on pull requests and pushes to main/master branches
- **`tests.yml`** - Runs tests and version sync check on CI

## Version Management

### Version Locations

The version is stored in three files and must stay in sync:

1. `package.json` - `version` field
2. `src-tauri/tauri.conf.json` - `version` field
3. `src-tauri/Cargo.toml` - `version` field in `[package]` section

### Version Bump Script

Use the provided script to bump versions across all files:

```bash
# Show what would change (dry run)
npm run version:bump 1.2.0 -- --dry-run

# Bump version in all files
npm run version:bump 1.2.0

# Bump version and create commit
npm run version:bump 1.2.0 -- --commit

# Bump version, create commit, and create tag
npm run version:bump 1.2.0 -- --commit --tag

# Bump version, create commit, create tag, and push to remote
npm run version:bump 1.2.0 -- --commit --tag --push
```

### Version Sync Check

CI automatically checks that versions are in sync. To check manually:

```bash
npm run version:check
```

## Conventional Commits

This project uses conventional commits for automatic changelog generation.

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description | Changelog Section |
|------|-------------|-------------------|
| `feat` | New feature | 🚀 Features |
| `fix` | Bug fix | 🐛 Bug Fixes |
| `docs` | Documentation | Other Changes |
| `style` | Formatting | Not included |
| `refactor` | Code refactoring | Not included |
| `perf` | Performance | Other Changes |
| `test` | Tests | Not included |
| `build` | Build system | Not included |
| `ci` | CI configuration | Not included |
| `chore` | Maintenance | Not included |

### Examples

```bash
feat(ui): Add file tree search filters
fix(indexing): Handle large files correctly
docs(readme): Update installation instructions
chore: Bump dependencies
```

## Creating a Release

### Quick Release (Recommended)

Use the version bump script to automate everything:

```bash
# 1. Ensure working directory is clean
git status

# 2. Run the version bump script with all options
npm run version:bump 1.2.0 -- --commit --tag --push
```

This will:
1. Update version in all three files
2. Create a commit with the version change
3. Create a git tag
4. Push the commit and tag to remote

### Manual Release

If you prefer to do it manually:

#### 1. Update Version Numbers

```bash
# Using the bump script (recommended)
npm run version:bump 1.2.0
```

Or manually update:
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

#### 2. Verify Version Sync

```bash
npm run version:check
```

#### 3. Commit Version Changes

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to 1.2.0"
```

#### 4. Create and Push Tag

```bash
git tag v1.2.0
git push origin main
git push origin v1.2.0
```

### 5. Monitor the Workflow

You can monitor the build progress:
1. Go to the **Actions** tab in GitHub
2. Click on the "Release Installers" workflow run
3. View the status of each platform build

### 6. Edit Release Notes (Optional)

After the workflow completes:
1. Go to the **Releases** page
2. Click **Edit** on the new release
3. Update the release notes if needed

## Release Artifacts

Each release includes installers for all supported platforms:

| Platform | Installer Type | File Extension |
|----------|----------------|----------------|
| Windows  | MSI Installer  | `.msi`         |
| macOS    | DMG Disk Image | `.dmg`         |
| Linux    | AppImage       | `.AppImage`    |
| Linux    | Debian Package | `.deb`         |

## Changelog Generation

The release workflow automatically generates a changelog from conventional commits:

- **Features**: Commits starting with `feat:`
- **Bug Fixes**: Commits starting with `fix:`
- **Other Changes**: Other conventional commit types

### Example Generated Changelog

```markdown
## What's Changed

### 🚀 Features
- feat(search): Add regex pattern support
- feat(ui): Add file type filters

### 🐛 Bug Fixes
- fix(indexing): Handle symlink directories

### 📝 Other Changes
- docs: Update README
- chore: Bump dependencies

---

**Full Changelog**: https://github.com/user/repo/compare/v1.1.0...v1.2.0
```

## Troubleshooting

### Build Fails on a Specific Platform

If the build fails on one platform:
1. Check the workflow logs in the Actions tab
2. Common issues:
   - Missing dependencies (see `build-test.yml` for required packages)
   - Rust compilation errors
   - Frontend build errors
   - Code signing issues (macOS/Windows)

### Version Mismatch

If the version check fails:

```bash
# Check current versions
npm run version:check

# Fix by bumping to the correct version
npm run version:bump 1.2.0
```

### Tag Already Exists

If you need to re-create a release:
```bash
# Delete the tag locally and remotely
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0

# Delete the release in GitHub UI
# Then create the tag again
git tag v1.2.0
git push origin v1.2.0
```

## Development Testing

To test builds without creating a release, the `build-test.yml` workflow runs automatically on:
- Pull requests to `main`/`master`
- Pushes to `main`/`master` branches

This ensures that builds work correctly before creating a release.

## Quick Reference

| Task | Command |
|------|---------|
| Check version sync | `npm run version:check` |
| Bump version (dry run) | `npm run version:bump X.Y.Z -- --dry-run` |
| Bump version | `npm run version:bump X.Y.Z` |
| Bump and commit | `npm run version:bump X.Y.Z -- --commit` |
| Bump, commit, tag | `npm run version:bump X.Y.Z -- --commit --tag` |
| Full release | `npm run version:bump X.Y.Z -- --commit --tag --push` |
| Run all tests | `npm run test:all` |
| Create git tag | `git tag -a vX.Y.Z -m "Release X.Y.Z"` |
| Push tag | `git push origin vX.Y.Z` |
