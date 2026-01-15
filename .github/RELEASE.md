# Release Process

This document describes how to create a new release with executable installers for Windows, macOS, and Linux.

## Overview

The project uses GitHub Actions to automatically build and publish installers when version tags are created. The workflows are located in `.github/workflows/`:

- **`release.yml`** - Builds installers and creates a GitHub release when a version tag is pushed
- **`build-test.yml`** - Tests builds on pull requests and pushes to main/master branches

## Creating a Release

### 1. Update Version Numbers

Before creating a release, update the version in these files:

- `package.json` - Update the `version` field
- `src-tauri/tauri.conf.json` - Update the `version` field
- `src-tauri/Cargo.toml` - Update the `version` field

Example:
```json
// package.json
{
  "version": "0.2.0"
}
```

```json
// src-tauri/tauri.conf.json
{
  "version": "0.2.0"
}
```

```toml
# src-tauri/Cargo.toml
[package]
version = "0.2.0"
```

### 2. Commit Version Changes

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to 0.2.0"
git push origin main
```

### 3. Create and Push a Version Tag

Create a tag following semantic versioning (v{MAJOR}.{MINOR}.{PATCH}):

```bash
git tag v0.2.0
git push origin v0.2.0
```

### 4. GitHub Actions Workflow

Once the tag is pushed, GitHub Actions automatically:

1. **Creates a draft release** with the tag name
2. **Builds installers** for all platforms in parallel:
   - **Windows**: `.msi` installer
   - **macOS**: `.dmg` installer (Universal binary for Intel & Apple Silicon)
   - **Linux**: `.AppImage` and `.deb` packages
3. **Uploads installers** to the draft release
4. **Publishes the release** automatically

### 5. Monitor the Workflow

You can monitor the build progress:
1. Go to the **Actions** tab in GitHub
2. Click on the "Release Installers" workflow run
3. View the status of each platform build

### 6. Edit Release Notes (Optional)

After the workflow completes:
1. Go to the **Releases** page
2. Click **Edit** on the new release
3. Update the release notes with:
   - New features
   - Bug fixes
   - Breaking changes
   - Known issues

## Release Artifacts

Each release includes installers for all supported platforms:

| Platform | Installer Type | File Extension |
|----------|----------------|----------------|
| Windows  | MSI Installer  | `.msi`         |
| macOS    | DMG Disk Image | `.dmg`         |
| Linux    | AppImage       | `.AppImage`    |
| Linux    | Debian Package | `.deb`         |

## Troubleshooting

### Build Fails on a Specific Platform

If the build fails on one platform:
1. Check the workflow logs in the Actions tab
2. Common issues:
   - Missing dependencies (see `build-test.yml` for required packages)
   - Rust compilation errors
   - Frontend build errors
   - Code signing issues (macOS/Windows)

### Tag Already Exists

If you need to re-create a release:
```bash
# Delete the tag locally and remotely
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0

# Delete the release in GitHub UI
# Then create the tag again
git tag v0.2.0
git push origin v0.2.0
```

## Development Testing

To test builds without creating a release, the `build-test.yml` workflow runs automatically on:
- Pull requests to `main`/`master`
- Pushes to `main`/`master` branches

This ensures that builds work correctly before creating a release.
