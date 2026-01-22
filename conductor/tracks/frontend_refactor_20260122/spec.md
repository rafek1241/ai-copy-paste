# Specification: Refactor Frontend UI Based on Best Practices

## Overview
Refactor the frontend React application (`src` directory) to adhere to modern React best practices and Vercel Web Interface Guidelines. The focus is on decoupling logic from UI, improving accessibility, and optimizing performance.

## Functional Requirements
- **Accessibility (WCAG 2.1 Level AA)**:
    - **FileTree**: Add `role="tree"` and `role="treeitem"`. Implement Arrow Key navigation (Left/Right to collapse/expand, Up/Down to traverse) using a focus manager.
        - *Edge Case*: Focus should persist on the correct item even after filtering/searching updates the list.
    - **General**: Replace interactive `div`s with `<button>` tags (e.g., "Create New Template"). Ensure all form inputs have associated labels.
- **Component Refactoring**:
    - **FileTree**:
        - Extract `FileTreeRow.tsx`: Handle rendering of individual rows (Folder vs File).
        - Extract `useFileTree.ts`: Move complex logic (node mapping, recursion, selection propagation, expansion toggling) into a custom hook.
        - Move utils (icon helpers, size formatters) to `src/lib/file-utils.ts`.
    - **PromptBuilder**:
        - Extract `TemplateGrid.tsx` for the list of templates.
- **State Management**:
    - **Persistence**: Use `localStorage` to persist `activeTab`, `expandedFolderIds`, and `searchQuery` across sessions.
        - *Error Handling*: Gracefully handle `localStorage` quota exceeded or corruption (fallback to default state).
    - **App Logic**: Create `useDragDrop.ts` to encapsulate the Tauri drag-and-drop event listeners.
- **Performance**:
    - **Virtualization**: Ensure `TanStack Virtual` handles 100k+ files smoothly.
    - **Memoization**: Memoize `FileTreeRow` to prevent re-rendering unchanged rows during selection updates.
    - **Debouncing**: Debounce the `searchQuery` input (300ms) to prevent excessive filtering during typing.

## Non-Functional Requirements
- **Maintainability**: Strict separation of Concerns (Logic in Hooks, UI in Components).
- **Type Safety**: Ensure strict typing for all new hooks and components.
- **Error Handling**: 
    - Display user-friendly "Toast" notifications for background failures (e.g., "Failed to load folder").
    - Log non-fatal errors to the console with context.

## Acceptance Criteria
- [ ] `FileTree.tsx` is significantly reduced in size (target < 150 lines).
- [ ] Users can navigate the File Tree using ONLY the keyboard (Up/Down/Left/Right/Space).
- [ ] Application state (tabs, expanded folders) restores correctly after a refresh.
- [ ] UI remains responsive (60fps) when selecting a folder with >10k children.
- [ ] "Create New Template" and other clickable elements are focusable via Tab key.
