# Implementation Plan: Auto-Update Mechanism

## Phase 1: Backend Update Check Logic
- [ ] Task: Implement GitHub API Client in Rust
    - [ ] Create a service to fetch the latest release from GitHub.
    - [ ] Implement version parsing and comparison (current vs. latest).
- [ ] Task: TDD - Update Check Command
    - [ ] Write failing tests for the `check_for_updates` command.
    - [ ] Implement the command to return release metadata (version, notes, download URL).
    - [ ] Verify tests pass.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Backend Update Check Logic' (Protocol in workflow.md)

## Phase 2: Update UI & Navigation
- [ ] Task: Create Update Overlay/View in React
    - [ ] Design the UI according to the specification (Version, Changelog, Buttons).
    - [ ] Implement Markdown rendering for release notes.
- [ ] Task: TDD - Update Detection Flow
    - [ ] Write failing tests for triggering the update view on app launch.
    - [ ] Implement the logic in `App.tsx` or a dedicated hook to show the view if an update is detected.
    - [ ] Verify tests pass.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Update UI & Navigation' (Protocol in workflow.md)

## Phase 3: Download & Portable Update Logic
- [ ] Task: Implement File Download Service in Rust
    - [ ] Create a service to download the update binary to a temporary file.
    - [ ] Add progress reporting via Tauri events.
- [ ] Task: Implement Portable Executable Swap Logic
    - [ ] Create a sidecar or a separate process spawn that handles: (Wait for exit -> Delete old -> Rename new -> Start new).
    - [ ] Implement the "Immediate Update" flow in the backend.
- [ ] Task: TDD - Update Execution
    - [ ] Write failing tests for the download and swap initiation logic.
    - [ ] Implement the backend commands to start the update.
    - [ ] Verify tests pass.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Download & Portable Update Logic' (Protocol in workflow.md)

## Phase 4: "Update on Exit" & Final Integration
- [ ] Task: Implement "Update on Exit" Persistence
    - [ ] Store a "pending_update" flag in SQLite if the user chooses "Update on Exit".
    - [ ] Implement a check on application close (Tauri `on_window_event`) to trigger the swap process if the flag is set.
- [ ] Task: TDD - Final Integration
    - [ ] Write failing tests for the "Update on Exit" flag and trigger.
    - [ ] Finalize integration between frontend buttons and backend commands.
    - [ ] Verify tests pass.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Integration' (Protocol in workflow.md)
