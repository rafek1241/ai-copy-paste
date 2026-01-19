# Implementation Plan - Refactor Frontend UI

## Scope
Completely overhaul the frontend UI to match the new "Grouped Context Dashboard" design specification. All UI changes must follow TDD, ensuring existing tests are updated or new tests are written to validate the new structure and styling presence before implementation.

## Tasks

- [ ] **Setup & Configuration**
    - [x] Update `tailwind.config.js` with new color palette and font family. c5e8427
    - [ ] Update `index.html` (or `App.tsx` global config) to load "Inter" font and "Material Symbols Outlined".
    - [ ] Update `index.css` with base styles (`@layer base`, scrollbar styling).

- [ ] **Sidebar Refactor (TDD)**
    - [ ] **Test**: Create/Update tests for `Sidebar` ensuring it renders core navigation items and structural classes.
    - [ ] **Implement**: Create/Update `Sidebar` component (`w-10`, icons) to pass tests.

- [ ] **Layout Refactor (TDD)**
    - [ ] **Test**: Create/Update layout tests to verify sidebar + main content structure.
    - [ ] **Implement**: Update main layout to flex row with sidebar and main content area.

- [ ] **Header Refactor (TDD)**
    - [ ] **Test**: Create/Update tests for `Header` (Project selector, Token count).
    - [ ] **Implement**: Create/Update `Header` component.

- [ ] **Tabs Refactor (TDD)**
    - [ ] **Test**: Write tests for tab switching logic and visibility of content areas.
    - [ ] **Implement**: Implement simple radio-button based or state-based tab switching (Files vs Prompt).

- [ ] **Files View Refactor (TDD)**
    - [ ] **Filter Bar Test**: Write tests for filter interactions (ALL/SRC/DOCS).
    - [ ] **Filter Bar Implement**: Implement ALL/SRC/DOCS buttons and sort controls.
    - [ ] **File List Test**: Verify `FileTree` structure, row styling expectations, and icon presence.
    - [ ] **File List Implement**: Update `FileTree` appearance (row styling, icons, checkboxes).

- [ ] **Prompt View Refactor (TDD)**
    - [ ] **TextArea Test**: Write tests for `PromptBuilder` input presence and attributes.
    - [ ] **TextArea Implement**: Update `PromptBuilder` input area styling.
    - [ ] **Templates Test**: Write tests for the 2x2 templates grid.
    - [ ] **Templates Implement**: Implement the 2x2 grid of templates.

- [ ] **Footer Refactor (TDD)**
    - [ ] **Test**: Verify `Copy Context` button and status indicators.
    - [ ] **Implement**: Update `Copy Context` button styling and add status indicators.

- [ ] **Cleanup**
    - [ ] Remove unused styles/components.
    - [ ] Ensure dark mode is consistent.
    - [ ] Verify all tests pass.
