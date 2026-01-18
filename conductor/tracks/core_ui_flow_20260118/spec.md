# Specification - Core UI and Context Gathering Flow

## Overview
This track focuses on finalizing the primary user interface and the core data flow for gathering AI context. The goal is to provide a seamless "Drag & Drop -> Select -> Copy" experience that works across different platforms and file types.

## Goals
- Implement a robust drag-and-drop system for adding files and directories from anywhere on the system.
- Ensure the file tree reflects added content immediately and handles large numbers of items efficiently.
- Implement real-time token counting that updates as the user selects or deselects files.
- Build the final prompt assembly logic that combines file content with user instructions into a clipboard-ready format.

## Functional Requirements
- **Drag & Drop**:
    - Users can drop files or folders onto the application window.
    - Dropped items are indexed and added to the file tree.
    - Support for `.gitignore` rules during indexing to exclude irrelevant files.
- **File Tree Selection**:
    - Users can select individual files or entire folders.
    - Selection state (checked, unchecked, indeterminate) propagates between parents and children.
- **Real-time Token Counting**:
    - Display the total token count of all *selected* files plus the current custom prompt.
    - Update the count instantly upon any change in selection or prompt text.
    - Provide a visual warning if the total count exceeds a configurable limit (default: 128k tokens).
- **Prompt Assembly & Clipboard**:
    - Combine selected file contents with a template and custom instructions.
    - Format: `[File Path]\n[File Content]\n---\n[Custom Prompt]`.
    - Provide a single "Copy Context" button that puts the final string into the system clipboard.

## Technical Constraints
- **Performance**: File tree must remain responsive with 10k+ items (using virtualization).
- **Memory**: Do not load all file contents into memory at once; stream or batch during assembly.
- **Accuracy**: Token counting must use `gpt-tokenizer` to ensure parity with OpenAI models.
- **Security**: The process must be entirely offline; no code content is sent to external servers.

## Acceptance Criteria
- [ ] Dropping a folder adds it to the list and indexes its contents.
- [ ] Selecting a folder automatically selects all its children.
- [ ] Token count updates within 100ms of a selection change.
- [ ] "Copy Context" produces a string containing all selected file contents and the custom prompt.
- [ ] Large files (e.g., >1MB) are handled without crashing the app.
