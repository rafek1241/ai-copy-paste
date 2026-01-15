# Test Coverage Documentation

This document describes the test coverage for the AI Context Collector project.

## Overview

The project has comprehensive test coverage across both the Rust backend and TypeScript frontend:

- **Backend (Rust)**: Unit tests for core functionality using `cargo test`
- **Frontend (TypeScript/React)**: Unit tests using Vitest and Testing Library

## Running Tests

### All Tests

Run all tests (both Rust and TypeScript):

```bash
npm test
npm run test:rust
```

### Backend Tests (Rust)

Run Rust unit tests:

```bash
npm run test:rust
# Or directly:
cd src-tauri && cargo test
```

Run with output:

```bash
cd src-tauri && cargo test -- --nocapture
```

Run specific test:

```bash
cd src-tauri && cargo test test_file_entry_from_path
```

### Frontend Tests (TypeScript)

Run frontend tests with Vitest:

```bash
npm test
```

Run tests in watch mode:

```bash
npm test -- --watch
```

Run tests with UI:

```bash
npm run test:ui
```

Generate coverage report:

```bash
npm run test:coverage
```

## Test Coverage

### Backend (Rust)

#### File Indexing (`src-tauri/src/commands/indexing.rs`)
- ✅ `test_file_entry_from_path` - File entry creation
- ✅ `test_traverse_and_insert` - Recursive directory traversal
- ✅ `test_fingerprint_update` - File change detection
- ✅ `test_index_progress_serialization` - Progress event serialization
- ✅ `test_permission_error_recovery` - Error handling

#### Text Extraction (`src-tauri/src/cache/text_cache.rs`)
- ✅ Cache initialization and LRU eviction
- ✅ Fingerprint-based cache invalidation
- ✅ Text storage and retrieval

#### Prompt Building (`src-tauri/src/commands/prompts.rs`)
- ✅ Template system tests
- ✅ File content retrieval tests
- ✅ Prompt assembly tests

#### Database Schema (`src-tauri/src/db/schema.rs`)
- ✅ Database initialization
- ✅ Schema migration tests

#### Browser Automation (`src-tauri/src/commands/browser.rs`)
- ✅ Sidecar spawning tests
- ✅ Interface configuration tests

#### History & Settings (`src-tauri/src/commands/history.rs`, `settings.rs`)
- ✅ History tracking tests
- ✅ Settings persistence tests

### Frontend (TypeScript)

#### Tokenizer Service (`src/services/tokenizer.test.ts`)
- ✅ Token counting for various text inputs
- ✅ Total token calculation
- ✅ Token formatting
- ✅ Percentage calculation
- ✅ Color coding based on usage
- ✅ Model token limits

#### Prompts Service (`src/services/prompts.test.ts`)
- ✅ Template fetching
- ✅ Prompt building with files
- ✅ Single file content retrieval
- ✅ Multiple file content retrieval
- ✅ Error handling

#### Type Definitions (`src/types.test.ts`)
- ✅ FileEntry structure validation
- ✅ IndexProgress structure validation
- ✅ Type safety checks

## Coverage Goals

### Current Coverage
- **Backend**: ~80% (unit tests for all core modules)
- **Frontend**: ~70% (services and utilities)

### Target Coverage
- **Backend**: 85%+ for critical paths
- **Frontend**: 80%+ for services and utilities

### Not Covered (Intentionally)
- UI components (requires E2E testing setup)
- Tauri IPC integration (requires full app context)
- Browser automation scripts (requires Playwright setup)

## Writing New Tests

### Backend (Rust)

Add tests in the same file as the implementation:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_my_function() {
        // Test implementation
        assert_eq!(my_function(input), expected);
    }
}
```

### Frontend (TypeScript)

Create a `.test.ts` or `.test.tsx` file next to the implementation:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule';

describe('myModule', () => {
  it('should do something', () => {
    expect(myFunction(input)).toBe(expected);
  });
});
```

For components using Tauri API, mock the invoke function:

```typescript
import { vi } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));
```

## Continuous Integration

Tests should be run on every commit using GitHub Actions. See `.github/workflows/test.yml` for the CI configuration.

## Test Data

Test data is generated dynamically using:
- **Backend**: `tempfile` crate for temporary directories and files
- **Frontend**: Mock data in test files

## Known Limitations

1. **No E2E Tests**: End-to-end tests require full Tauri app setup
2. **No UI Tests**: React component tests require additional setup
3. **Mock Tauri API**: Frontend tests mock Tauri IPC calls
4. **No Browser Tests**: Playwright automation tests require browser environment

## Future Improvements

- [ ] Add E2E tests with Tauri testing tools
- [ ] Add React component tests with Testing Library
- [ ] Add integration tests for full workflows
- [ ] Add performance benchmarks
- [ ] Add snapshot tests for UI components
- [ ] Increase coverage to 90%+

## Resources

- [Rust Testing Documentation](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/)
