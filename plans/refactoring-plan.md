# Refactoring Plan (`src/` + `src-tauri/`)

Date: 2026-02-19

## Recent Merge Context (Alignment Baseline)

- Auto-update flow is now integrated across frontend/backed (`src/hooks/useUpdateCheck.ts`, `src/components/views/UpdateView.tsx`, `src-tauri/src/commands/update.rs`).
- Sensitive-data flow is concurrently active and surfaced in shared UI composition (`Footer`, `FilesView`, `PromptView`).
- Backend DB schema now contains both `sensitive_paths` and `pending_updates` in one runtime.
- `App.tsx` orchestration has grown to include update lifecycle + existing drag/drop, session, and view concerns.

## Priority (Highest -> Lowest)

1. **P0: Split and stream backend indexing pipeline**
   - Problem: `parallel_index_folder` is monolithic and memory-heavy (`src-tauri/src/commands/indexing.rs:581`, `src-tauri/src/commands/indexing.rs:617`, `src-tauri/src/commands/indexing.rs:701`).
   - Refactor:
     - Extract traversal, progress emission, and DB persistence into separate modules.
     - Replace all-in-memory `Vec<FileEntry>` flow with streaming/chunked persistence.
     - Isolate DB dependency behind injectable interfaces for tests.
   - Success criteria:
     - Large-folder indexing no longer requires materializing full tree in memory.
     - Unit tests cover traversal and batching logic independently.

2. **P0: Decompose `FileTreeContext` into focused units**
   - Problem: indexing/search/selection/expansion logic is coupled in one large provider (`src/components/FileTree/FileTreeContext.tsx:296`).
   - Refactor:
     - Extract pure tree builders and path normalization utilities.
     - Introduce reducer-driven tree mutations.
     - Move search/index invocation into dedicated hooks/services.
   - Success criteria:
     - Provider becomes orchestration-only.
     - Core tree mutations are unit-testable pure functions.

3. **P0: Stabilize merged update + sensitive cross-feature composition**
   - Problem: shared layout/footer/view composition now carries both `updateStatus` and `redactionCount`, increasing coupling (`src/components/Footer.tsx`, `src/components/views/FilesView.tsx`, `src/components/views/PromptView.tsx`).
   - Refactor:
     - Introduce a dedicated footer-view model (or selector hook) that computes display state from update + redaction sources.
     - Keep `Footer` presentational and remove feature-specific conditional branching from parent views where possible.
     - Add focused tests around scheduled-update badge vs token/redaction states.
   - Success criteria:
     - Footer behavior is deterministic under mixed update/sensitive states.
     - View components stop forwarding multiple feature-state props ad hoc.

4. **P1: Separate search command logic and typed errors in Tauri**
   - Problem: search command + SQL/scoring logic are co-located and return stringly errors (`src-tauri/src/commands/indexing.rs:177`, `src-tauri/src/commands/indexing.rs:360`).
   - Refactor:
     - Extract search service module (`filters`, `query builder`, `scoring`).
     - Replace `Result<_, String>` with `AppResult`/typed error mapping.
   - Success criteria:
     - Command layer is thin adapter.
     - Search behavior can be tested without command wiring.

5. **P1: Remove blocking file I/O from async extraction path**
   - Problem: synchronous file reads/encoding work in async command path (`src-tauri/src/commands/extraction.rs:33`, `src-tauri/src/commands/extraction.rs:104`).
   - Refactor:
     - Use `spawn_blocking` (or dedicated worker) for file decode/extract steps.
     - Tighten lock scopes for DB/cache access.
   - Success criteria:
     - Lower contention under concurrent extraction requests.
     - Extraction command has explicit async boundaries.

6. **P1: Break up `App.tsx` orchestration (including update lifecycle)**
   - Problem: view routing, drag/drop, update lifecycle, persistence, toasts, and indexing are mixed in one component (`src/App.tsx`).
   - Refactor:
     - Extract `useDragDropIndexer`, `useMainViewState`, `useSessionSaver`, and `useUpdatePresentationState` hooks.
     - Keep update command invocation logic in dedicated hooks; keep `App` as composition root.
   - Success criteria:
     - `App` only composes layout/views and top-level wiring.
     - Side effects are testable in isolated hooks.

