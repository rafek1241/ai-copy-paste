# Implementation Plan - .gitignore Support

## Phase 1: Backend Settings Integration

### Task 1.1: Update AppSettings struct
- Modify `src-tauri/src/commands/settings.rs`
- Add new field `pub respect_gitignore: bool` to `AppSettings` struct
- Set default value to `true` in `Default` implementation
- Update `load_settings_internal` to parse `respect_gitignore` setting
- Update `save_settings_internal` to save `respect_gitignore` setting
- Add unit tests for the new setting

### Task 1.2: Update Frontend Settings Types
- Modify `src/components/Settings.tsx`
- Add `respect_gitignore: boolean` to `AppSettings` interface
- Initialize with `true` as default value

---

## Phase 2: .gitignore Pattern Parser

### Task 2.1: Add dependency for .gitignore parsing
- Check available .gitignore parsing crates: `ignore`, `globset`, `glob`
- Add chosen dependency to `src-tauri/Cargo.toml`
- Recommended: `ignore` crate (feature-rich, well-maintained)

### Task 2.2: Create .gitignore parser module
- Create `src-tauri/src/gitignore.rs`
- Implement `GitignoreManager` struct with methods:
  - `new() -> Self` - Create a new manager instance
  - `add_patterns_from_file(path: &Path) -> Result<(), Error>` - Load patterns from .gitignore file
  - `is_ignored(path: &Path) -> bool` - Check if path matches any ignore pattern
  - `clear() -> Self` - Clear all loaded patterns
- Support standard .gitignore features:
  - Wildcards (`*`)
  - Directory wildcards (`**`)
  - Negation patterns (`!`)
  - Directory-specific patterns (ending with `/`)
  - Comments (`#`)
- Add unit tests for pattern matching

