# Implementation Plan - Core UI and Context Gathering Flow

This plan follows the TDD and verification protocols defined in `conductor/workflow.md`.

## Phase 1: Enhanced File Tree & Drag-and-Drop [checkpoint: 63e0a18]
Goal: Finalize the selection logic and enable adding files from any location.

- [x] Task: Implement Drag-and-Drop Handler [113ad33]
    - [x] Write Tests: Verify that dropped file/folder paths are correctly received and passed to the indexing service.
    - [x] Implement Feature: Create a global drop zone that triggers the `index_folder` command for directories or adds individual files.
- [x] Task: Refine Selection Propagation Logic [0afd107]
    - [x] Write Tests: Ensure parent-child checkbox state propagation works for deep nesting and partial selections (indeterminate state).
    - [x] Implement Feature: Optimize the tree state management to handle updates efficiently without full re-renders.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Enhanced File Tree & Drag-and-Drop' (Protocol in workflow.md) [63e0a18]

## Phase 2: Real-time Token Counting [checkpoint: 9170262]
Goal: Provide immediate feedback on context size.

- [x] Task: Integrate `gpt-tokenizer` with Selection State [027beed]
    - [x] Write Tests: Verify token counts for various file types and combined selections match expected outputs.
    - [x] Implement Feature: Create a debounced token counter that re-calculates the total count of selected files.
- [x] Task: Build Token Counter UI Component [7a1ab74]
    - [x] Write Tests: Verify the component displays counts correctly and shows warnings when limits are exceeded.
    - [x] Implement Feature: Add a minimalist token display to the footer with a color-coded limit indicator.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Real-time Token Counting' (Protocol in workflow.md) [9170262]

## Phase 3: Prompt Assembly and Clipboard Integration [checkpoint: f51027d]
Goal: The final output and copy-paste flow.

- [x] Task: Implement Prompt Assembly Service [e57be37]
    - [x] Write Tests: Verify the combined prompt string follows the specified format and includes all selected content.
    - [x] Implement Feature: Build a service that gathers content for all selected IDs and concatenates it with the user prompt.
- [x] Task: Add "Copy Context" Button and Notification [e57be37]
    - [x] Write Tests: Verify that the assembled string is correctly placed in the system clipboard.
    - [x] Implement Feature: Add a prominent "Copy Context" button with a success toast/indicator.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Prompt Assembly and Clipboard Integration' (Protocol in workflow.md) [f51027d]
