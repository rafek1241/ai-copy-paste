# Implementation Plan - UI Test Fixes and Prompt Builder Refinement

## Phase 1: Prompt Builder Logic & UI Cleanup
Focuses on the requested application changes to the Prompt Builder.

- [ ] Task: Remove variable insertion and manage links
    - [ ] Locate the Prompt Builder component(s)
    - [ ] Remove the custom variables icon/button
    - [ ] Remove the "manage" link for templates/variables
- [ ] Task: Refine Template Selection logic
    - [ ] Update state to ensure no template is selected by default
    - [ ] Implement/Fix handler so selecting a template populates the "Custom Instructions" field
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Prompt Builder Logic & UI Cleanup' (Protocol in workflow.md)

## Phase 2: E2E Test Suite Alignment
Updating the existing WebdriverIO tests to match the new UI structure and logic.

- [ ] Task: Fix File Tree and Token Counter Tests
    - [ ] Run `e2e/tests/file-tree.spec.ts` and identify failures
    - [ ] Update selectors for file/folder selection
    - [ ] Verify token count assertions match the new UI
- [ ] Task: Fix Prompt Builder and Integration Tests
    - [ ] Update `e2e/tests/prompt-builder.spec.ts` to remove interactions with deleted elements (variables/manage)
    - [ ] Update integration tests to verify the "Copy Context" flow
- [ ] Task: Final Test Sweep
    - [ ] Run all E2E tests: `npm run test:e2e`
    - [ ] Fix any remaining failures in `app-launch.spec.ts` or `diagnostic.spec.ts`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: E2E Test Suite Alignment' (Protocol in workflow.md)