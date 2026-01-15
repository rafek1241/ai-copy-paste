# Phase 5: Token Counting and Prompt Building

## Overview

Phase 5 implements token counting and prompt building functionality for the AI Context Collector. This phase enables users to:

1. Count tokens in file contents using OpenAI's tokenizer
2. Build prompts from selected files using templates
3. Preview prompts with real-time token counting
4. Monitor token usage against model limits
5. Copy built prompts to clipboard

## Architecture

### Backend (Rust)

#### Templates Module (`src-tauri/src/templates.rs`)

Provides built-in prompt templates with variable substitution:

- **6 Built-in Templates:**
  - `agent` - General purpose AI agent tasks
  - `planning` - Project planning and architecture
  - `debugging` - Code debugging and troubleshooting
  - `review` - Code review
  - `documentation` - Generate documentation
  - `testing` - Generate test cases

**Key Functions:**
```rust
pub fn get_builtin_templates() -> Vec<PromptTemplate>
pub fn build_prompt(template_id: &str, custom_instructions: Option<&str>, file_contents: &[(String, String)]) -> Result<String, String>
```

**Template Variables:**
- `{{custom_instructions}}` - User-provided instructions
- `{{files}}` - Auto-generated file contents with paths

#### Prompts Commands Module (`src-tauri/src/commands/prompts.rs`)

Tauri commands for prompt operations:

- `get_templates()` - Returns all available templates
- `get_file_content(file_id)` - Gets content of a single file by ID
- `get_file_contents(file_ids)` - Gets content of multiple files
- `build_prompt_from_files(request)` - Builds prompt from template and selected files

### Frontend (TypeScript/React)

#### Tokenizer Service (`src/services/tokenizer.ts`)

Token counting utilities using `gpt-tokenizer`:

**Functions:**
- `countTokens(text: string): number` - Count tokens using GPT-4o encoding
- `checkTokenLimit(text: string, limit: number): boolean | number` - Efficient limit checking
- `countTotalTokens(texts: string[]): number` - Count tokens across multiple texts
- `formatTokenCount(count: number): string` - Format with thousands separator
- `calculateTokenPercentage(used: number, limit: number): number` - Calculate usage percentage
- `getTokenLimitColor(percentage: number): string` - Get color based on usage

**Model Support:**
- GPT-4o (128K tokens)
- GPT-4o Mini (128K tokens)
- GPT-4 Turbo (128K tokens)
- GPT-4 (8K tokens)
- GPT-3.5 Turbo (16K tokens)
- Claude 3 Opus/Sonnet/Haiku (200K tokens)
- Gemini Pro (32K tokens)

#### Prompts Service (`src/services/prompts.ts`)

API wrapper for Tauri commands.

#### TokenCounter Component (`src/components/TokenCounter.tsx`)

Real-time token counter with visual indicators:

**Features:**
- Live token counting with debouncing (300ms)
- Color-coded progress bar
- Token limit display
- Usage percentage
- Warning when approaching limit (>90%)

**Props:**
```typescript
interface TokenCounterProps {
  text: string;           // Text to count tokens for
  modelName?: ModelName;  // Target AI model (default: gpt-4o)
  showLimit?: boolean;    // Show token limit info (default: true)
}
```

#### PromptBuilder Component (`src/components/PromptBuilder.tsx`)

Complete prompt building interface:

**Features:**
- Template selection dropdown with descriptions
- Model selection for accurate token limits
- Custom instructions textarea
- File selection count display
- Build prompt button
- Token counter integration
- Prompt preview with monospace font
- Copy to clipboard functionality
- Error handling and display

**Props:**
```typescript
interface PromptBuilderProps {
  selectedFileIds: number[];      // Array of file IDs from database
  onPromptBuilt?: (prompt: string) => void;  // Callback when prompt is built
}
```

## Usage Examples

### Building a Prompt

```typescript
import { PromptBuilder } from './components/PromptBuilder';

function MyComponent() {
  const [selectedFiles, setSelectedFiles] = useState<number[]>([1, 2, 3]);

  return (
    <PromptBuilder
      selectedFileIds={selectedFiles}
      onPromptBuilt={(prompt) => {
        console.log('Built prompt:', prompt);
        // Do something with the prompt
      }}
    />
  );
}
```

### Token Counting Only

```typescript
import { TokenCounter } from './components/TokenCounter';

function MyComponent() {
  const [text, setText] = useState('');

  return (
    <div>
      <textarea onChange={(e) => setText(e.target.value)} />
      <TokenCounter text={text} modelName="gpt-4o" />
    </div>
  );
}
```

### Using Tokenizer Service Directly

```typescript
import { countTokens, checkTokenLimit } from './services/tokenizer';

const text = "Hello, world!";
const tokenCount = countTokens(text);
const withinLimit = checkTokenLimit(text, 128000);

console.log(`Token count: ${tokenCount}`);
console.log(`Within limit: ${withinLimit}`);
```

## API Reference

### Backend Commands

All commands are async and can be invoked from the frontend:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Get all templates
const templates = await invoke<PromptTemplate[]>('get_templates');

// Get file content
const fileContent = await invoke<FileContent>('get_file_content', { fileId: 123 });

// Get multiple file contents
const contents = await invoke<FileContent[]>('get_file_contents', { fileIds: [1, 2, 3] });

