# Conductor Context

Can be found in ./conductor/index.html with Project Context, tracks directory, and product guidelines.

## E2E Testing Environment (Local)

When running E2E tests on Windows, you must ensure `tauri-driver` is running and has access to `msedgedriver.exe`.

- **Msedgedriver Path**: `bin/msedgedriver.exe` (relative to project root).
- **Starting the Driver**: The driver must be started on port 4444. You can use the npm script `npm run driver`.
- **Requirements**: WebView2 must be installed on the system.

To run tests manually: `npm run e2e-session`. This will start the dev server, driver, and run the e2e tests.

- Always build the Tauri binary before E2E (`npm run build:tauri`) so newly added/renamed backend commands are available to WebDriver sessions.

To run all tests: `npm run test:all`. This will run unit tests, rust (backend) tests, and e2e tests.

## FileTree Component Architecture

The FileTree component uses a performance-optimized architecture:

### Context Pattern
- **FileTreeStateContext**: Contains state and flatTree (for reading)
- **FileTreeActionsContext**: Contains dispatch and action methods (for mutations)
- **FilterTypeContext**: Isolated context for filter type (prevents re-renders of FileTreeFilters on tree changes)

### Performance Optimizations (Completed 2025-02)
1. **buildFlatTree**: Uses single accumulator pattern to avoid intermediate array allocations
2. **loadRootEntries**: Consolidated O(n) passes for child path building
3. **Extension matching**: Module-level `Set` objects for O(1) lookups instead of array `includes()`
4. **FileTreeRow**: `useCallback` for keyboard handlers, `useMemo` for styles
5. **flatTree**: Computed via `useMemo` instead of `useEffect` to avoid extra renders

### Tree Behavior
- Root directories start with `expanded: false`
- Children are loaded on-demand when user clicks expand (via `toggleExpand`)
- E2E tests should call `expandFolder()` after indexing to see files
- Self-referential and cross-child cycle prevention in `loadAndExpandChildren`
- Sensitive scan state should refresh after tree population changes (for example when `flatTree` length changes) so newly loaded children receive marker state.

## Search Behavior

- Header search input calls `onSearch` with a 300ms debounce
- FileTree search calls the `search_path` command for indexed results
- Tests that assert search results should mock `search_path`

## Sensitive Data E2E Conventions

- The Copy Context footer button uses `data-testid="copy-btn"`.
- Sensitive Data settings in the Settings view are staged locally and are only persisted when the Settings footer action `SAVE CONFIGURATION` is clicked.
- The Settings save path emits `sensitive-settings-changed` after successful sensitive-settings persistence so FileTree marker state refreshes immediately.
- Sensitive settings controls are exposed with deterministic test ids (for example `sensitive-feature-toggle`, `sensitive-prevent-selection-toggle`, and custom pattern form controls under `SensitiveDataSettings`).
- Prompt assembly enforces `sensitive_prevent_selection` as a backend safety net: when both sensitive protection and prevention are enabled, sensitive files are skipped even if they remained selected in UI state.
- Clipboard writes should use plugin-first with navigator fallback even in Tauri runtime; if both fail, include both error causes to aid debugging (`tests/ui/services/clipboard.test.ts`).
- Sensitive marker state in FileTree depends on canonicalized paths; normalize to forward slashes and full lowercase for Windows-style paths before comparing scan result paths to tree node paths.
- Keep the `sensitive-settings-changed` listener registration stable in `FileTree` (register once and invoke latest refresh callback via refs) to avoid dropped events during listener re-registration churn.
- Persisted sensitive marks (`sensitive_paths.path`) must use the same canonicalized format (forward slashes) as lookup paths; mixed slash styles on Windows can mark parent folders while missing file-level markers.
- File tree sensitive state uses row markers and attributes:
	- `data-testid="sensitive-indicator"` on sensitive file rows when protection is enabled.
	- `data-selection-blocked="true"` and hidden checkbox placeholder `data-testid="tree-checkbox-hidden"` when prevention blocks selection.
- For stable sensitive-marker assertions, prefer page-object helpers that resolve a node once and then poll element state (for example `FileTreePage.waitForSensitiveIndicatorState`) instead of repeatedly polling `hasSensitiveIndicator()` through full-tree rescans.
- For deterministic expansion in sensitive E2E flows, prefer `expandFolderIfCollapsed()` over separate `isFolderExpanded()` + `expandFolder()` calls.
- In `FileTreePage.findNodeByName`, match against the row’s own `data-testid="tree-label"` element only; querying descendant labels can resolve parent folders when child names match and causes flaky expansion/selection behavior.
- E2E fixture data includes `tests/e2e/fixtures/test-data/sensitive-test/example-dir/` with:
	- `safe-example.ts` (non-sensitive)
	- `sensitive-example.ts` (built-in sensitive)
	- `custom-rule.ts` (initially non-sensitive; used for custom regex rule scenario)
- For deterministic sensitive E2E setup, clear these settings keys via `delete_setting`: `sensitive_data_enabled`, `sensitive_prevent_selection`, `sensitive_custom_patterns`, and `sensitive_builtin_overrides`.
- For sensitive custom-pattern flows, prefer backend-backed waits (`get_sensitive_patterns`, `get_sensitive_marked_paths`) after saving a pattern, then assert UI marker state; this avoids false negatives from transient settings-panel checkbox state reads.
- When Mocha retries are enabled for E2E, reset sensitive settings and re-index fixtures in `beforeEach` (not just `before`) so retries start from deterministic state.

## Release CI Notes

- Keep Tauri JS and Rust core on the same **minor** version line (for example, Rust `tauri` `2.9.x` with `@tauri-apps/api` `2.9.x`). A mismatch causes `npm run tauri build` to fail before compilation.
- In release workflows, prefer `softprops/action-gh-release` over deprecated `actions/create-release` to avoid `set-output` warnings.
