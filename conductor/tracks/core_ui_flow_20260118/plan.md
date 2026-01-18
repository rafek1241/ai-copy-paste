# Implementation Plan - Core UI and Context Gathering Flow

This plan follows the TDD and verification protocols defined in `conductor/workflow.md`.

## Phase 1: Enhanced File Tree & Drag-and-Drop
Goal: Finalize the selection logic and enable adding files from any location.

- [x] Task: Implement Drag-and-Drop Handler [113ad33]
    - [x] Write Tests: Verify that dropped file/folder paths are correctly received and passed to the indexing service.
    - [x] Implement Feature: Create a global drop zone that triggers the `index_folder` command for directories or adds individual files.
- [ ] Task: Refine Selection Propagation Logic
    - [ ] Write Tests: Ensure parent-child checkbox state propagation works for deep nesting and partial selections (indeterminate state).
    - [ ] Implement Feature: Optimize the tree state management to handle updates efficiently without full re-renders.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Enhanced File Tree & Drag-and-Drop' (Protocol in workflow.md)

## Phase 2: Real-time Token Counting
Goal: Provide immediate feedback on context size.

- [ ] Task: Integrate `gpt-tokenizer` with Selection State
    - [ ] Write Tests: Verify token counts for various file types and combined selections match expected outputs.
    - [ ] Implement Feature: Create a debounced token counter that re-calculates the total count of selected files.
- [ ] Task: Build Token Counter UI Component
    - [ ] Write Tests: Verify the component displays counts correctly and shows warnings when limits are exceeded.
    - [ ] Implement Feature: Add a minimalist token display to the footer with a color-coded limit indicator.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Real-time Token Counting' (Protocol in workflow.md)

## Phase 3: Prompt Assembly and Clipboard Integration
Goal: The final output and copy-paste flow.

- [ ] Task: Implement Prompt Assembly Service
    - [ ] Write Tests: Verify the combined prompt string follows the specified format and includes all selected content.
    - [ ] Implement Feature: Build a service that gathers content for all selected IDs and concatenates it with the user prompt.
- [ ] Task: Add "Copy Context" Button and Notification
    - [ ] Write Tests: Verify that the assembled string is correctly placed in the system clipboard.
    - [ ] Implement Feature: Add a prominent "Copy Context" button with a success toast/indicator.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Prompt Assembly and Clipboard Integration' (Protocol in workflow.md)
