# Specification - File Tree Enhancements & History Integration

## Overview
This track implements key usability improvements for the File Tree: a "Clear View" function to reset the workspace, a native Context Menu for quick actions, and visual disambiguation for duplicate file names. It also establishes a robust History system that automatically saves sessions when the user clears the view or copies context.

## Goals
- Enable users to easily reset their workspace via a "Clear View" action that wipes the current index.
- Provide quick access to common actions (Add Folder, Clear, Copy Path) via a native right-click Context Menu.
- Improve visual clarity when dealing with identical file names by displaying parent paths.
- Ensure no work is lost by automatically saving the current state to a "History" list.

## Functional Requirements

### 1. Clear View Functionality
- **Action:** A "Clear View" command available via Context Menu and potentially a UI button.
- **Behavior:**
    1. Triggers an automatic "Save to History".
    2. Clears frontend file tree state and invokes backend to truncate the file index database.
    3. Resets UI to the "Empty State".

### 2. Native Context Menu
- **Implementation:** Use Tauri's native context menu API.
- **Menu Items:**
    - **Add Folder:** Triggers directory selection dialog.
    - **Clear View:** Triggers the "Clear View" workflow.
    - **Copy Path:** Copies absolute path of the clicked node to clipboard.

### 3. File Tree Visual Disambiguation
- **Feature:** If multiple files/folders in the tree have the same name, display their full path in parentheses.
- **Styling:** Path should be in small, gray text next to the name.
- **Scope:** Apply this logic when rendering nodes to help users distinguish between files like `index.ts` in different directories.

### 4. History & Auto-Save
- **Trigger Events:** User clicks "Clear View" OR "Copy Context".
- **Data Stored:** Root paths, selection state, prompt text, timestamp.
- **Naming:** Auto-generated from the last 5-10 words of the prompt.

## Technical Constraints
- **Context Menu:** Must use Tauri's native menu capabilities.
- **Disambiguation:** Logic must efficiently check for duplicate names within the current view/indexed set.

## Acceptance Criteria
- [ ] Right-clicking shows "Add Folder", "Clear View", and "Copy Path".
- [ ] "Clear View" resets tree and database, and adds entry to History.
- [ ] "Copy Context" adds entry to History.
- [ ] Files with identical names display their full paths in gray parentheses.
- [ ] History entries capture the prompt text and file metadata correctly.
