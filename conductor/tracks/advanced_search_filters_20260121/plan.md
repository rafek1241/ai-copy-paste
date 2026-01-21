# Implementation Plan - Advanced Search Filters

## Phase 1: Core Filter Parser

### Task 1.1: Create search filter parser utility
- Create `src/lib/searchFilters.ts`
- Implement `parseSearchQuery(query: string): SearchFilters` function
- Support detection of:
  - `file:<name>` patterns
  - `dir:<name>` patterns
  - Regex patterns (auto-detect by checking for `/.*?[]+()|^${}` characters)
  - Plain text queries
- Implement AND logic: space-separated patterns are AND'd together
- Return structured filter object:
  ```typescript
  interface SearchFilters {
    fileName?: string;           // fuzzy search string
    directoryName?: string;       // directory name match
    regex?: RegExp;               // compiled regex pattern
    plainText?: string;           // simple substring match
  }
  ```

### Task 1.2: Implement fuzzy matching algorithm
- Create `src/lib/fuzzyMatch.ts`
- Implement `fuzzyScore(target: string, query: string): number`
- Algorithm should calculate "distance" based on character differences
- Higher score = better match (fewer differences)
- Use Damerau-Levenshtein distance or similar algorithm
- Ensure case-insensitive matching
- Score formula: `1 - (distance / max(len(target), len(query)))`
- Minimum threshold: only show matches with score > 0.3

---

## Phase 2: Update FileTree Component

### Task 2.1: Refactor matchesFilter logic
- Update `src/components/FileTree/FileTree.tsx` (lines 32-52)
- Replace simple substring matching with new filter parser
- Apply AND logic: node must match ALL provided filters
- For file filters: use fuzzy score to rank, but filter to show all matches above threshold
- For directory filters: match directory name (case-insensitive)
- For regex: test both filename and full path
- Maintain backward compatibility with existing search behavior

### Task 2.2: Add search result sorting
- Modify `buildFlatTree` function to sort results by fuzzy score when using file filter
- Highest matches first (fewest character differences)
- Ensure folders still appear before files in hierarchy

---

## Phase 3: Header Component Enhancements

### Task 3.1: Implement context-aware tooltip
- Update `src/components/Header.tsx`
- Add tooltip component with timing logic:
  - Show when input is empty
  - Hide immediately when user starts typing
  - Reappear after 3 seconds of inactivity
- Tooltip content: Help text with examples:
  ```
  Advanced search:
  • file:name - fuzzy match filename
  • dir:name - filter by directory
  • /pattern$/ - auto-detected regex
  • Combine: file:App dir:src (AND logic)
  ```
- Use debouncing for the 3-second reappear timer
- Use `useState` for tooltip visibility: `'initial' | 'hidden' | 'ready'`

### Task 3.2: Add Enter key handler
- Add keyDown event listener to search input
- On Enter: blur the input field (mark search as "done")
- Keep search value visible so user knows their query

### Task 3.3: Update placeholder text
- Change from "Search files..." to dynamic placeholder
- When empty: "Search files... (hover for help)"
- When typing: keep current behavior

---

## Phase 4: Testing

### Task 4.1: Unit tests for filter parser
- Create `src/lib/searchFilters.test.ts`
- Test cases:
  - Plain text queries
  - Single file: pattern
  - Single dir: pattern
  - Regex patterns (auto-detection)
  - Multiple filters with AND logic
  - Edge cases (empty input, whitespace, special chars)

### Task 4.2: Unit tests for fuzzy matching
- Create `src/lib/fuzzyMatch.test.ts`
- Test cases:
  - Exact match = highest score
  - Partial match = medium score
  - No match = zero score
  - Case-insensitive matching
  - Prioritization (app.tsx vs app.test.tsx)

### Task 4.3: Update Header component tests
- Update `src/components/Header.test.tsx`
- Add tests for:
  - Tooltip visibility states (empty, typing, after 3s delay)
  - Enter key blur behavior

### Task 4.4: Update E2E search tests
- Update `e2e/tests/file-tree.spec.ts` (lines 273-350)
- Add test cases:
  - Fuzzy file search: search "App" and verify app.tsx appears before app.test.tsx
  - Directory filter: search "dir:src" and verify only src contents show
  - Regex search: search "/\.test\.ts$/" and verify only test files match
  - Combined filters: search "file:App dir:src" and verify both conditions apply
  - Tooltip timing: verify tooltip behavior with different interaction patterns

---

## Phase 5: Documentation

### Task 5.1: Update product guidelines
- Document the new search syntax in `conductor/product-guidelines.md`
- Add examples for each filter type
- Explain fuzzy search behavior

### Task 5.2: Update user manual
- Add search functionality section with examples
- Include troubleshooting for common issues

---

## Technical Notes

### Fuzzy Matching Algorithm
- Consider using a lightweight library like `fuse.js` or implement simple Levenshtein distance
- Score formula: `1 - (distance / max(len(target), len(query)))`
- Minimum threshold: only show matches with score > 0.3
- Case-insensitive matching for better user experience

### Regex Auto-Detection Logic
- Detect if query contains: `[`, `]`, `(`, `)`, `*`, `+`, `?`, `|`, `{`, `}`, `^`, `$`, `.`
- Try to compile as regex, if fails treat as plain text
- Consider wrapping in `/.../` format for clarity

### Tooltip Implementation Details
- Use `useState` for tooltip visibility: `'initial' | 'hidden' | 'ready'`
- Use `useEffect` with timeout for 3-second reappear logic
- Cancel timeout on new keystrokes
- Tooltip should be positioned above the search input

### Backward Compatibility
- Maintain existing simple substring matching for queries without special patterns
- No breaking changes to existing test cases
- All existing functionality should continue to work as before
