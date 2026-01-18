# Implementation Plan - File Tree Enhancements & History

This plan follows the TDD and verification protocols defined in `conductor/workflow.md`.

## Phase 1: File Tree Improvements (Clear, Disambiguation, Context Menu)
Goal: Enhance the File Tree UI with native interactions and better visual feedback.

- [ ] Task: Backend - Implement "Clear Index" Command
    - [ ] Write Tests: Verify `clear_index` command correctly truncates the database tables.
    - [ ] Implement Feature: Add `clear_index` Tauri command in `src-tauri/src/commands/indexing.rs`.
- [ ] Task: Frontend - Implement Native Context Menu
    - [ ] Write Tests: Verify context menu logic (mocking Tauri API) triggers correct internal handlers.
    - [ ] Implement Feature: Integrate Tauri native menu in `FileTree.tsx`. Add "Add Folder", "Clear View", "Copy Path".
- [ ] Task: Frontend - Implement File Disambiguation Logic
    - [ ] Write Tests: Verify that duplicate filenames in the tree data triggers the display of the full path.
    - [ ] Implement Feature: Update `FileTree.tsx` rendering to check for duplicates and render the path in gray text.
- [ ] Task: Frontend - Wire up "Clear View" Action
    - [ ] Write Tests: Verify "Clear View" calls the backend command and resets local state.
    - [ ] Implement Feature: Connect context menu "Clear View" to backend and state reset.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: File Tree Improvements' (Protocol in workflow.md)

## Phase 2: History System & Auto-Save
Goal: Implement persistent session history and auto-save triggers.

- [ ] Task: Backend - Implement History Persistence
    - [ ] Write Tests: Verify database schema for `history` table and CRUD operations (save, list, delete).
    - [ ] Implement Feature: Add `history.rs` command module with SQLite storage for sessions.
- [ ] Task: Frontend - Implement Auto-Save Logic
    - [ ] Write Tests: Verify that "Clear View" and "Copy Context" trigger the save history action.
    - [ ] Implement Feature: Update `App.tsx` or `HistoryContext` to save state on specific events.
- [ ] Task: Frontend - Implement Smart Session Naming
    - [ ] Write Tests: Verify naming logic extracts last words from prompt or defaults to "Untitled".
    - [ ] Implement Feature: Add utility function for session naming and integrate into save logic.
- [ ] Task: Frontend - Connect History UI
    - [ ] Write Tests: Verify History tab displays the list of saved sessions correctly.
    - [ ] Implement Feature: Update `HistoryPanel.tsx` to fetch and display real data from the backend.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: History System & Auto-Save' (Protocol in workflow.md)
