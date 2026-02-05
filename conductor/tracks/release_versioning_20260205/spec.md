# Release & Versioning

## Current State

### Version Management
- Version defined in `tauri.conf.json` (`version` field) and `package.json`
- Version in `Cargo.toml` should match
- Frontend reads version dynamically via `getVersion()` from `@tauri-apps/api/app`
- Footer displays the version from Tauri config (no longer hardcoded)

### Release Workflows (already exist)

#### Tag-triggered Release (`.github/workflows/release.yml`)
- Triggered by pushing a tag matching `v*` (e.g., `v1.0.0`)
- Creates draft GitHub Release
- Builds on Windows, macOS (universal), Linux
- Uses `tauri-apps/tauri-action` for builds
- Uploads MSI, DMG, AppImage, DEB installers
- Auto-publishes release after all builds complete

#### Manual Release (`.github/workflows/manual-release.yml`)
- Triggered via workflow_dispatch with version input
- Validates version format, creates git tag
- Auto-generates release notes from commit history
- Builds independently on each platform (Windows, macOS, Linux)
- Uploads platform-specific installers
- Publishes release when all builds succeed

#### CI/CD (`.github/workflows/tests.yml`, `build-test.yml`)
- Tests run on push/PR to master/main
- Rust tests, frontend tests, type checking, linting
- Build test on all 3 platforms

### Remaining Work
- [ ] Ensure version in `Cargo.toml`, `package.json`, and `tauri.conf.json` stay in sync
- [ ] Add version bump script or CI check
- [ ] Consider adding changelog generation