### Task 2.3: Integrate GitignoreManager into indexing
- Modify `src-tauri/src/commands/indexing.rs`
- Import `GitignoreManager` from new module
- Add `GitignoreManager` as parameter to `parallel_index_folder` and `traverse_and_insert`
- During directory traversal, check for `.gitignore` files in each directory
- Load patterns from discovered `.gitignore` files
- Filter out files/directories that match loaded patterns
- Preserve `.gitignore` files themselves (don't ignore them)
- Handle multiple `.gitignore` files with correct precedence

---

## Phase 3: File Filtering Integration

### Task 3.1: Update indexing to use .gitignore patterns
- Modify `parallel_index_folder` function in `src-tauri/src/commands/indexing.rs`
- Load settings to check `respect_gitignore` flag
- If flag is enabled:
  - Create `GitignoreManager` instance
  - During WalkDir traversal:
    - Check each directory for `.gitignore` file
    - If found, parse and add patterns to manager
    - Use manager to filter entries before collecting
  - Skip entries that match ignore patterns
- If flag is disabled, proceed with current behavior (index everything)

### Task 3.2: Add caching for .gitignore patterns
- Create pattern cache: `HashMap<PathBuf, Vec<Pattern>>`
- Cache parsed patterns per directory
- Invalidate cache when `.gitignore` file is modified
- Consider adding file watching for `.gitignore` changes (future enhancement)

### Task 3.3: Handle nested .gitignore precedence
- Implement correct precedence rules:
  - Patterns in `.gitignore` closer to file take priority
  - Negation patterns can override previous patterns
  - Multiple `.gitignore` files in directory hierarchy are cumulative
- Test with nested directory structures containing multiple `.gitignore` files

---

## Phase 4: Frontend Settings UI

### Task 4.1: Add .gitignore toggle to Settings component
- Modify `src/components/Settings.tsx`
- Add new toggle section in the "Files" section
- Toggle label: "Respect .gitignore rules"
- Description: "Automatically exclude files matching .gitignore patterns during indexing"
- Use same toggle component as "Auto-save History"
- Position after "Excluded Extensions" section

### Task 4.2: Connect toggle to backend
- Ensure toggle changes trigger `saveSettings` function
- Verify new setting is persisted to database
- Test that changes take effect immediately (no restart needed)
- Test that setting persists across application restarts

### Task 4.3: Add visual feedback
- When setting is enabled, show indicator in file tree that files are being filtered
- Optional: Add tooltip or hint showing number of ignored files
- Consider adding option to temporarily show ignored files (future enhancement)

---

## Phase 5: Testing

### Task 5.1: Unit tests for .gitignore parser
- Create `src-tauri/src/gitignore.rs` with test module
- Test cases:
  - Basic wildcard patterns (`*.log`, `temp/*`)
  - Directory wildcards (`**/node_modules`)
  - Negation patterns (`!important.log`)
  - Directory-specific patterns (`config/`)
  - Comment lines (should be ignored)
  - Empty patterns (should be handled gracefully)
  - Complex nested patterns
  - Case sensitivity (should match Git behavior)

### Task 5.2: Integration tests for indexing with .gitignore
- Add tests to `src-tauri/src/commands/indexing.rs`
- Test scenarios:
  - Single `.gitignore` file with basic patterns
  - Multiple `.gitignore` files in nested directories
  - Conflicting patterns with correct precedence
  - `.gitignore` file should not be ignored
  - Performance with large `.gitignore` files
  - Edge cases: symlinks, special characters, Unicode names
  - Setting enabled vs disabled behavior

### Task 5.3: Frontend Settings component tests
- Update `src/components/Settings.test.tsx`
- Test cases:
  - Toggle renders correctly
  - Toggle state updates when clicked
  - Setting saves correctly to backend
  - Setting persists across component remounts

### Task 5.4: E2E tests
- Update `e2e/tests/settings.spec.ts`
- Test scenarios:
  - Enable/disable .gitignore support toggle
  - Verify files are filtered/ignored when setting is enabled
  - Verify all files are indexed when setting is disabled
  - Test with sample project containing `.gitignore` file

---

## Phase 6: Documentation

### Task 6.1: Update product guidelines
- Document `.gitignore` support feature in `conductor/product-guidelines.md`
- Explain default behavior (enabled by default)
- Describe how patterns are parsed and applied
- Provide examples of common .gitignore patterns

### Task 6.2: Update Settings documentation
- Add section about .gitignore support
- Explain toggle functionality
- Provide troubleshooting tips

### Task 6.3: Update user manual
- Add section on file filtering options
- Explain how `.gitignore` patterns work
- Provide examples and best practices

---

## Technical Notes

### Pattern Matching Library
- Recommended: `ignore` crate (https://crates.io/crates/ignore)
- Alternative: `globset` or `glob` crates
- `ignore` provides:
  - Full .gitignore syntax support
  - Directory walker with built-in ignore support
  - Performance optimizations
  - Well-tested implementation

### Implementation Pattern for .gitignore Loading
```rust
// During directory traversal
if path_is_dir && path.join(".gitignore").exists() {
    let gitignore_path = path.join(".gitignore");
    gitignore_manager.add_patterns_from_file(&gitignore_path)?;
}

// Before adding entry to index
if gitignore_manager.is_ignored(&entry_path) {
    continue; // Skip this entry
}
```

### Precedence Rules
- Git's .gitignore precedence:
  1. Patterns from `.gitignore` in same directory as file
  2. Patterns from parent directories (upward)
  3. Later patterns override earlier patterns in same file
  4. Negation patterns (`!`) override earlier matching patterns

### Settings Storage
- Key: `respect_gitignore`
- Type: boolean
- Default: `true`
- Storage: SQLite database in `settings` table

### Performance Considerations
- Cache compiled patterns to avoid re-parsing
- Batch pattern checks during parallel traversal
- Limit pattern complexity to avoid performance issues
- Profile with large codebases (>100k files)

### Error Handling
- Gracefully handle malformed `.gitignore` files
- Log warnings but continue indexing
- Skip invalid patterns with error messages
- Handle permission errors gracefully

---

## Dependencies

### Rust Dependencies (to add to Cargo.toml)
- `ignore` ^0.4 (or latest version)

### TypeScript Dependencies
- No new TypeScript dependencies required
- Uses existing Tauri API for settings

---

## Success Criteria

- [ ] .gitignore files are read during directory indexing
- [ ] Files matching .gitignore patterns are excluded from index
- [ ] Settings toggle enables/disables feature
- [ ] Multiple .gitignore files work with correct precedence
- [ ] .gitignore files themselves are not ignored
- [ ] Setting persists across application restarts
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Performance acceptable with large codebases
- [ ] Documentation updated
