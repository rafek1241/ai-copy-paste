# Implementation Plan - Refactor Frontend UI

## Scope
Completely overhaul the frontend UI to match the new "Grouped Context Dashboard" design specification. All UI changes must follow TDD, ensuring existing tests are updated or new tests are written to validate the new structure and styling presence before implementation.

## Tasks

- [ ] **Setup & Configuration**
    - [x] Update `tailwind.config.js` with new color palette and font family. c5e8427
    - [x] Update `index.html` (or `App.tsx` global config) to load "Inter" font and "Material Symbols Outlined". afc9665
    - [x] Update `index.css` with base styles (`@layer base`, scrollbar styling). 1b49a68

- [ ] **Sidebar Refactor (TDD)**
    - [x] **Test**: Create/Update tests for `Sidebar` ensuring it renders core navigation items and structural classes. c336e4b
    - [x] **Implement**: Create/Update `Sidebar` component (`w-10`, icons) to pass tests. 109025c

- [ ] **Layout Refactor (TDD)**
    - [x] **Test**: Create/Update layout tests to verify sidebar + main content structure. 5448375
    - [x] **Implement**: Update main layout to flex row with sidebar and main content area. 4a63647

- [x] **Header Refactor (TDD)**
    - [x] **Test**: Create/Update tests for `Header` (Project selector, Token count). 3f7e1a2
    - [x] **Implement**: Create/Update `Header` component.

- [x] **Tabs Refactor (TDD)**
    - [x] **Test**: Write tests for tab switching logic and visibility of content areas.
    - [x] **Implement**: Implement simple radio-button based or state-based tab switching (Files vs Prompt).

- [x] **Files View Refactor (TDD)**
    - [x] **Filter Bar Test**: Write tests for filter interactions (ALL/SRC/DOCS). 
    - [x] **Filter Bar Implement**: Implement ALL/SRC/DOCS buttons and sort controls.
    - [x] **File List Test**: Verify `FileTree` structure, row styling expectations, and icon presence.
    - [x] **File List Implement**: Update `FileTree` appearance (row styling, icons, checkboxes).

- [x] **Prompt View Refactor (TDD)**
    - [x] **TextArea Test**: Write tests for `PromptBuilder` input presence and attributes.
    - [x] **TextArea Implement**: Update `PromptBuilder` input area styling.
    - [x] **Templates Test**: Write tests for the 2x2 templates grid.
    - [x] **Templates Implement**: Implement the 2x2 grid of templates.

- [x] **Footer Refactor (TDD)**
    - [x] **Test**: Verify `Copy Context` button and status indicators.
    - [x] **Implement**: Update `Copy Context` button styling and add status indicators.

- [ ] **Cleanup**
    - [ ] Remove unused styles/components.
    - [ ] Ensure dark mode is consistent.
    - [ ] Verify all tests pass.
