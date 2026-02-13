# Sensitive Data Protection - Specification

## Overview

Automatically detect and redact sensitive information from selected files before including them in AI prompts. Users can customize detection patterns and choose how sensitive data is handled.

## Functional Requirements

### 1. Built-in Detection Patterns
The system shall include a comprehensive set of built-in patterns for detecting:

- **API Keys & Secrets**: AWS keys, Azure keys, Google API keys, OpenAI keys, GitHub tokens, generic secret keys
- **Authentication Credentials**: Passwords in config files, Basic Auth, Bearer tokens, JWT tokens
- **Connection Strings**: Database connection strings (MySQL, PostgreSQL, MongoDB, Redis), S3 bucket URLs
- **PII (Personally Identifiable Information)**: Email addresses, phone numbers, SSNs, credit card numbers
- **Network Information**: IP addresses (IPv4/IPv6), MAC addresses
- **Private Keys**: SSH private keys, PGP private keys
- **Environment Variables**: Common env var names containing secrets (e.g., `*_SECRET`, `*_KEY`, `*_PASSWORD`)

### 2. Custom Pattern Management
- Users can add custom regex patterns with a custom placeholder name
- Users can enable/disable individual patterns (built-in and custom)
- Users can edit and delete their custom patterns
- Custom patterns persist in local storage/settings

### 3. Redaction Behavior
- Detected sensitive data is replaced with the configured placeholder
- Default placeholder format: `[PLACEHOLDER_NAME]` (e.g., `[API_KEY]`, `[REDACTED]`)
- Users can configure a global placeholder prefix/suffix in settings

### 4. Settings UI
- Dedicated "Sensitive Data Protection" section in app Settings
- Toggle to enable/disable the entire feature
- Toggle to "Prevent selection of files with sensitive data" (default: off)
- When prevented:
  - Files containing sensitive data are automatically unselected from the prompt
  - Checkbox for such files is hidden/disabled in the file tree
  - Only visible when this feature is enabled
- List of all patterns with enable/disable checkboxes
- "Add Custom Pattern" button with form:
  - Pattern name (placeholder name)
  - Regex pattern
  - Test input field to validate pattern
- Preview section showing before/after redaction example

### 5. Integration with Prompt Assembly
- When files are selected for prompt, the redaction runs automatically
- Redaction happens before token counting
- Visual indicator in file tree showing which files contain sensitive data (after scanning)

## Non-Functional Requirements

- **Performance**: Redaction should not add noticeable delay (<100ms for files under 100KB)
- **Privacy**: All pattern matching happens locally; no data sent to external servers
- **Accuracy**: Built-in patterns should minimize false positives

## Acceptance Criteria

1. User can enable/disable Sensitive Data Protection in Settings
2. User can enable/disable "Prevent selection of files with sensitive data" (default: off)
3. Built-in patterns detect common sensitive data types (API keys, tokens, emails, IPs, connection strings)
4. User can add custom regex patterns with custom placeholder names
5. User can enable/disable individual patterns
6. Selected files are automatically redacted before being included in prompts
7. Redacted output shows placeholder instead of actual sensitive data
8. When prevention is enabled:
   - Files with sensitive data are automatically unselected
   - Selection checkbox is hidden/disabled for such files
9. Settings persist between app sessions
