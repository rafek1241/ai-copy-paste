# Product Guidelines - AI Context Collector

## Communication & Voice
- **Tone**: Professional and Concise.
- **Style**: Direct, efficient, and technical. Prioritize clarity and speed over conversational filler.
- **Terminology**: Use standard technical terms consistently. Labels and tooltips should be brief and descriptive.

## Information Architecture & Error Handling
- **Transparency**: Provide detailed technical information by default. Users should have immediate access to full error logs and technical breakdowns (e.g., specific indexing issues or tokenization details).
- **Feedback**: Ensure every action has a clear, immediate technical indicator of success or failure.

## User Interface Design Principles
- **Efficiency First**: Interactions must be low-latency. Prioritize quick access to frequent actions like adding folders, selecting files, and copying the final prompt.
- **Performance-Driven**: The UI should remain responsive even when background tasks (like indexing or token counting) are processing large datasets.

## Accessibility & Inclusivity
- **Standard Compliance**: Adhere to established accessibility standards (WCAG). Ensure full keyboard navigability and compatibility with screen readers.
- **Predictability**: Use standard OS-level patterns for buttons, menus, and file trees to ensure a familiar experience for all users.

## Action & Recovery
- **Confirmation for Destructive Actions**: Require confirmation dialogs only for destructive actions that affect multiple items or are irreversible:
  - Clear history (all entries)
  - Remove all folders from the workspace
  - Bulk file/folder deletions
- **Silent Execution for Single Actions**: Execute single-item actions (e.g., removing a single folder, deleting a single history entry) immediately without confirmation. Assume the user is an expert who understands their intent.
- **Focus on Utility**: Avoid interrupting the user's workflow with unnecessary prompts or warnings.

## Sensitive Data Protection
- **Visual Indicators**: Display clear visual indicators (badges, highlights, or icons) when content has been redacted or modified due to sensitive data detection.
- **Transparency**: Users should always know what was redacted without needing to inspect the output manually.
- **User Control**: Allow users to customize redaction patterns and rules through settings.

## History Management
- **Configurable Limits**: Provide a settings option to configure the maximum number of history entries to retain.
- **Automatic Cleanup**: When the limit is reached, oldest entries are automatically removed.
- **Metadata Only**: Store only file metadata (name, path, size) and the prompt itself—not the indexed file contents.

## Automation
- **Seamless Execution**: Browser automation should execute prompts without requiring additional consent dialogs. The user initiates the action explicitly.
- **Clear Feedback**: Provide immediate visual feedback during automation execution (e.g., progress indicator, success/failure notification).
- **Error Recovery**: If automation fails, display the error with actionable guidance and offer to copy the prompt to clipboard as a fallback.

## Advanced Search Functionality

The file tree search supports advanced filtering capabilities for precise file discovery:

### Search Syntax

| Pattern | Description | Example |
|---------|-------------|---------|
| `file:<name>` | Fuzzy filename matching | `file:App` matches `App.tsx`, `AppHeader.tsx` |
| `dir:<name>` | Filter by directory name | `dir:src` shows only files within `src/` directories |
| Regex (auto-detected) | Pattern matching with regex | `\.test\.ts$` matches all test files |
| Plain text | Simple substring search | `utils` matches filenames or paths containing "utils" |

### Combined Filters (AND Logic)

Multiple patterns can be combined with spaces. All conditions must match:
- `file:App dir:src` - Files matching "App" in "src" directories
- `file:test dir:components` - Test files in component directories

### Fuzzy Matching Behavior

- Case-insensitive matching
- Prefix matches rank higher than substring matches
- Exact filename matches (without extension) rank highest
- Minimum score threshold of 0.3 filters out low-quality matches

### UI Behavior

- **Tooltip**: Hover over empty search input to see syntax help
- **Enter key**: Blurs input to indicate search is complete
- **Real-time filtering**: Results update as you type
