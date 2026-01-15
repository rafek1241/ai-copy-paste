# Browser Automation Sidecar

This directory contains the Node.js sidecar process that handles browser automation using Playwright.

## Overview

The sidecar is a separate Node.js process that:
1. Launches a browser using Playwright's persistent context
2. Navigates to AI chat interfaces (ChatGPT, Claude, Gemini, AI Studio)
3. Fills the contenteditable input field with the provided prompt
4. Disconnects while keeping the browser running for user interaction

## Key Features

- **Persistent Browser Context**: Uses `launchPersistentContext` to keep browser open after script exits
- **Multiple Selectors**: Fallback chain of selectors for each AI interface
- **Anti-Automation**: Disables automation detection features
- **Error Recovery**: Tries multiple strategies to fill input (fill, click+type)

## Installation

```bash
cd sidecar
npm install
```

This will install Playwright and its dependencies.

## Usage

### From Command Line

```bash
node automation.js <interface> <text> [url]
```

**Arguments:**
- `interface` - AI interface name: `chatgpt`, `claude`, `gemini`, or `aistudio`
- `text` - The prompt text to fill
- `url` - Optional custom URL (overrides default interface URL)

**Examples:**

```bash
# Launch ChatGPT and fill prompt
node automation.js chatgpt "Explain how React hooks work"

# Launch Claude with custom instructions
node automation.js claude "Review this code for security issues"

# Use custom URL
node automation.js chatgpt "Hello" "https://chat.openai.com/chat/custom-gpt"
```

### From Tauri Application

The Rust backend calls this script via the `launch_browser` command:

```rust
use crate::commands::browser::{launch_browser, AiInterface};

// Launch browser with ChatGPT
launch_browser(AiInterface::ChatGPT, "Your prompt here".to_string(), None).await?;
```

## Architecture

### Files

- **automation.js** - Main entry point, browser control logic
- **selectors.js** - AI interface configurations and selectors
- **package.json** - Node.js dependencies

### How It Works

1. **Launch**: Creates persistent browser context with user data directory
2. **Navigate**: Goes to the target AI interface URL
3. **Wait**: Waits for the input field to appear
4. **Fill**: Tries multiple strategies to fill the prompt:
   - Primary: `element.fill(text)` - fastest method
   - Fallback: `element.click()` + `keyboard.type()` - character-by-character
5. **Disconnect**: Exits the Node.js process WITHOUT closing the browser context

The browser remains open because:
- Persistent context stores session in `.browser-data/` directory
- Script exits with `process.exit(0)` without calling `context.close()`
- Browser process is independent of Node.js process

### Browser Data Directory

The persistent context stores browser data in `.browser-data/` which includes:
- Cookies and session storage
- Local storage
- Cache
- User preferences

This allows the browser to maintain login sessions across invocations.

## Supported AI Interfaces

| Interface | Default URL | Selector Strategy |
|-----------|-------------|-------------------|
| ChatGPT | https://chat.openai.com/ | #prompt-textarea, contenteditable |
| Claude | https://claude.ai/ | .ProseMirror[contenteditable] |
| Gemini | https://gemini.google.com/ | .ql-editor[contenteditable] |
| AI Studio | https://aistudio.google.com/ | .input-area[contenteditable] |

## Troubleshooting

### Browser doesn't launch

- Check if Node.js is installed: `node --version`
- Install Playwright browsers: `npx playwright install chromium`
- Check if Playwright is installed: `npm list playwright`

### Prompt not filled

- The selectors might have changed (AI interfaces update frequently)
- Check the console output for which selectors were tried
- Update `selectors.js` with current selectors
- Use browser DevTools to inspect the input element

### Browser closes immediately

- Verify that `context.close()` is NOT called in automation.js
- Check that script exits with `process.exit(0)`
- Ensure persistent context is used (not regular launch)

## Development

### Testing Standalone

Run the automation script directly for testing:

```bash
node automation.js chatgpt "Test prompt"
```

The script will log each step and any errors encountered.

### Updating Selectors

If an AI interface updates its HTML structure:

1. Open the interface in a browser
2. Inspect the input element with DevTools
3. Note the element's attributes (class, id, contenteditable, role)
4. Update `selectors.js` with new selectors
5. Add fallback selectors for robustness

### Adding New Interfaces

To add support for a new AI interface:

1. Add configuration to `AI_INTERFACES` in `selectors.js`:
```javascript
newinterface: {
  name: 'New Interface',
  url: 'https://example.com/',
  selectors: ['primary-selector', 'fallback-selector'],
  waitForSelector: 'element-to-wait-for',
}
```

2. Update the Rust enum in `src-tauri/src/commands/browser.rs`:
```rust
pub enum AiInterface {
    // ... existing variants
    NewInterface,
}
```

3. Update `as_str()` method and `get_available_interfaces()` command

## License

MIT
