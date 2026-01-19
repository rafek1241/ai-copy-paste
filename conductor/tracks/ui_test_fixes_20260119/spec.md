# Specification - Fix UI Tests and Prompt Builder Logic

## Overview
This track focuses on updating the E2E test suite to align with the recently implemented UI changes. It also includes minor functional refinements to the Prompt Builder component to ensure a cleaner user experience and correct behavior for template selection.

## Functional Requirements
### E2E Tests
- **File Tree**: Ensure selection/deselection of files and folders works correctly in tests.
- **Token Counter**: Verify that the token count updates correctly based on selected files.
- **Copy Context**: Ensure the "Copy Context" button is functional and correctly triggers the assembly process.
- **General**: Fix all failing tests in the `e2e/tests` directory (e.g., `app-launch.spec.ts`, `integration.spec.ts`).

### Prompt Builder (App Logic)
- **Default State**: No template should be selected by default when the Prompt Builder is opened.
- **Template Selection**: Selecting a template must immediately fill the "Custom Instructions" field with the template's content.
- **Cleanup**: 
    - Remove the "custom variables" insertion icon.
    - Remove the "manage" link.
    - Update components to reflect these removals without making major visual changes.

## Non-Functional Requirements
- **Test Stability**: Tests should be robust and not rely on fragile selectors.
- **Code Integrity**: Minimal changes to `src/` components; focus on fixing logic and selectors to match the new UI.

## Acceptance Criteria
- [ ] All E2E tests pass (`npm run test:e2e`).
- [ ] Prompt Builder starts with an empty/unselected template state.
- [ ] Selecting a template updates the custom instructions text area.
- [ ] Variable icons and manage links are removed from the Prompt Builder UI.
- [ ] "Copy Context" button works as expected in a full E2E flow.

## Out of Scope
- Redesigning the UI layout or styling.
- Adding new features beyond the requested logic fixes.
- Writing unit tests for the removals (E2E cleanup only).