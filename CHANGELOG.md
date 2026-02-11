# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version sync script (`scripts/version-sync.js`) to ensure version consistency across Cargo.toml, package.json, and tauri.conf.json
- CI check for version sync in tests workflow
- Commitlint configuration for conventional commits enforcement
- Conventional commits CI check for pull requests
- Auto-generated categorized changelog in release workflow

### Changed
- Enhanced manual release workflow with categorized commit sections (Features, Bug Fixes, Documentation, Performance, Refactoring, Other)

## [0.1.0] - 2024-02-05

### Added
- Core infrastructure with Tauri 2.0
- File traversal engine with virtual tree UI
- Text extraction for multiple file formats
- Token counting and prompt building
- Browser automation features
- History and persistence
- Context menu installers for Windows, macOS, and Linux

---

[Unreleased]: https://github.com/aicontextcollector/ai-context-collector/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aicontextcollector/ai-context-collector/releases/tag/v0.1.0
