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