// Build prompt
const response = await invoke<BuildPromptResponse>('build_prompt_from_files', {
  request: {
    template_id: 'agent',
    custom_instructions: 'Fix bugs',
    file_ids: [1, 2, 3]
  }
});
```

## Testing

### Manual Testing Steps

1. **Test Template Loading:**
   - Open the application
   - Navigate to Prompt Builder
   - Verify all 6 templates are listed in dropdown
   - Select each template and verify description appears

2. **Test Token Counting:**
   - Create a text file with known content
   - Index the file
   - Select it and build a prompt
   - Verify token count is reasonable (approximately 1 token per 4 characters)
   - Test with different models and verify limits are correct

3. **Test Prompt Building:**
   - Select 2-3 files
   - Choose a template
   - Add custom instructions
   - Click "Build Prompt"
   - Verify prompt contains:
     - Template text
     - Custom instructions
     - File paths and contents
   - Test with empty custom instructions
   - Test with no files selected (should show error)

4. **Test Token Limit Warnings:**
   - Build a large prompt (select many files)
   - Verify color changes:
     - Green: 0-50%
     - Yellow: 50-75%
     - Orange: 75-90%
     - Red: 90-100%
   - Verify warning appears at >90%

5. **Test Copy to Clipboard:**
   - Build a prompt
   - Click "Copy to Clipboard"
   - Paste into text editor
   - Verify full prompt is copied

### Unit Tests

Backend tests are in `templates.rs`:

```bash
cd src-tauri
cargo test
```

Tests verify:
- Template loading returns correct number of templates
- Required templates exist (agent, planning, debugging, review)
- Prompt building with custom instructions
- Prompt building with file contents
- Error handling for invalid template IDs

## Performance Considerations

1. **Token Counting Debouncing:**
   - 300ms delay prevents excessive calculations
   - Uses setTimeout for efficient batching

2. **Efficient Token Limit Checking:**
   - `isWithinTokenLimit()` is faster than full encoding
   - Returns boolean or count depending on result
   - Use for quick limit checks before full count

3. **File Content Caching:**
   - File contents are only loaded when building prompt
   - Not cached in memory (use database as source of truth)
   - Large files are read on-demand

4. **Template Storage:**
   - Templates stored as Rust constants (compile-time)
   - No database queries needed for templates
   - Instant access

## Future Enhancements

Potential improvements for future phases:

1. **Custom Templates:**
   - Allow users to create and save custom templates
   - Store in database settings table
   - UI for template management

2. **Token Count Caching:**
   - Cache token counts per file in database
   - Invalidate on file change (using fingerprint)
   - Pre-calculate during indexing

3. **Streaming Token Counting:**
   - Count tokens as files are loaded
   - Show running total during prompt building
   - Cancel if limit exceeded

4. **Multi-Model Support:**
   - Show token counts for multiple models simultaneously
   - Compare limits across models
   - Recommend best model for prompt size

5. **Token Optimization:**
   - Suggest file selections that fit within limits
   - Highlight which files use most tokens
   - Auto-trim or summarize if over limit

6. **Export Formats:**
   - Export prompt as Markdown
   - Export as JSON (structured format)
   - Export with metadata (timestamp, model, file list)

## Troubleshooting

### Issue: Token count seems inaccurate

**Solution:** The tokenizer uses GPT-4o encoding which is accurate for OpenAI models. For Claude/Gemini, counts are estimates (±15%). For exact counts:
- Use the API of the target model
- Or implement model-specific tokenizers

### Issue: Build button disabled

**Solution:** Check that:
- At least one file is selected
- Files have been indexed (exist in database)
- No build operation is currently in progress

### Issue: Copy to clipboard not working

**Solution:** 
- Ensure app has clipboard permissions
- Check browser console for errors
- Try clicking again (some browsers require user gesture)
- Use Ctrl+A, Ctrl+C as fallback

### Issue: Token counter shows 0

**Solution:**
- Verify text is not empty
- Check browser console for tokenizer errors
- Ensure gpt-tokenizer is installed: `npm list gpt-tokenizer`

## Dependencies

### NPM Packages
- `gpt-tokenizer@^2.4.0` - OpenAI tokenizer (exact for GPT models)

### Rust Crates
- `serde` - Serialization for API types
- `rusqlite` - Database access for file contents
- `log` - Logging

## Architectural Decisions

1. **Why GPT-4o encoding for all models?**
   - Most accurate and battle-tested tokenizer
   - Claude/Gemini counts are close enough for UX purposes
   - Adding multiple tokenizers would bloat bundle size
   - Users primarily target OpenAI models

2. **Why not cache token counts in database?**
   - Phase 5 focuses on building, not optimization
   - Caching adds complexity (invalidation, migration)
   - Modern tokenizers are fast enough (< 50ms for 1MB)
   - Can be added in Phase 7 (optimization)

3. **Why built-in templates vs database?**
   - Simpler implementation (no CRUD UI needed)
   - Fast access (compile-time constants)
   - Version controlled with code
   - Custom templates can be added later

4. **Why no syntax highlighting in preview?**
   - Keeps bundle size small
   - Monospace font is sufficient for readability
   - Can add in future with code-splitting
   - Users will paste into AI chat anyway

## Summary

Phase 5 successfully implements:
- ✅ Token counting with gpt-tokenizer
- ✅ 6 built-in prompt templates
- ✅ Prompt building from selected files
- ✅ Real-time token counter with visual indicators
- ✅ Support for 9 AI models with correct limits
- ✅ Token limit warnings
- ✅ Prompt preview and clipboard copy
- ✅ Comprehensive TypeScript types
- ✅ Error handling and user feedback

The implementation follows the blueprint from PLAN.md and integrates cleanly with Phase 1's database infrastructure. Ready for Phase 6 (Browser Automation).
