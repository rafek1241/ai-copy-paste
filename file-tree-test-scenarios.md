# File Tree Test Scenarios

This document outlines all test scenarios covered for the File Tree component. These tests ensure the file tree behaves like a standard file explorer with paths as the source of truth.

## Table of Contents

1. [Path-Based Behavior](#path-based-behavior)
2. [Hierarchical Ordering](#hierarchical-ordering)
3. [Selection State](#selection-state)
4. [Expansion State](#expansion-state)
5. [Indexing Scenarios](#indexing-scenarios)
6. [Clear Context](#clear-context)
7. [Edge Cases](#edge-cases)
8. [E2E Tests](#e2e-tests)

---

## Path-Based Behavior

**File:** `tests/ui/components/FileTree/FileTree.paths.test.tsx`

### Paths as Unique Identifiers

| Scenario | Description | Status |
|----------|-------------|--------|
| Use path as unique identifier | Nodes are identified by their full file path, not numeric IDs | Covered |
| Windows-style paths | Handle `C:\Users\project\src\...` format correctly | Covered |
| Unix-style paths | Handle `/home/user/project/lib/...` format correctly | Covered |
| Special characters in paths | Handle paths with spaces, parentheses, brackets | Covered |

### Path Hierarchy Detection

| Scenario | Description | Status |
|----------|-------------|--------|
| Parent-child relationships | Correctly identify parent folder from child's path | Covered |
| Multiple root paths | Handle different drives/directories at root level | Covered |
| Nested path filtering | Don't show nested paths as roots when parent is already a root | Covered |
| Path-based node lookup | Maintain correct node references when paths change | Covered |

---

## Hierarchical Ordering

**File:** `tests/ui/components/FileTree/FileTree.hierarchy.test.tsx`

### Tree Structure

| Scenario | Description | Status |
|----------|-------------|--------|
| Group by folders | Display nodes grouped by their parent folders | Covered |
| Deep nesting (5+ levels) | Handle deeply nested folder structures | Covered |
| Correct indentation | Show proper indentation for each hierarchy level | Covered |
| Multiple root directories | Handle multiple independent root folders | Covered |
| Empty folders | Display empty folders correctly | Covered |
| Child count display | Show item count in folder labels | Covered |

### Folder Expansion

| Scenario | Description | Status |
|----------|-------------|--------|
| Expand on chevron click | Clicking chevron expands folder to show children | Covered |
| Collapse on second click | Clicking expanded chevron collapses folder | Covered |
| Toggle expand state | data-expanded attribute updates correctly | Covered |
| Independent expansion | Each folder maintains its own expansion state | Covered |
| Lazy load children | Children loaded only when folder is expanded | Covered |

---

## Selection State

**File:** `tests/ui/components/FileTree/FileTree.selection.test.tsx` & `FileTree.state.test.tsx`

### Basic Selection

| Scenario | Description | Status |
|----------|-------------|--------|
| Select file by checkbox | Clicking checkbox selects the file | Covered |
| Select folder selects all children | Checking folder checkbox checks all descendants | Covered |
| Deselect propagation | Unchecking folder unchecks all descendants | Covered |
| Toggle selection | Clicking again deselects | Covered |

### Indeterminate State

| Scenario | Description | Status |
|----------|-------------|--------|
| Partial selection shows indeterminate | Folder shows indeterminate when some children selected | Covered |
| Propagate indeterminate up | Indeterminate state bubbles to ancestor folders | Covered |
| Deep nesting indeterminate | Handle indeterminate state through multiple levels | Covered |
| Preserve indeterminate after collapse | State preserved when folder collapsed and re-expanded | Covered |

### Selection Preservation

| Scenario | Description | Status |
|----------|-------------|--------|
| Preserve on new file addition | Selection maintained when new files added | Covered |
| Preserve on collapse/expand | Selection maintained when parent folder collapsed | Covered |
| Preserve multiple selections | Multiple selected files stay selected | Covered |
| Restore from initialSelectedPaths | Selection restored from prop on mount | Covered |
| Clear selection via prop | shouldClearSelection prop clears all selections | Covered |

---

## Expansion State

**File:** `tests/ui/components/FileTree/FileTree.state.test.tsx`

### Expansion Preservation

| Scenario | Description | Status |
|----------|-------------|--------|
| Preserve on content refresh | Expansion state maintained when content refreshes | Covered |
| Maintain nested hierarchy | Child expansion preserved when parent collapses | Covered |
| Independent folder expansion | Collapsing one folder doesn't affect others | Covered |

---

## Indexing Scenarios

**File:** `tests/ui/components/FileTree/FileTree.indexing.test.tsx`

### Partial Directory Indexing

| Scenario | Description | Status |
|----------|-------------|--------|
| Index some files first | Display individual files before their folder | Covered |
| Merge on full directory index | Combine partial files when directory indexed | Covered |
| Preserve selection on merge | Selected files stay selected after merge | Covered |

### Full Directory Indexing

| Scenario | Description | Status |
|----------|-------------|--------|
| Adopt orphaned files | Files adopted under parent when parent indexed | Covered |
| Auto-expand with selected children | Parent auto-expands if contains selected files | Covered |

### Grandparent Directory

| Scenario | Description | Status |
|----------|-------------|--------|
| Handle grandparent indexing | Preserve selection through grandparent addition | Covered |
| Show ALL children | Display all folders, not just those with selections | Covered |
| Incremental folder addition | Handle adding sibling folders incrementally | Covered |

### Mixed Content

| Scenario | Description | Status |
|----------|-------------|--------|
| Files and folders at root | Handle mixed content at root level | Covered |
| Incremental file addition | Handle adding files to existing folder | Covered |

---

## Clear Context

**File:** `tests/ui/components/FileTree/FileTree.clear.test.tsx`

### Empty State

| Scenario | Description | Status |
|----------|-------------|--------|
| Display empty state | Show guidance when no files indexed | Covered |
| Search empty message | Show "no matching files" when search has no results | Covered |

### Clear Selection

| Scenario | Description | Status |
|----------|-------------|--------|
| Clear all via prop | shouldClearSelection clears all selections | Covered |
| Clear indeterminate state | Folders lose indeterminate state on clear | Covered |
| Clear nested selections | All nested selections cleared | Covered |
| Call onSelectionChange | Callback invoked with empty array | Covered |

### Clear File Tree

| Scenario | Description | Status |
|----------|-------------|--------|
| Show empty on all removed | Display empty state when all nodes removed | Covered |
| Re-index after clear | Handle fresh indexing after complete clear | Covered |
| Partial clear | Remove some nodes while keeping others | Covered |
| Preserve selection after partial | Remaining selections preserved | Covered |
| Fresh start after reset | Support new content after complete reset | Covered |

---

## Edge Cases

**File:** `tests/ui/components/FileTree/FileTree.edge-cases.test.tsx`

### Long Names

| Scenario | Description | Status |
|----------|-------------|--------|
| Very long file names | Handle 200+ character file names | Covered |
| Very long folder paths | Handle deeply nested paths (20 levels) | Covered |

### Special Characters

| Scenario | Description | Status |
|----------|-------------|--------|
| Spaces in names | Handle "my file.ts" | Covered |
| Unicode characters | Handle Chinese, Cyrillic, Greek characters | Covered |
| Special symbols | Handle dashes, underscores, apostrophes | Covered |
| Parentheses and brackets | Handle "project (backup)" and "project [v2]" | Covered |

### Large Scale

| Scenario | Description | Status |
|----------|-------------|--------|
| 100 children in folder | Handle folder with 100 files | Covered |
| 20 root folders | Handle many root folders | Covered |

### Rapid Interactions

| Scenario | Description | Status |
|----------|-------------|--------|
| Rapid expand/collapse | Handle 10+ rapid clicks without crash | Covered |
| Rapid checkbox clicks | Handle rapid selection changes | Covered |

### Null/Empty Values

| Scenario | Description | Status |
|----------|-------------|--------|
| Null optional fields | Handle null size, mtime, fingerprint | Covered |
| Zero size files | Handle 0-byte files | Covered |

### File Extensions

| Scenario | Description | Status |
|----------|-------------|--------|
| No extension | Handle Makefile, Dockerfile, .gitignore | Covered |
| Multiple dots | Handle file.test.spec.ts | Covered |

### Callback Behavior

| Scenario | Description | Status |
|----------|-------------|--------|
| Correct paths in callback | onSelectionChange receives correct paths | Covered |
| Only files in selection | Callback only includes file paths, not folders | Covered |

---

## E2E Tests

### File Tree Comprehensive (`file-tree-comprehensive.spec.ts`)

| Scenario | Description |
|----------|-------------|
| Path-based unique identifiers | Verify files use paths as IDs |
| Identify folder vs file nodes | Check data-node-type attributes |
| Hierarchical structure display | Verify tree structure on expand |
| Collapse/re-expand consistency | Node count remains same |
| Selection preservation on expand toggle | Selection maintained |
| Selection propagation to parent | Indeterminate state |
| Select all children via folder | Folder selection propagates |
| Multiple folder expansion independence | Each folder separate |
| Search filtering | Filter works without breaking tree |
| Filter buttons present | ALL, SRC, DOCS exist |
| Filter toggle behavior | Active state toggles |
| Rapid expand/collapse stability | No crash on rapid clicks |
| Rapid checkbox stability | No crash on rapid selections |
| Empty state guidance | Shows drag/drop message |
| Selection callback updates | Selection info updates |

### File Tree State (`file-tree-state.spec.ts`)

| Scenario | Description |
|----------|-------------|
| Selection persistence on navigation | Selection preserved tab switch |
| Multiple selections persistence | Multiple files stay selected |
| Selection toggle | Select/deselect works |
| Expansion persistence on navigation | Expansion preserved tab switch |
| Nested expansion memory | Nested folders stay expanded |
| Combined selection + expansion | Both states preserved together |
| Selection on collapse/re-expand | Selection visible after re-expand |
| Folder selection propagation | All children selected |
| Folder deselection propagation | All children deselected |
| State after refresh event | State preserved on refresh |

### Hierarchical Indexing (`hierarchical-indexing.spec.ts`)

| Scenario | Description |
|----------|-------------|
| Index individual files first | Orphan files at root |
| Select orphan file | Selection works on orphans |
| Index parent preserves selection | Selection survives parent indexing |
| Index grandparent shows all folders | All child folders visible |
| Selection survives grandparent index | Selection maintained through |
| Child count accuracy | Correct item count displayed |

---

## Adding New Test Scenarios

To add a new test scenario:

1. **Identify the category** - Determine which file the test belongs to
2. **Add to appropriate test file** - Follow existing patterns
3. **Update this document** - Add the scenario to the table
4. **Run tests** - Ensure all tests pass

### Test File Locations

| File | Purpose |
|------|---------|
| `FileTree.paths.test.tsx` | Path-based behavior |
| `FileTree.hierarchy.test.tsx` | Tree structure and ordering |
| `FileTree.selection.test.tsx` | Selection propagation |
| `FileTree.state.test.tsx` | State preservation |
| `FileTree.indexing.test.tsx` | Indexing scenarios |
| `FileTree.clear.test.tsx` | Clear and empty states |
| `FileTree.edge-cases.test.tsx` | Edge cases and errors |
| `FileTreeFilters.test.tsx` | Filter UI tests |
| `FileTreeRows.test.tsx` | Row rendering tests |
| `file-tree-comprehensive.spec.ts` | E2E comprehensive tests |
| `file-tree-state.spec.ts` | E2E state tests |
| `hierarchical-indexing.spec.ts` | E2E indexing tests |

---

## Test Commands

```bash
# Run all UI tests
npm run test:ui

# Run file-tree specific tests
npm run test:ui -- --grep "FileTree"

# Run E2E tests
npm run test:e2e

# Run specific E2E test file
npm run test:e2e -- --spec tests/e2e/tests/file-tree-comprehensive.spec.ts
```

---

## Notes

- All tests mock the Tauri API using `mockInvoke`
- E2E tests require the application to be built and running
- Virtual scrolling is mocked in UI tests to render all items
- Tests assume paths are the source of truth (no folder IDs)
