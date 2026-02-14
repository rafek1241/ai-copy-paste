# Sensitive Data Protection - Implementation Plan

## Phase 1: Backend - Core Detection Engine (TDD) [checkpoint: f3176fd]

- [x] Task: Write failing tests for sensitive pattern detection (`src-tauri/src/sensitive_data/detection.rs`) f3176fd
  - Test: Pattern matching for API keys (AWS, GitHub, OpenAI)
  - Test: Pattern matching for PII (email, phone, SSN)
  - Test: Pattern matching for connection strings (MySQL, PostgreSQL, Redis)
  - Test: Edge cases (empty input, no matches, multiple matches)

- [x] Task: Implement built-in pattern definitions (`src-tauri/src/sensitive_data/patterns.rs`) f3176fd
  - Define regex patterns for API keys, tokens, secrets
  - Define regex patterns for PII (email, phone, SSN, credit cards)
  - Define regex patterns for connection strings
  - Define regex patterns for IP addresses, private keys

- [x] Task: Write failing tests for redaction logic (`src-tauri/src/sensitive_data/redaction.rs`) f3176fd
  - Test: Single pattern replacement
  - Test: Multiple pattern replacements
  - Test: Custom placeholder format

- [x] Task: Implement redaction engine with placeholder replacement f3176fd

## Phase 2: Backend - Custom Patterns & Storage (TDD) [checkpoint: d58c45b]

- [x] Task: Write failing tests for custom pattern CRUD (`src-tauri/src/commands/sensitive.rs`) d58c45b
  - Test: Add custom pattern
  - Test: Get all patterns
  - Test: Enable/disable pattern
  - Test: Delete custom pattern
  - Test: Invalid regex handling

- [x] Task: Implement custom pattern storage in settings/SQLite d58c45b
  - Custom patterns stored as JSON in settings table
  - Disabled builtins stored as JSON array of IDs

- [x] Task: Write failing tests for global enable/disable toggle d58c45b
  - Test: Toggle enables/disables all redaction
  - Test: Persists between sessions

- [x] Task: Implement global toggle in settings d58c45b
  - sensitive_data_enabled setting key
  - sensitive_prevent_selection setting key

## Phase 3: Backend - Integration Commands (TDD)

- [~] Task: Write failing tests for file redaction integration
  - Test: Redact file content before prompt building
  - Test: Detect sensitive data returns list of detected patterns per file

- [ ] Task: Integrate redaction into `build_prompt_from_files` command
  - Apply redaction after reading file content, before building prompt

- [ ] Task: Add Tauri command for detecting sensitive data in files (for UI indicators)

## Phase 4: Frontend - Settings UI (TDD)

- [ ] Task: Write failing tests for Sensitive Data Settings component
  - Test: Renders pattern list with checkboxes
  - Test: Add custom pattern form validation
  - Test: Pattern test/validation input

- [ ] Task: Create SensitiveDataSettings component
  - Pattern list with enable/disable checkboxes
  - Add Custom Pattern form with regex validation
  - Preview section with before/after example

- [ ] Task: Write failing tests for Settings page integration
  - Test: Load patterns from backend
  - Test: Save pattern changes

- [ ] Task: Integrate with existing Settings page

## Phase 5: Prevention Feature & UI Indicators

- [ ] Task: Write failing tests for prevention toggle setting
  - Test: Toggle persists between sessions
  - Test: When enabled, files with sensitive data are filtered from selection

- [ ] Task: Add "prevent_selection" setting to backend

- [ ] Task: Write failing tests for file tree selection filtering
  - Test: Checkbox hidden for files with sensitive data when prevention enabled
  - Test: Auto-unselect files with sensitive data when prevention enabled

- [ ] Task: Implement file tree selection filtering
  - Hide/disable checkbox for files with detected sensitive data
  - Auto-unselect files during token counting when prevention enabled

- [ ] Task: Write failing tests for visual indicators
  - Test: Badge/icon shown for files with sensitive data
  - Test: Redaction indicator in prompt preview

- [ ] Task: Add visual indicator for files containing sensitive data
  - Badge or icon in file tree for flagged files

- [ ] Task: Add redaction indicator in prompt output
