# Specification - .gitignore Support

## Overview
This track adds support for reading `.gitignore` files from indexed directories and automatically excluding files that match `.gitignore` patterns. The feature includes a user-configurable setting to enable or disable this functionality.

## Functional Requirements

### .gitignore Pattern Parsing
- Support standard `.gitignore` pattern syntax:
  - Wildcards: `*` (matches any characters except `/`)
  - Directory wildcards: `**` (matches zero or more directories)
  - Literal filenames and paths
  - Negation patterns starting with `!`
  - Directory-specific patterns ending with `/`
  - Comment lines starting with `#`
- Parse multiple `.gitignore` files from different directories
- Apply patterns with correct precedence (closest `.gitignore` has priority)

### File Filtering Behavior
- Automatically exclude files matching any `.gitignore` pattern during indexing
- Apply filtering at both directory scan and file tree display levels
- Maintain parent-child consistency: if parent is ignored, children are not shown
- Preserve `.gitignore` files themselves (they should remain visible)

### Settings Integration
- Add toggle setting: "Respect .gitignore rules" (enabled by default)
- Store setting in application preferences
- Apply setting changes immediately (no restart required)
- Persist setting across application sessions

### Performance Requirements
- Parse `.gitignore` files efficiently during directory scanning
- Cache parsed patterns to avoid re-reading files
- No significant performance impact on large codebases

## Non-Functional Requirements

### User Experience
- Clear visual indication when files are being filtered
- Option to show ignored files (toggle in UI or per folder)
- Settings page provides clear description of the feature
- Real-time feedback when setting is toggled

### Code Quality
- Use existing `.gitignore` parsing library if available (e.g., `ignore`, `globby`)
- Follow project code style conventions
- Add comprehensive unit tests for pattern matching
- Maintain backward compatibility with existing file indexing

### Error Handling
- Gracefully handle malformed `.gitignore` files
- Log errors but continue indexing
- Invalid patterns should be skipped with warnings

## Acceptance Criteria

### Functionality
- [ ] Read `.gitignore` files from indexed directories
- [ ] Parse and apply standard `.gitignore` patterns correctly
- [ ] Exclude matching files from file tree and clipboard output
- [ ] Settings toggle enables/disables feature
- [ ] Setting persists across application restarts
- [ ] Multiple `.gitignore` files work correctly with precedence

### User Interface
- [ ] Settings page includes toggle for .gitignore support
- [ ] Toggle clearly labeled with description
- [ ] Setting changes apply immediately
- [ ] Visual indication when files are filtered (optional enhancement)

### Testing
- [ ] Unit tests for `.gitignore` pattern parsing
- [ ] Unit tests for file filtering logic
- [ ] Integration tests for directory scanning with `.gitignore`
- [ ] E2E tests for settings toggle functionality
- [ ] Performance tests with large codebases
- [ ] All existing tests continue to pass

### Documentation
- [ ] Product guidelines updated with `.gitignore` support description
- [ ] Settings documentation includes feature explanation
- [ ] User manual explains `.gitignore` behavior

## Out of Scope

- Editing `.gitignore` files through the app
- Custom pattern editor UI
- Advanced `.gitignore` features beyond standard syntax
- Pattern validation/warnings in UI
- Import/export of `.gitignore` patterns
- Per-project or per-directory .gitignore settings

## Edge Cases to Handle

- Nested `.gitignore` files with conflicting patterns
- `.gitignore` files in symlinked directories
- Very large `.gitignore` files
- Binary files matching patterns
- Files with Unicode names
- Empty `.gitignore` files
- Files with special characters in names
- Performance with thousands of patterns
- Recursive directory scanning depth limits

## Technical Notes

### Pattern Matching Library
- Consider using `ignore` npm package for `.gitignore` parsing
- Alternative: `minimatch` with custom glob patterns
- Implement custom parser if existing libraries are insufficient

### Pattern Precedence Rules
1. Patterns in `.gitignore` closer to the file take precedence
2. Negation patterns (`!`) can override previous patterns
3. Last matching pattern wins if patterns are at same level

### Caching Strategy
- Cache parsed `.gitignore` patterns per directory
- Invalidate cache when `.gitignore` file is modified
- Consider watching `.gitignore` files for changes (future enhancement)

### Settings Storage
- Use existing settings management system
- Default value: `true` (enabled)
- Setting key: `respectGitignore`
