# Conductor Context

Can be found in ./conductor/index.html with Project Context, tracks directory, and product guidelines.

## E2E Testing Environment (Local)

When running E2E tests on Windows, you must ensure `tauri-driver` is running and has access to `msedgedriver.exe`.

- **Msedgedriver Path**: `bin/msedgedriver.exe` (relative to project root).
- **Starting the Driver**: The driver must be started on port 4444. You can use the npm script `npm run driver`.
- **Requirements**: WebView2 must be installed on the system.

To run tests manually: `npm run e2e-session`. This will start the dev server, driver, and run the e2e tests.

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