7. **P1: Move Settings side effects to API hook/service**
   - Problem: UI component directly manages invoke/dialog/filesystem side effects (`src/components/Settings.tsx:34`).
   - Refactor:
     - Create `useSettingsApi` (or service module) for all I/O actions.
   - Success criteria:
     - Settings view mostly declarative state transitions.
     - I/O can be mocked independently from UI rendering.

8. **P2: Abstract browser sidecar launcher**
   - Problem: launch/path resolution is tightly coupled to command logic (`src-tauri/src/commands/browser.rs:32`, `src-tauri/src/commands/browser.rs:105`).
   - Refactor:
     - Introduce launcher trait/interface + production/test implementations.
     - Centralize resource path resolution.
   - Success criteria:
     - Command logic is independent of process-launch details.
     - Sidecar behavior is testable with stubs.

9. **P2: History panel cleanup and type deduplication**
   - Problem: duplicate type definitions and unused local state (`src/components/HistoryPanel.tsx:9`, `src/components/HistoryPanel.tsx:30`).
   - Refactor:
     - Reuse shared history types and remove dead state or implement missing logic.
   - Success criteria:
     - Reduced duplicate types and simpler panel state.

---

## Parallel Execution TODO (Agent-Friendly)

### Phase 0 (Serial, 0.5-1 day)
- [ ] **T0** Define target module boundaries and ownership map for both `src/` and `src-tauri/`.
- [ ] **T1** Add baseline perf/test checkpoints (indexing memory usage, file-tree render timing, extraction concurrency smoke test).
- [ ] **T2** Capture post-merge behavioral baseline (update modal flow, update-on-exit badge, redaction indicator behavior, pending update persistence).

### Phase 1 (Parallel Core Refactors)
- [ ] **A1 (Backend Agent)** P0 indexing decomposition and streaming pipeline (`src-tauri/src/commands/indexing.rs` -> split modules).
- [ ] **A2 (Frontend Agent)** P0 `FileTreeContext` decomposition into reducer + pure utilities + hooks.
- [ ] **A3 (Frontend Agent)** P0 footer/view-model stabilization for merged update+sensitive UI state.
- [ ] **A4 (Backend Agent)** P1 search service extraction + typed errors.
- [ ] **A5 (Backend Agent)** P1 extraction async/blocking separation and lock-scope cleanup.
- [ ] **A6 (Frontend Agent)** P1 `App.tsx` orchestration split into focused hooks.
- [ ] **A7 (Frontend Agent)** P1 Settings API/service extraction.

### Phase 2 (Parallel Stabilization)
- [ ] **S1** Add/update unit tests for new tree reducer/utilities and hooks.
- [ ] **S2** Add/update unit tests for update presentation state + footer merged-state behavior.
- [ ] **S3** Add/update Rust tests for indexing traversal/batching and search service logic.
- [ ] **S4** Regression pass for e2e file-tree expand/search/index flow and update-on-exit flow.
- [ ] **S5** Measure perf deltas vs baseline and document gains/regressions.

### Phase 3 (Lower Priority Parallel Cleanup)
- [ ] **C1 (Backend Agent)** P2 sidecar launcher abstraction.
- [ ] **C2 (Frontend Agent)** P2 History panel type/state cleanup.
- [ ] **C3** Final pass to remove deprecated helpers and dead code left by refactors.

---

## Suggested Agent Spawn Plan

1. Start `A1` and `A2` first (highest-risk and most independent P0 workstreams).
2. Start `A3` immediately after Phase 0 to stabilize merged UI behavior before broad App decomposition.
3. Run `A4`, `A5`, `A6`, `A7` in parallel after `T2` baseline capture.
4. Run `S1-S5` once each stream opens a merge-ready PR.
5. Run `C1-C3` after P0/P1 merges to avoid churn.

## Dependency Notes

- `A6` depends on `A3` for stable footer/update presentation boundaries.
- `S4` depends on `A1` + `A2` + `A3`.
- `S5` depends on `T1` and `T2` baselines plus completion of P0/P1 tasks.
- `C3` should be last to avoid conflicts during active refactors.
