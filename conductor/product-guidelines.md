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
- **Silent Execution**: Execute destructive actions (e.g., removing folders, clearing history) immediately without confirmation dialogs. Assume the user is an expert who understands their intent.
- **Focus on Utility**: Avoid interrupting the user's workflow with unnecessary prompts or warnings.

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
