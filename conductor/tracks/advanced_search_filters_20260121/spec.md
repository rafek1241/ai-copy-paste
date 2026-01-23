# Specification - Advanced Search Filters

## Overview
This track adds advanced filtering capabilities to the search header textbox in the file tree component. The enhancement will support fuzzy file matching, directory filtering, regex patterns, and intelligent help UI.

## Functional Requirements

### Search Filter Syntax
Users can type combinations of the following patterns in the search box:

1. **Fuzzy File Matching** - `file:<name>`
   - Matches filenames using fuzzy search
   - Prioritizes closest matches (fewest character differences)
   - Example: `file:App` matches `App.tsx` (higher priority) and `app.test.tsx` (lower priority)
   - Case-insensitive

2. **Directory Filtering** - `dir:<name>`
   - Filters to show only files/directories within matching folders
   - Example: `dir:src` shows only contents of directories named "src"
   - Case-insensitive

3. **Regex Patterns** - Auto-detected
   - Automatically detects regex by checking for special characters: `/.*?[]+()|^${}`
   - Example: `/\.test\.ts$/` matches all test TypeScript files
   - Matches against both filename and full path

4. **Combined Filters** - AND Logic
   - Multiple filters are AND'd together (space-separated)
   - Example: `file:App dir:src` shows only files matching "App" within "src" directories
   - All conditions must be satisfied for a match

5. **Plain Text** - Backward Compatible
   - Any query without special patterns performs simple substring matching (current behavior)
   - Example: `test` matches both filename and path containing "test"

### Search Result Prioritization
- Fuzzy matches are scored and sorted
- Higher score (fewer differences) = higher priority
- Folders maintain their hierarchy position
- Regex and directory filters apply additional constraints

## Non-Functional Requirements

### Performance
- Fuzzy scoring should be fast enough for real-time typing
- No UI lag with large file trees
- Debounce search input (current implementation should be maintained)

### User Experience
- Context-aware tooltip helps users discover advanced syntax
- Enter key blurs the search input (marks search as "done")
- Maintains existing search expansion/collapse behavior
- Clear visual feedback for search state

### Code Quality
- Maintain backward compatibility with existing search behavior
- No breaking changes to existing tests
- Follow project code style conventions
- Add comprehensive unit tests for new utilities

## Acceptance Criteria

### Functionality
- [ ] Fuzzy file matching works with `file:` prefix
- [ ] Directory filtering works with `dir:` prefix
- [ ] Regex patterns are auto-detected and work correctly
- [ ] Multiple filters work with AND logic
- [ ] Plain text queries still work (backward compatible)
- [ ] Results are prioritized by fuzzy score when using `file:`

### User Interface
- [ ] Tooltip shows when search input is empty
- [ ] Tooltip hides when user starts typing
- [ ] Tooltip reappears after 3 seconds of inactivity
- [ ] Enter key blurs the search input
- [ ] Search expansion/collapse behavior is preserved

### Testing
- [ ] Unit tests for search filter parser
- [ ] Unit tests for fuzzy matching algorithm
- [ ] Updated Header component tests
- [ ] Updated E2E search tests covering all new patterns
- [ ] All tests pass

### Documentation
- [ ] Product guidelines updated with search syntax
- [ ] User manual includes search functionality section

## Out of Scope

- Complex regex validation/warnings
- Search history or saved searches
- Filter builder UI (all filters are typed manually)
- Performance optimization beyond real-time typing requirements
- Accessibility compliance beyond existing standards
- Advanced fuzzy match options (configurable scoring thresholds, etc.)

## Edge Cases to Handle

- Empty search query
- Whitespace-only queries
- Invalid regex patterns (fallback to plain text)
- Mixed valid/invalid filters
- Case sensitivity (should be case-insensitive)
- Special characters in filenames/directories
- Very long search queries
- Unicode characters in queries
