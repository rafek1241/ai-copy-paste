# Plan: Refactor Frontend UI Based on Best Practices

## Phase 1: Preparation & Hooks Extraction
Extract global logic and event listeners into reusable hooks to clean up `App.tsx`.

- [ ] Task: Create `useDragDrop` hook to encapsulate Tauri drag-and-drop event listeners.
- [ ] Task: Create `useViewState` hook to manage view switching (main, history, settings) and active tab state.
- [ ] Task: Create `usePersistence` hook to handle `localStorage` sync and error handling for UI state.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Preparation & Hooks Extraction' (Protocol in workflow.md)

## Phase 2: FileTree Logic Decoupling
Refactor `FileTree.tsx` by moving complex tree logic into a custom hook and separating UI components.

- [ ] Task: Extract file-related utility functions (icons, size formatting) to `src/lib/file-utils.ts`.
- [ ] Task: Create `useFileTree` hook to manage node mapping, recursion, and selection propagation logic.
- [ ] Task: Extract `FileTreeRow` component for rendering individual file/folder entries with memoization.
- [ ] Task: Refactor `FileTree.tsx` to use the new hook and component (target < 150 lines).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: FileTree Logic Decoupling' (Protocol in workflow.md)

## Phase 3: Accessibility & Interaction Improvements
Implement WCAG 2.1 Level AA standards and robust keyboard navigation.

- [ ] Task: Implement keyboard navigation in `FileTree` (Arrow keys, Space/Enter) using a focus manager.
- [ ] Task: Add `role="tree"` and `role="treeitem"` with appropriate ARIA attributes to `FileTree`.
- [ ] Task: Refactor `PromptBuilder.tsx` to use `<button>` tags for interactive elements and add `TemplateGrid` component.
- [ ] Task: Implement 300ms debounce for the search filter to optimize performance.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Accessibility & Interaction Improvements' (Protocol in workflow.md)

## Phase 4: Final Validation & Testing
Ensure all changes are stable, performant, and well-tested.

- [ ] Task: Audit final application for accessibility compliance using `axe-core`.
- [ ] Task: Verify performance with a mock "Stress Test" directory (10k+ files).
- [ ] Task: Ensure 80%+ test coverage for all new hooks and components.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Validation & Testing' (Protocol in workflow.md)
