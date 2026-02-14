# Sensitive Data Protection — Detailed Implementation Guide

> **Purpose**: This document is a step-by-step engineering guide for implementing the Sensitive Data Protection feature. Every task includes exact file paths, code snippets, type definitions, integration points, and testing patterns so that any engineer can implement it without ambiguity.
>
> **Pre-requisites**: Read `spec.md` and `plan.md` in this directory first.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Backend — Core Detection Engine](#2-phase-1-backend--core-detection-engine)
3. [Phase 2: Backend — Custom Patterns & Storage](#3-phase-2-backend--custom-patterns--storage)
4. [Phase 3: Backend — Integration Commands](#4-phase-3-backend--integration-commands)
5. [Phase 4: Frontend — Settings UI](#5-phase-4-frontend--settings-ui)
6. [Phase 5: Prevention Feature & UI Indicators](#6-phase-5-prevention-feature--ui-indicators)
7. [Cross-cutting Concerns](#7-cross-cutting-concerns)
8. [File Inventory](#8-file-inventory)

---

## 1. Architecture Overview

### Data Flow (Redaction Pipeline)

```
User selects files → PromptBuilder.buildAndCopy()
  → assemblePrompt() [src/services/assembly.ts]
    → invoke("build_prompt_from_files") [Rust backend]
      → read_file_content() for each file
      → ★ NEW: apply_redaction(content, patterns) ← happens HERE
      → build_prompt(template, instructions, redacted_contents)
    → return BuildPromptResponse with redacted prompt
  → clipboard.write(response.prompt)
```

### Where Redaction Happens

**Decision: Backend (Rust)**. Reasons:
- The backend already reads file content in `build_prompt_from_files` 
- Regex matching is faster in Rust than JS
- Single integration point — all prompt paths go through `build_prompt_from_files`
- The backend already has the `regex` crate as a dependency

### New Module Structure

```
src-tauri/src/
├── sensitive/              ← NEW MODULE
│   ├── mod.rs              ← Module declarations
│   ├── patterns.rs         ← Built-in pattern definitions
│   ├── detection.rs        ← Pattern matching engine
│   └── redaction.rs        ← Content redaction logic
├── commands/
│   ├── mod.rs              ← Add `pub mod sensitive;`
│   └── sensitive.rs        ← NEW: Tauri commands for patterns CRUD + scanning
```

```
src/
├── services/
│   └── sensitive.ts        ← NEW: Frontend service calling Tauri commands
├── components/
│   └── SensitiveDataSettings.tsx  ← NEW: Settings UI section
```

### Type Definitions

**Rust types** (in `src-tauri/src/sensitive/mod.rs`):

```rust
use serde::{Deserialize, Serialize};

/// A pattern for detecting sensitive data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensitivePattern {
    /// Unique identifier (e.g., "aws_access_key", "email", or user-defined)
    pub id: String,
    /// Human-readable name (e.g., "AWS Access Key")
    pub name: String,
    /// The regex pattern string
    pub pattern: String,
    /// Placeholder to replace matches with (e.g., "[AWS_KEY]")
    pub placeholder: String,
    /// Whether this pattern is enabled
    pub enabled: bool,
    /// Whether this is a built-in pattern (cannot be deleted)
    pub builtin: bool,
    /// Category for grouping in UI (e.g., "API Keys", "PII", "Connection Strings")
    pub category: String,
}

/// Result of scanning a file for sensitive data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    /// File path
    pub path: String,
    /// Whether the file contains sensitive data
    pub has_sensitive_data: bool,
    /// List of pattern IDs that matched
    pub matched_patterns: Vec<String>,
    /// Number of total matches found
    pub match_count: usize,
}

/// Result of redacting content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionResult {
    /// The redacted content
    pub content: String,
    /// Number of replacements made
    pub replacements: usize,
    /// Pattern IDs that were applied
    pub applied_patterns: Vec<String>,
}
```

**TypeScript types** (add to `src/types.ts` or to a new `src/types/sensitive.ts`):

```typescript
export interface SensitivePattern {
  id: string;
  name: string;
  pattern: string;
  placeholder: string;
  enabled: boolean;
  builtin: boolean;
  category: string;
}

export interface ScanResult {
  path: string;
  has_sensitive_data: boolean;
  matched_patterns: string[];
  match_count: number;
}

export interface SensitiveDataSettings {
  enabled: boolean;
  prevent_selection: boolean;
  patterns: SensitivePattern[];
}
```

---

## 2. Phase 1: Backend — Core Detection Engine

### Task 1.1: Create Module Structure

**Files to create:**

#### `src-tauri/src/sensitive/mod.rs`

```rust
pub mod detection;
pub mod patterns;
pub mod redaction;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensitivePattern {
    pub id: String,
    pub name: String,
    pub pattern: String,
    pub placeholder: String,
    pub enabled: bool,
    pub builtin: bool,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub path: String,
    pub has_sensitive_data: bool,
    pub matched_patterns: Vec<String>,
    pub match_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionResult {
    pub content: String,
    pub replacements: usize,
    pub applied_patterns: Vec<String>,
}
```

#### Register the module in `src-tauri/src/lib.rs`

Add `mod sensitive;` to the module declarations at the top:

```rust
mod cache;
mod commands;
mod db;
mod error;
pub mod gitignore;
mod sensitive;   // ← ADD THIS
mod templates;
```

### Task 1.2: Built-in Pattern Definitions

**File**: `src-tauri/src/sensitive/patterns.rs`

This file defines ALL built-in regex patterns. Each pattern must be carefully crafted to minimize false positives.

```rust
use super::SensitivePattern;

/// Returns all built-in sensitive data patterns
pub fn get_builtin_patterns() -> Vec<SensitivePattern> {
    vec![
        // ===== API Keys & Secrets =====
        SensitivePattern {
            id: "aws_access_key".into(),
            name: "AWS Access Key".into(),
            pattern: r"(?:^|[^A-Za-z0-9/+=])((AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16})(?:[^A-Za-z0-9/+=]|$)".into(),
            placeholder: "[AWS_ACCESS_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "aws_secret_key".into(),
            name: "AWS Secret Key".into(),
            pattern: r"(?i)(?:aws_secret_access_key|aws_secret_key|secret_key)\s*[=:]\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?".into(),
            placeholder: "[AWS_SECRET_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "github_token".into(),
            name: "GitHub Token".into(),
            pattern: r"(ghp_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{22,255})".into(),
            placeholder: "[GITHUB_TOKEN]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "openai_key".into(),
            name: "OpenAI API Key".into(),
            pattern: r"(sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{40,})".into(),
            placeholder: "[OPENAI_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "generic_api_key".into(),
            name: "Generic API Key".into(),
            pattern: r#"(?i)(?:api[_-]?key|apikey)\s*[=:]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?"#.into(),
            placeholder: "[API_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "generic_secret".into(),
            name: "Generic Secret".into(),
            pattern: r#"(?i)(?:secret|secret[_-]?key|client[_-]?secret)\s*[=:]\s*['"]?([A-Za-z0-9_\-]{16,})['"]?"#.into(),
            placeholder: "[SECRET]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "azure_key".into(),
            name: "Azure Subscription Key".into(),
            pattern: r"(?i)(?:azure|subscription)[_-]?key\s*[=:]\s*['\"]?([A-Fa-f0-9]{32})['\"]?".into(),
            placeholder: "[AZURE_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "google_api_key".into(),
            name: "Google API Key".into(),
            pattern: r"AIza[0-9A-Za-z_-]{35}".into(),
            placeholder: "[GOOGLE_API_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },

        // ===== Authentication Credentials =====
        SensitivePattern {
            id: "password_field".into(),
            name: "Password in Config".into(),
            pattern: r#"(?i)(?:password|passwd|pwd)\s*[=:]\s*['"]?([^\s'"]{4,})['"]?"#.into(),
            placeholder: "[PASSWORD]".into(),
            enabled: true,
            builtin: true,
            category: "Authentication".into(),
        },
        SensitivePattern {
            id: "bearer_token".into(),
            name: "Bearer Token".into(),
            pattern: r"(?i)Bearer\s+([A-Za-z0-9_\-\.]+)".into(),
            placeholder: "[BEARER_TOKEN]".into(),
            enabled: true,
            builtin: true,
            category: "Authentication".into(),
        },
        SensitivePattern {
            id: "basic_auth".into(),
            name: "Basic Auth".into(),
            pattern: r"(?i)Basic\s+([A-Za-z0-9+/=]{10,})".into(),
            placeholder: "[BASIC_AUTH]".into(),
            enabled: true,
            builtin: true,
            category: "Authentication".into(),
        },
        SensitivePattern {
            id: "jwt_token".into(),
            name: "JWT Token".into(),
            pattern: r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-]+".into(),
            placeholder: "[JWT_TOKEN]".into(),
            enabled: true,
            builtin: true,
            category: "Authentication".into(),
        },

        // ===== Connection Strings =====
        SensitivePattern {
            id: "mysql_conn".into(),
            name: "MySQL Connection String".into(),
            pattern: r"mysql://[^\s'\"]+".into(),
            placeholder: "[MYSQL_CONNECTION_STRING]".into(),
            enabled: true,
            builtin: true,
            category: "Connection Strings".into(),
        },
        SensitivePattern {
            id: "postgres_conn".into(),
            name: "PostgreSQL Connection String".into(),
            pattern: r"postgres(?:ql)?://[^\s'\"]+".into(),
            placeholder: "[POSTGRES_CONNECTION_STRING]".into(),
            enabled: true,
            builtin: true,
            category: "Connection Strings".into(),
        },
        SensitivePattern {
            id: "mongodb_conn".into(),
            name: "MongoDB Connection String".into(),
            pattern: r"mongodb(?:\+srv)?://[^\s'\"]+".into(),
            placeholder: "[MONGODB_CONNECTION_STRING]".into(),
            enabled: true,
            builtin: true,
            category: "Connection Strings".into(),
        },
        SensitivePattern {
            id: "redis_conn".into(),
            name: "Redis Connection String".into(),
            pattern: r"redis://[^\s'\"]+".into(),
            placeholder: "[REDIS_CONNECTION_STRING]".into(),
            enabled: true,
            builtin: true,
            category: "Connection Strings".into(),
        },

        // ===== PII =====
        SensitivePattern {
            id: "email".into(),
            name: "Email Address".into(),
            pattern: r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}".into(),
            placeholder: "[EMAIL]".into(),
            enabled: false, // Disabled by default — high false positive rate in code
            builtin: true,
            category: "PII".into(),
        },
        SensitivePattern {
            id: "phone_us".into(),
            name: "US Phone Number".into(),
            pattern: r"(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}".into(),
            placeholder: "[PHONE]".into(),
            enabled: false, // Disabled by default — high false positive rate
            builtin: true,
            category: "PII".into(),
        },
        SensitivePattern {
            id: "ssn".into(),
            name: "US Social Security Number".into(),
            pattern: r"\b\d{3}-\d{2}-\d{4}\b".into(),
            placeholder: "[SSN]".into(),
            enabled: true,
            builtin: true,
            category: "PII".into(),
        },
        SensitivePattern {
            id: "credit_card".into(),
            name: "Credit Card Number".into(),
            pattern: r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b".into(),
            placeholder: "[CREDIT_CARD]".into(),
            enabled: true,
            builtin: true,
            category: "PII".into(),
        },

        // ===== Network =====
        SensitivePattern {
            id: "ipv4".into(),
            name: "IPv4 Address".into(),
            pattern: r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b".into(),
            placeholder: "[IP_ADDRESS]".into(),
            enabled: false, // Disabled by default
            builtin: true,
            category: "Network".into(),
        },

        // ===== Private Keys =====
        SensitivePattern {
            id: "private_key".into(),
            name: "Private Key Block".into(),
            pattern: r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----".into(),
            placeholder: "[PRIVATE_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "Private Keys".into(),
        },

        // ===== Environment Variables =====
        SensitivePattern {
            id: "env_secret".into(),
            name: "Secret in Env Variable".into(),
            pattern: r#"(?i)(?:^|export\s+)[A-Z_]*(?:SECRET|PASSWORD|TOKEN|KEY|CREDENTIALS|AUTH)[A-Z_]*\s*=\s*['"]?([^\s'"]+)['"]?"#.into(),
            placeholder: "[ENV_SECRET]".into(),
            enabled: true,
            builtin: true,
            category: "Environment Variables".into(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_patterns_not_empty() {
        let patterns = get_builtin_patterns();
        assert!(patterns.len() > 10, "Should have at least 10 built-in patterns");
    }

    #[test]
    fn test_all_patterns_have_unique_ids() {
        let patterns = get_builtin_patterns();
        let mut ids: Vec<&str> = patterns.iter().map(|p| p.id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), patterns.len(), "Pattern IDs must be unique");
    }

    #[test]
    fn test_all_builtin_patterns_are_valid_regex() {
        let patterns = get_builtin_patterns();
        for pattern in &patterns {
            let result = regex::Regex::new(&pattern.pattern);
            assert!(result.is_ok(), "Pattern '{}' has invalid regex: {}", pattern.id, pattern.pattern);
        }
    }

    #[test]
    fn test_all_patterns_are_builtin() {
        let patterns = get_builtin_patterns();
        for pattern in &patterns {
            assert!(pattern.builtin, "Pattern '{}' should be marked builtin", pattern.id);
        }
    }
}
```

### Task 1.3: Detection Engine

**File**: `src-tauri/src/sensitive/detection.rs`

The detection engine compiles patterns once (lazily) and runs them against content.

```rust
use super::SensitivePattern;
use regex::Regex;
use std::collections::HashMap;

/// A compiled pattern ready for matching
pub struct CompiledPattern {
    pub pattern: SensitivePattern,
    pub regex: Regex,
}

/// Compile a list of patterns, skipping invalid regex
pub fn compile_patterns(patterns: &[SensitivePattern]) -> Vec<CompiledPattern> {
    patterns
        .iter()
        .filter(|p| p.enabled)
        .filter_map(|p| {
            match Regex::new(&p.pattern) {
                Ok(regex) => Some(CompiledPattern {
                    pattern: p.clone(),
                    regex,
                }),
                Err(e) => {
                    log::warn!("Invalid regex for pattern '{}': {}", p.id, e);
                    None
                }
            }
        })
        .collect()
}

/// A single match found in content
#[derive(Debug, Clone)]
pub struct DetectionMatch {
    pub pattern_id: String,
    pub matched_text: String,
    pub start: usize,
    pub end: usize,
}

/// Detect all sensitive data matches in content
pub fn detect_sensitive_data(
    content: &str,
    compiled_patterns: &[CompiledPattern],
) -> Vec<DetectionMatch> {
    let mut matches = Vec::new();

    for cp in compiled_patterns {
        for mat in cp.regex.find_iter(content) {
            matches.push(DetectionMatch {
                pattern_id: cp.pattern.id.clone(),
                matched_text: mat.as_str().to_string(),
                start: mat.start(),
                end: mat.end(),
            });
        }
    }

    // Sort by start position (for ordered replacement later)
    matches.sort_by_key(|m| m.start);
    matches
}

/// Quick check: does content contain any sensitive data?
pub fn has_sensitive_data(
    content: &str,
    compiled_patterns: &[CompiledPattern],
) -> bool {
    compiled_patterns.iter().any(|cp| cp.regex.is_match(content))
}

/// Get unique pattern IDs that matched
pub fn get_matched_pattern_ids(matches: &[DetectionMatch]) -> Vec<String> {
    let mut seen = HashMap::new();
    let mut result = Vec::new();
    for m in matches {
        if seen.insert(m.pattern_id.clone(), ()).is_none() {
            result.push(m.pattern_id.clone());
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sensitive::patterns::get_builtin_patterns;

    fn compile_all() -> Vec<CompiledPattern> {
        let mut patterns = get_builtin_patterns();
        // Enable all for testing
        for p in &mut patterns {
            p.enabled = true;
        }
        compile_patterns(&patterns)
    }

    #[test]
    fn test_detect_aws_access_key() {
        let compiled = compile_all();
        let content = "aws_access_key_id = AKIAIOSFODNN7EXAMPLE";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(!matches.is_empty(), "Should detect AWS access key");
        assert!(matches.iter().any(|m| m.pattern_id == "aws_access_key"));
    }

    #[test]
    fn test_detect_github_token() {
        let compiled = compile_all();
        let content = "token = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "github_token"));
    }

    #[test]
    fn test_detect_email() {
        let compiled = compile_all();
        let content = "contact us at admin@example.com for support";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "email"));
    }

    #[test]
    fn test_detect_postgres_connection_string() {
        let compiled = compile_all();
        let content = r#"DATABASE_URL=postgresql://user:pass@localhost:5432/mydb"#;
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "postgres_conn"));
    }

    #[test]
    fn test_detect_jwt_token() {
        let compiled = compile_all();
        let content = "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "jwt_token"));
    }

    #[test]
    fn test_detect_private_key() {
        let compiled = compile_all();
        let content = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "private_key"));
    }

    #[test]
    fn test_no_matches_clean_content() {
        let compiled = compile_all();
        let content = "fn main() {\n    println!(\"Hello, world!\");\n}";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.is_empty(), "Clean code should have no matches");
    }

    #[test]
    fn test_empty_content() {
        let compiled = compile_all();
        let matches = detect_sensitive_data("", &compiled);
        assert!(matches.is_empty());
    }

    #[test]
    fn test_multiple_matches_same_content() {
        let compiled = compile_all();
        let content = r#"
            API_KEY=sk-proj-test1234567890abcdefghijklmnopqrstuvwxyz1234567890
            DATABASE_URL=postgresql://admin:secret@db.example.com:5432/prod
            password = "super_secret_123"
        "#;
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.len() >= 2, "Should detect multiple sensitive items");
    }

    #[test]
    fn test_has_sensitive_data_true() {
        let compiled = compile_all();
        let content = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234";
        assert!(has_sensitive_data(content, &compiled));
    }

    #[test]
    fn test_has_sensitive_data_false() {
        let compiled = compile_all();
        let content = "let x = 42;";
        assert!(!has_sensitive_data(content, &compiled));
    }

    #[test]
    fn test_disabled_pattern_skipped() {
        let mut patterns = get_builtin_patterns();
        // Disable all patterns
        for p in &mut patterns {
            p.enabled = false;
        }
        let compiled = compile_patterns(&patterns);
        assert!(compiled.is_empty(), "No patterns should be compiled when all disabled");
    }

    #[test]
    fn test_invalid_regex_skipped() {
        let patterns = vec![SensitivePattern {
            id: "bad".into(),
            name: "Bad Pattern".into(),
            pattern: r"[invalid".into(), // Invalid regex
            placeholder: "[BAD]".into(),
            enabled: true,
            builtin: false,
            category: "Test".into(),
        }];
        let compiled = compile_patterns(&patterns);
        assert!(compiled.is_empty(), "Invalid regex should be skipped");
    }

    #[test]
    fn test_matches_sorted_by_position() {
        let compiled = compile_all();
        let content = "email@test.com then ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234";
        let matches = detect_sensitive_data(content, &compiled);
        for window in matches.windows(2) {
            assert!(window[0].start <= window[1].start, "Matches should be sorted by position");
        }
    }
}
```

### Task 1.4: Redaction Engine

**File**: `src-tauri/src/sensitive/redaction.rs`

```rust
use super::detection::{compile_patterns, detect_sensitive_data, CompiledPattern, DetectionMatch};
use super::{RedactionResult, SensitivePattern};
use std::collections::HashMap;

/// Redact sensitive data in content, replacing matches with their placeholders.
/// Handles overlapping matches by processing from end to start.
pub fn redact_content(
    content: &str,
    compiled_patterns: &[CompiledPattern],
) -> RedactionResult {
    let matches = detect_sensitive_data(content, compiled_patterns);

    if matches.is_empty() {
        return RedactionResult {
            content: content.to_string(),
            replacements: 0,
            applied_patterns: vec![],
        };
    }

    // Build a placeholder lookup from pattern_id
    let placeholder_map: HashMap<&str, &str> = compiled_patterns
        .iter()
        .map(|cp| (cp.pattern.id.as_str(), cp.pattern.placeholder.as_str()))
        .collect();

    // Remove overlapping matches — keep the first (leftmost) match
    let non_overlapping = remove_overlapping_matches(&matches);

    // Replace from end to start so indices stay valid
    let mut result = content.to_string();
    let mut applied_pattern_ids: HashMap<String, ()> = HashMap::new();

    for m in non_overlapping.iter().rev() {
        let placeholder = placeholder_map
            .get(m.pattern_id.as_str())
            .unwrap_or(&"[REDACTED]");
        result.replace_range(m.start..m.end, placeholder);
        applied_pattern_ids.insert(m.pattern_id.clone(), ());
    }

    RedactionResult {
        content: result,
        replacements: non_overlapping.len(),
        applied_patterns: applied_pattern_ids.into_keys().collect(),
    }
}

/// Remove overlapping matches, keeping the leftmost one
fn remove_overlapping_matches(matches: &[DetectionMatch]) -> Vec<DetectionMatch> {
    if matches.is_empty() {
        return vec![];
    }

    let mut result = vec![matches[0].clone()];

    for m in matches.iter().skip(1) {
        let last = result.last().unwrap();
        if m.start >= last.end {
            result.push(m.clone());
        }
        // else: overlapping, skip it
    }

    result
}

/// Convenience: compile patterns and redact in one call
pub fn redact_with_patterns(
    content: &str,
    patterns: &[SensitivePattern],
) -> RedactionResult {
    let compiled = compile_patterns(patterns);
    redact_content(content, &compiled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sensitive::patterns::get_builtin_patterns;

    fn compile_all() -> Vec<CompiledPattern> {
        let mut patterns = get_builtin_patterns();
        for p in &mut patterns {
            p.enabled = true;
        }
        compile_patterns(&patterns)
    }

    #[test]
    fn test_redact_single_match() {
        let compiled = compile_all();
        let content = "token = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234";
        let result = redact_content(content, &compiled);
        assert!(result.content.contains("[GITHUB_TOKEN]"));
        assert!(!result.content.contains("ghp_"));
        assert!(result.replacements >= 1);
    }

    #[test]
    fn test_redact_multiple_patterns() {
        let compiled = compile_all();
        let content = r#"
DB_URL=postgresql://admin:pass@localhost/mydb
API_SECRET=my_very_secret_key_12345
"#;
        let result = redact_content(content, &compiled);
        assert!(result.replacements >= 1);
        assert!(!result.content.contains("admin:pass"));
    }

    #[test]
    fn test_redact_no_matches() {
        let compiled = compile_all();
        let content = "fn main() { println!(\"Hello!\"); }";
        let result = redact_content(content, &compiled);
        assert_eq!(result.content, content);
        assert_eq!(result.replacements, 0);
        assert!(result.applied_patterns.is_empty());
    }

    #[test]
    fn test_redact_empty_content() {
        let compiled = compile_all();
        let result = redact_content("", &compiled);
        assert_eq!(result.content, "");
        assert_eq!(result.replacements, 0);
    }

    #[test]
    fn test_redact_preserves_surrounding_content() {
        let compiled = compile_all();
        let content = "before ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234 after";
        let result = redact_content(content, &compiled);
        assert!(result.content.starts_with("before "));
        assert!(result.content.ends_with(" after"));
    }

    #[test]
    fn test_redact_with_custom_pattern() {
        let patterns = vec![SensitivePattern {
            id: "custom_ssn".into(),
            name: "SSN".into(),
            pattern: r"\d{3}-\d{2}-\d{4}".into(),
            placeholder: "[CUSTOM_SSN]".into(),
            enabled: true,
            builtin: false,
            category: "Custom".into(),
        }];
        let compiled = compile_patterns(&patterns);
        let content = "SSN: 123-45-6789 is confidential";
        let result = redact_content(content, &compiled);
        assert!(result.content.contains("[CUSTOM_SSN]"));
        assert!(!result.content.contains("123-45-6789"));
        assert_eq!(result.replacements, 1);
    }

    #[test]
    fn test_remove_overlapping_keeps_leftmost() {
        let matches = vec![
            DetectionMatch { pattern_id: "a".into(), matched_text: "abc".into(), start: 0, end: 3 },
            DetectionMatch { pattern_id: "b".into(), matched_text: "bc".into(), start: 1, end: 3 },
            DetectionMatch { pattern_id: "c".into(), matched_text: "def".into(), start: 5, end: 8 },
        ];
        let result = remove_overlapping_matches(&matches);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].pattern_id, "a");
        assert_eq!(result[1].pattern_id, "c");
    }
}
```

---

## 3. Phase 2: Backend — Custom Patterns & Storage

### Task 2.1: Settings Storage for Patterns

Patterns are stored in the existing `settings` table as JSON under specific keys:

| Key | Value Type | Description |
|-----|-----------|-------------|
| `sensitive_data_enabled` | `"true"` / `"false"` | Global feature toggle |
| `sensitive_prevent_selection` | `"true"` / `"false"` | Prevention mode toggle |
| `sensitive_custom_patterns` | JSON array | Custom user-defined patterns |
| `sensitive_disabled_builtins` | JSON array of strings | IDs of built-in patterns the user disabled |

**Why this approach**: Reuses existing `settings` key-value table. No new DB tables needed. The `save_setting`/`get_setting` infrastructure already works.

### Task 2.2: Tauri Commands for Pattern Management

**File**: `src-tauri/src/commands/sensitive.rs`

```rust
use crate::db::DbConnection;
use crate::sensitive::patterns::get_builtin_patterns;
use crate::sensitive::detection::{compile_patterns, detect_sensitive_data, has_sensitive_data};
use crate::sensitive::redaction::redact_content;
use crate::sensitive::{SensitivePattern, ScanResult, RedactionResult};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

/// Settings keys (constants to avoid typos)
const KEY_ENABLED: &str = "sensitive_data_enabled";
const KEY_PREVENT: &str = "sensitive_prevent_selection";
const KEY_CUSTOM_PATTERNS: &str = "sensitive_custom_patterns";
const KEY_DISABLED_BUILTINS: &str = "sensitive_disabled_builtins";

// ===== Internal helpers =====

fn get_setting(db: &DbConnection, key: &str) -> Result<Option<String>, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("Failed to get setting: {}", e))
}

fn set_setting(db: &DbConnection, key: &str, value: &str) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| format!("Failed to save setting: {}", e))?;
    Ok(())
}

/// Merge built-in and custom patterns, applying user's enable/disable preferences
fn get_all_patterns_internal(db: &DbConnection) -> Result<Vec<SensitivePattern>, String> {
    // Load custom patterns
    let custom_patterns: Vec<SensitivePattern> = match get_setting(db, KEY_CUSTOM_PATTERNS)? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => vec![],
    };

    // Load disabled built-in IDs
    let disabled_builtins: Vec<String> = match get_setting(db, KEY_DISABLED_BUILTINS)? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => vec![],
    };
    let disabled_set: std::collections::HashSet<&str> =
        disabled_builtins.iter().map(|s| s.as_str()).collect();

    // Merge: built-ins (with user's enabled state) + custom patterns
    let mut all_patterns: Vec<SensitivePattern> = get_builtin_patterns()
        .into_iter()
        .map(|mut p| {
            if disabled_set.contains(p.id.as_str()) {
                p.enabled = false;
            }
            p
        })
        .collect();

    all_patterns.extend(custom_patterns);
    Ok(all_patterns)
}

fn is_feature_enabled(db: &DbConnection) -> Result<bool, String> {
    Ok(get_setting(db, KEY_ENABLED)?
        .map(|v| v == "true")
        .unwrap_or(false)) // Default: disabled
}

fn is_prevent_selection_enabled(db: &DbConnection) -> Result<bool, String> {
    Ok(get_setting(db, KEY_PREVENT)?
        .map(|v| v == "true")
        .unwrap_or(false)) // Default: disabled
}

// ===== Tauri Commands =====

/// Get all patterns (built-in + custom, with user preferences applied)
#[tauri::command]
pub async fn get_sensitive_patterns(
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<SensitivePattern>, String> {
    get_all_patterns_internal(&db)
}

/// Get the current enabled state of the feature
#[tauri::command]
pub async fn get_sensitive_data_enabled(
    db: tauri::State<'_, DbConnection>,
) -> Result<bool, String> {
    is_feature_enabled(&db)
}

/// Toggle the feature on/off
#[tauri::command]
pub async fn set_sensitive_data_enabled(
    db: tauri::State<'_, DbConnection>,
    enabled: bool,
) -> Result<(), String> {
    set_setting(&db, KEY_ENABLED, &enabled.to_string())
}

/// Get "prevent selection" setting
#[tauri::command]
pub async fn get_prevent_selection(
    db: tauri::State<'_, DbConnection>,
) -> Result<bool, String> {
    is_prevent_selection_enabled(&db)
}

/// Toggle "prevent selection" on/off
#[tauri::command]
pub async fn set_prevent_selection(
    db: tauri::State<'_, DbConnection>,
    enabled: bool,
) -> Result<(), String> {
    set_setting(&db, KEY_PREVENT, &enabled.to_string())
}

/// Add a custom pattern
#[tauri::command]
pub async fn add_custom_pattern(
    db: tauri::State<'_, DbConnection>,
    pattern: SensitivePattern,
) -> Result<(), String> {
    // Validate regex
    regex::Regex::new(&pattern.pattern)
        .map_err(|e| format!("Invalid regex pattern: {}", e))?;

    let mut custom: Vec<SensitivePattern> = match get_setting(&db, KEY_CUSTOM_PATTERNS)? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => vec![],
    };

    // Check for duplicate ID
    if custom.iter().any(|p| p.id == pattern.id) {
        return Err(format!("Pattern with id '{}' already exists", pattern.id));
    }

    custom.push(SensitivePattern { builtin: false, ..pattern });
    let json = serde_json::to_string(&custom)
        .map_err(|e| format!("Serialization error: {}", e))?;
    set_setting(&db, KEY_CUSTOM_PATTERNS, &json)
}

/// Delete a custom pattern by ID
#[tauri::command]
pub async fn delete_custom_pattern(
    db: tauri::State<'_, DbConnection>,
    pattern_id: String,
) -> Result<(), String> {
    let mut custom: Vec<SensitivePattern> = match get_setting(&db, KEY_CUSTOM_PATTERNS)? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => vec![],
    };
    let original_len = custom.len();
    custom.retain(|p| p.id != pattern_id);
    if custom.len() == original_len {
        return Err(format!("Custom pattern '{}' not found", pattern_id));
    }
    let json = serde_json::to_string(&custom)
        .map_err(|e| format!("Serialization error: {}", e))?;
    set_setting(&db, KEY_CUSTOM_PATTERNS, &json)
}

/// Toggle a pattern's enabled state (works for both built-in and custom)
#[tauri::command]
pub async fn toggle_pattern_enabled(
    db: tauri::State<'_, DbConnection>,
    pattern_id: String,
    enabled: bool,
) -> Result<(), String> {
    // Check if it's a built-in pattern
    let builtins = get_builtin_patterns();
    let is_builtin = builtins.iter().any(|p| p.id == pattern_id);

    if is_builtin {
        // Update disabled_builtins list
        let mut disabled: Vec<String> = match get_setting(&db, KEY_DISABLED_BUILTINS)? {
            Some(json) => serde_json::from_str(&json).unwrap_or_default(),
            None => vec![],
        };
        if enabled {
            disabled.retain(|id| id != &pattern_id);
        } else if !disabled.contains(&pattern_id) {
            disabled.push(pattern_id);
        }
        let json = serde_json::to_string(&disabled)
            .map_err(|e| format!("Serialization error: {}", e))?;
        set_setting(&db, KEY_DISABLED_BUILTINS, &json)
    } else {
        // Update custom pattern's enabled field
        let mut custom: Vec<SensitivePattern> = match get_setting(&db, KEY_CUSTOM_PATTERNS)? {
            Some(json) => serde_json::from_str(&json).unwrap_or_default(),
            None => vec![],
        };
        if let Some(p) = custom.iter_mut().find(|p| p.id == pattern_id) {
            p.enabled = enabled;
        } else {
            return Err(format!("Pattern '{}' not found", pattern_id));
        }
        let json = serde_json::to_string(&custom)
            .map_err(|e| format!("Serialization error: {}", e))?;
        set_setting(&db, KEY_CUSTOM_PATTERNS, &json)
    }
}

/// Scan files for sensitive data (without redacting — for UI indicators)
#[tauri::command]
pub async fn scan_files_sensitive(
    db: tauri::State<'_, DbConnection>,
    file_paths: Vec<String>,
) -> Result<Vec<ScanResult>, String> {
    if !is_feature_enabled(&db)? {
        return Ok(vec![]);
    }

    let all_patterns = get_all_patterns_internal(&db)?;
    let compiled = compile_patterns(&all_patterns);

    let mut results = Vec::new();
    for path in &file_paths {
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let matches = detect_sensitive_data(&content, &compiled);
        let matched_ids: Vec<String> = {
            let mut seen = std::collections::HashSet::new();
            matches.iter()
                .filter(|m| seen.insert(m.pattern_id.clone()))
                .map(|m| m.pattern_id.clone())
                .collect()
        };

        results.push(ScanResult {
            path: path.clone(),
            has_sensitive_data: !matches.is_empty(),
            match_count: matches.len(),
            matched_patterns: matched_ids,
        });
    }

    Ok(results)
}

/// Validate a regex pattern string (for custom pattern form)
#[tauri::command]
pub async fn validate_regex_pattern(
    pattern: String,
) -> Result<bool, String> {
    match regex::Regex::new(&pattern) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Invalid regex: {}", e)),
    }
}

/// Test a pattern against sample input
#[tauri::command]
pub async fn test_pattern(
    pattern: String,
    test_input: String,
) -> Result<Vec<String>, String> {
    let regex = regex::Regex::new(&pattern)
        .map_err(|e| format!("Invalid regex: {}", e))?;

    let matches: Vec<String> = regex
        .find_iter(&test_input)
        .map(|m| m.as_str().to_string())
        .collect();

    Ok(matches)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::init_database;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

    fn setup_db() -> DbConnection {
        let conn = Connection::open_in_memory().unwrap();
        init_database(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[test]
    fn test_feature_disabled_by_default() {
        let db = setup_db();
        assert!(!is_feature_enabled(&db).unwrap());
    }

    #[test]
    fn test_toggle_feature() {
        let db = setup_db();
        set_setting(&db, KEY_ENABLED, "true").unwrap();
        assert!(is_feature_enabled(&db).unwrap());
        set_setting(&db, KEY_ENABLED, "false").unwrap();
        assert!(!is_feature_enabled(&db).unwrap());
    }

    #[test]
    fn test_get_all_patterns_includes_builtins() {
        let db = setup_db();
        let patterns = get_all_patterns_internal(&db).unwrap();
        assert!(patterns.iter().any(|p| p.builtin));
    }

    #[test]
    fn test_add_and_retrieve_custom_pattern() {
        let db = setup_db();
        let custom = SensitivePattern {
            id: "test_custom".into(),
            name: "Test".into(),
            pattern: r"\btest\b".into(),
            placeholder: "[TEST]".into(),
            enabled: true,
            builtin: false,
            category: "Custom".into(),
        };

        // Manually add (simulating the command)
        let json = serde_json::to_string(&vec![&custom]).unwrap();
        set_setting(&db, KEY_CUSTOM_PATTERNS, &json).unwrap();

        let all = get_all_patterns_internal(&db).unwrap();
        assert!(all.iter().any(|p| p.id == "test_custom"));
    }

    #[test]
    fn test_disable_builtin() {
        let db = setup_db();
        let disabled = vec!["email".to_string()];
        let json = serde_json::to_string(&disabled).unwrap();
        set_setting(&db, KEY_DISABLED_BUILTINS, &json).unwrap();

        let all = get_all_patterns_internal(&db).unwrap();
        let email = all.iter().find(|p| p.id == "email").unwrap();
        assert!(!email.enabled, "Email pattern should be disabled");
    }

    #[test]
    fn test_prevent_selection_disabled_by_default() {
        let db = setup_db();
        assert!(!is_prevent_selection_enabled(&db).unwrap());
    }

    #[test]
    fn test_validate_regex_valid() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let result = validate_regex_pattern(r"\d+".into()).await;
            assert!(result.is_ok());
        });
    }

    #[test]
    fn test_validate_regex_invalid() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let result = validate_regex_pattern(r"[invalid".into()).await;
            assert!(result.is_err());
        });
    }

    #[test]
    fn test_test_pattern_finds_matches() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let matches = test_pattern(r"\d+".into(), "abc 123 def 456".into()).await.unwrap();
            assert_eq!(matches, vec!["123", "456"]);
        });
    }

    #[test]
    fn test_test_pattern_no_matches() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let matches = test_pattern(r"\d+".into(), "abc def".into()).await.unwrap();
            assert!(matches.is_empty());
        });
    }
}
```

### Task 2.3: Register Commands

**In `src-tauri/src/commands/mod.rs`**, add:

```rust
pub mod sensitive;  // ← ADD THIS LINE

// And add re-exports:
pub use sensitive::{
    get_sensitive_patterns, get_sensitive_data_enabled, set_sensitive_data_enabled,
    get_prevent_selection, set_prevent_selection,
    add_custom_pattern, delete_custom_pattern, toggle_pattern_enabled,
    scan_files_sensitive, validate_regex_pattern, test_pattern,
};
```

**In `src-tauri/src/lib.rs`**, add new commands to the `generate_handler!` macro:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    commands::sensitive::get_sensitive_patterns,
    commands::sensitive::get_sensitive_data_enabled,
    commands::sensitive::set_sensitive_data_enabled,
    commands::sensitive::get_prevent_selection,
    commands::sensitive::set_prevent_selection,
    commands::sensitive::add_custom_pattern,
    commands::sensitive::delete_custom_pattern,
    commands::sensitive::toggle_pattern_enabled,
    commands::sensitive::scan_files_sensitive,
    commands::sensitive::validate_regex_pattern,
    commands::sensitive::test_pattern,
])
```

---

## 4. Phase 3: Backend — Integration with Prompt Building

### Task 3.1: Add Redaction to `build_prompt_from_files`

**File**: `src-tauri/src/commands/prompts.rs`

Modify `build_prompt_from_files` to apply redaction after reading file content:

```rust
// Add these imports at the top:
use crate::sensitive::detection::compile_patterns;
use crate::sensitive::redaction::redact_content;

// In build_prompt_from_files, after reading each file's content,
// add the redaction step:

#[tauri::command]
pub async fn build_prompt_from_files(
    request: BuildPromptRequest,
    db: tauri::State<'_, DbConnection>,
) -> Result<BuildPromptResponse, String> {
    // ... existing code to read files ...
    
    // ★ NEW: Load sensitive data settings and compile patterns
    let sensitive_enabled = {
        let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
        conn.query_row(
            "SELECT value FROM settings WHERE key = 'sensitive_data_enabled'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to check sensitive data setting: {}", e))?
        .map(|v| v == "true")
        .unwrap_or(false)
    };
    
    let compiled_patterns = if sensitive_enabled {
        // Load all patterns (built-in + custom with user preferences)
        let all_patterns = crate::commands::sensitive::get_all_patterns_internal_pub(&db)?;
        compile_patterns(&all_patterns)
    } else {
        vec![]
    };

    // In the file reading loop, after `read_file_content`:
    for file_path in &request.file_paths {
        // ... existing validation code ...
        
        match read_file_content(file_path) {
            Ok(content) => {
                // ★ NEW: Apply redaction if enabled
                let final_content = if sensitive_enabled && !compiled_patterns.is_empty() {
                    let result = redact_content(&content, &compiled_patterns);
                    if result.replacements > 0 {
                        log::info!("Redacted {} items in {}", result.replacements, file_path);
                    }
                    result.content
                } else {
                    content
                };
                
                total_chars += final_content.len();
                file_contents.push((file_path.clone(), final_content));
            }
            Err(e) => { /* ... existing error handling ... */ }
        }
    }
    
    // ... rest of existing code ...
}
```

> **Note**: You need to expose `get_all_patterns_internal` from `commands/sensitive.rs` as a `pub(crate)` function so `prompts.rs` can use it. Rename it or create a wrapper:
>
> ```rust
> pub(crate) fn get_all_patterns_internal_pub(db: &DbConnection) -> Result<Vec<SensitivePattern>, String> {
>     get_all_patterns_internal(db)
> }
> ```

### Task 3.2: Add Redaction Info to Response

Optionally extend `BuildPromptResponse` to include redaction stats:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct BuildPromptResponse {
    pub prompt: String,
    pub file_count: usize,
    pub total_chars: usize,
    pub redaction_count: usize,  // ← NEW: total redactions made across all files
}
```

Update the TypeScript type in `src/services/prompts.ts` accordingly:

```typescript
export interface BuildPromptResponse {
  prompt: string;
  file_count: number;
  total_chars: number;
  redaction_count: number;  // ← NEW
}
```

---

## 5. Phase 4: Frontend — Settings UI

### Task 4.1: Create Frontend Service

**File**: `src/services/sensitive.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface SensitivePattern {
  id: string;
  name: string;
  pattern: string;
  placeholder: string;
  enabled: boolean;
  builtin: boolean;
  category: string;
}

export interface ScanResult {
  path: string;
  has_sensitive_data: boolean;
  matched_patterns: string[];
  match_count: number;
}

export async function getSensitivePatterns(): Promise<SensitivePattern[]> {
  return invoke<SensitivePattern[]>('get_sensitive_patterns');
}

export async function getSensitiveDataEnabled(): Promise<boolean> {
  return invoke<boolean>('get_sensitive_data_enabled');
}

export async function setSensitiveDataEnabled(enabled: boolean): Promise<void> {
  return invoke('set_sensitive_data_enabled', { enabled });
}

export async function getPreventSelection(): Promise<boolean> {
  return invoke<boolean>('get_prevent_selection');
}

export async function setPreventSelection(enabled: boolean): Promise<void> {
  return invoke('set_prevent_selection', { enabled });
}

export async function addCustomPattern(pattern: SensitivePattern): Promise<void> {
  return invoke('add_custom_pattern', { pattern });
}

export async function deleteCustomPattern(patternId: string): Promise<void> {
  return invoke('delete_custom_pattern', { patternId });
}

export async function togglePatternEnabled(patternId: string, enabled: boolean): Promise<void> {
  return invoke('toggle_pattern_enabled', { patternId, enabled });
}

export async function scanFilesSensitive(filePaths: string[]): Promise<ScanResult[]> {
  return invoke<ScanResult[]>('scan_files_sensitive', { filePaths });
}

export async function validateRegexPattern(pattern: string): Promise<boolean> {
  return invoke<boolean>('validate_regex_pattern', { pattern });
}

export async function testPattern(pattern: string, testInput: string): Promise<string[]> {
  return invoke<string[]>('test_pattern', { pattern, testInput });
}
```

### Task 4.2: Create SensitiveDataSettings Component

**File**: `src/components/SensitiveDataSettings.tsx`

This is a standalone component that gets embedded in the existing `Settings.tsx`.

**UI Layout:**

```
┌─────────────────────────────────────────────────┐
│ 🛡️ Sensitive Data Protection                    │
│                                                  │
│ [✓] Enable Sensitive Data Protection            │
│     Auto-detect and redact sensitive info...     │
│                                                  │
│ [  ] Prevent Selection of Sensitive Files       │
│     Auto-unselect files containing detected...   │
│                                                  │
│ ─── Patterns ────────────────────────────        │
│                                                  │
│  API Keys & Secrets                              │
│  [✓] AWS Access Key                 [AWS_KEY]    │
│  [✓] GitHub Token                   [GITHUB...]  │
│  [✓] OpenAI API Key                [OPENAI_KEY] │
│  ...                                             │
│                                                  │
│  PII                                             │
│  [ ] Email Address                  [EMAIL]      │
│  [✓] SSN                           [SSN]        │
│  ...                                             │
│                                                  │
│  Custom                                          │
│  [✓] My Custom Pattern             [CUSTOM]  🗑  │
│                                                  │
│  ──── Add Custom Pattern ─────                   │
│  Name:     [________________]                    │
│  Regex:    [________________]                    │
│  Placeholder: [________________]                 │
│  Test:     [________________]                    │
│  Matches:  "match1", "match2"                    │
│  [ADD PATTERN]                                   │
│                                                  │
│  ──── Preview ─────                              │
│  Before: DB_URL=postgres://admin:pass@host/db    │
│  After:  DB_URL=[POSTGRES_CONNECTION_STRING]     │
└─────────────────────────────────────────────────┘
```

**Implementation details:**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  getSensitivePatterns,
  getSensitiveDataEnabled,
  setSensitiveDataEnabled,
  getPreventSelection,
  setPreventSelection,
  addCustomPattern,
  deleteCustomPattern,
  togglePatternEnabled,
  testPattern,
  SensitivePattern,
} from '@/services/sensitive';
import { useToast } from './ui/toast';
import { Shield, Plus, Trash2, Check, AlertTriangle } from 'lucide-react';

interface SensitiveDataSettingsProps {
  onSettingsChanged?: () => void;
}

export const SensitiveDataSettings: React.FC<SensitiveDataSettingsProps> = ({
  onSettingsChanged,
}) => {
  const [enabled, setEnabled] = useState(false);
  const [preventSelection, setPreventSelectionState] = useState(false);
  const [patterns, setPatterns] = useState<SensitivePattern[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom pattern form state
  const [newName, setNewName] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testResults, setTestResults] = useState<string[]>([]);
  const [regexError, setRegexError] = useState('');

  const { success, error: showError } = useToast();

  // Load all settings on mount
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [isEnabled, isPrevent, allPatterns] = await Promise.all([
        getSensitiveDataEnabled(),
        getPreventSelection(),
        getSensitivePatterns(),
      ]);
      setEnabled(isEnabled);
      setPreventSelectionState(isPrevent);
      setPatterns(allPatterns);
    } catch (err) {
      console.error('Failed to load sensitive data settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Toggle feature enabled
  const handleToggleEnabled = useCallback(async (newVal: boolean) => {
    try {
      await setSensitiveDataEnabled(newVal);
      setEnabled(newVal);
      onSettingsChanged?.();
    } catch (err) {
      showError(`Failed to toggle: ${err}`);
    }
  }, [showError, onSettingsChanged]);

  // Toggle prevent selection
  const handleTogglePrevent = useCallback(async (newVal: boolean) => {
    try {
      await setPreventSelection(newVal);
      setPreventSelectionState(newVal);
      onSettingsChanged?.();
    } catch (err) {
      showError(`Failed to toggle: ${err}`);
    }
  }, [showError, onSettingsChanged]);

  // Toggle individual pattern
  const handleTogglePattern = useCallback(async (patternId: string, newEnabled: boolean) => {
    try {
      await togglePatternEnabled(patternId, newEnabled);
      setPatterns(prev =>
        prev.map(p => p.id === patternId ? { ...p, enabled: newEnabled } : p)
      );
    } catch (err) {
      showError(`Failed: ${err}`);
    }
  }, [showError]);

  // Delete custom pattern
  const handleDeletePattern = useCallback(async (patternId: string) => {
    try {
      await deleteCustomPattern(patternId);
      setPatterns(prev => prev.filter(p => p.id !== patternId));
      success('Pattern deleted');
    } catch (err) {
      showError(`Failed: ${err}`);
    }
  }, [showError, success]);

  // Test regex against input
  const handleTestPattern = useCallback(async () => {
    if (!newPattern.trim()) return;
    setRegexError('');
    try {
      const matches = await testPattern(newPattern, testInput);
      setTestResults(matches);
    } catch (err) {
      setRegexError(String(err));
      setTestResults([]);
    }
  }, [newPattern, testInput]);

  // Add custom pattern
  const handleAddPattern = useCallback(async () => {
    if (!newName.trim() || !newPattern.trim() || !newPlaceholder.trim()) {
      showError('All fields are required');
      return;
    }
    const id = `custom_${newName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const placeholder = newPlaceholder.startsWith('[') ? newPlaceholder : `[${newPlaceholder}]`;
    
    try {
      const pattern: SensitivePattern = {
        id,
        name: newName,
        pattern: newPattern,
        placeholder,
        enabled: true,
        builtin: false,
        category: 'Custom',
      };
      await addCustomPattern(pattern);
      setPatterns(prev => [...prev, pattern]);
      setNewName('');
      setNewPattern('');
      setNewPlaceholder('');
      setTestInput('');
      setTestResults([]);
      success('Pattern added');
    } catch (err) {
      showError(`Failed: ${err}`);
    }
  }, [newName, newPattern, newPlaceholder, showError, success]);

  // Group patterns by category
  const grouped = patterns.reduce<Record<string, SensitivePattern[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  // ... render UI following the layout above ...
  // Use the same styling patterns as Settings.tsx:
  //   - bg-white/5, border-white/10, text-[11px], etc.
  //   - Checkbox pattern from Settings.tsx (sr-only + styled div)
  //   - Section headers: text-[10px] font-bold text-white/50 uppercase tracking-wider
};
```

### Task 4.3: Integrate into Settings.tsx

In `src/components/Settings.tsx`, import and render the new component:

```tsx
// At the top:
import { SensitiveDataSettings } from './SensitiveDataSettings';

// In the JSX, after the grid section and before the Save button:
{/* Sensitive Data Protection */}
<div className="border-t border-white/5 pt-6">
  <SensitiveDataSettings onSettingsChanged={() => {
    // Optionally trigger any global refresh
  }} />
</div>
```

> **Important**: The `SensitiveDataSettings` component manages its own save/load cycle — it saves immediately on toggle/add/delete (not through the main "Save Configuration" button). This is intentional because pattern changes should take effect immediately.

### Task 4.4: Frontend Tests

**File**: `tests/ui/components/SensitiveDataSettings.test.tsx`

Test coverage should include:
1. Renders loading state
2. Loads and displays patterns grouped by category
3. Toggle feature enabled/disabled calls backend
4. Toggle individual pattern calls backend
5. Add custom pattern form validation (empty fields, invalid regex)
6. Add custom pattern → appears in list
7. Delete custom pattern → removed from list
8. Test regex input → shows matches
9. Prevention toggle calls backend

Mock all `invoke` calls in `tests/ui/setup.ts` — add the new command names to the mock map.

---

## 6. Phase 5: Prevention Feature & UI Indicators

### Task 5.1: File Tree Integration — Sensitive Data Badge

Add a visual indicator (shield icon) to files that contain sensitive data.

**Where**: `src/components/FileTree/FileTreeRow.tsx` (or the underlying `FileTreeRowView`)

**How**:

1. After files are indexed (or when the tree is loaded), call `scan_files_sensitive` with the visible file paths
2. Store scan results in a `Map<string, ScanResult>` in the FileTree context or a dedicated context
3. Pass `hasSensitiveData: boolean` as a prop to `FileTreeRow`
4. Render a small shield icon (⚠️ or 🛡️) next to the filename when `hasSensitiveData` is true

**Performance consideration**: Don't scan all files at once. Scan visible files (from the flatTree virtual list) in batches. Debounce scanning when the tree changes.

### Task 5.2: Prevention — Auto-unselect Sensitive Files

When `prevent_selection` is enabled:

1. In `FileTreeRow`, if `hasSensitiveData && preventSelection`:
   - Hide or disable the checkbox (set `pointer-events-none opacity-30`)
   - Skip `toggleCheck` on click
2. In `toggleCheck` (FileTreeContext), before selecting a file:
   - If prevention is enabled, check if the file has sensitive data
   - If it does, skip selection and optionally show a toast
3. In `buildAndCopy` (PromptBuilder), as a safety net:
   - Re-scan selected files before building
   - Remove any sensitive files from the selection
   - Show a warning toast listing removed files

### Task 5.3: Scanning Architecture

**Option A (Recommended) — Lazy scan on demand:**
- Scan files when they become visible in the virtual list
- Cache results in a `Map` with file fingerprint as invalidation key
- Re-scan when settings change (patterns enabled/disabled)

**Option B — Scan on index completion:**
- After `index_folder` completes, scan all indexed files
- Store results in a Rust-side cache
- Pro: results available immediately
- Con: slower indexing, wasted work for never-viewed files

**Recommendation**: Option A. Create a custom hook:

```typescript
// src/hooks/useSensitiveScan.ts
import { useState, useCallback, useRef } from 'react';
import { scanFilesSensitive, ScanResult } from '@/services/sensitive';

export function useSensitiveScan() {
  const cache = useRef(new Map<string, ScanResult>());
  const [scanResults, setScanResults] = useState(new Map<string, ScanResult>());

  const scanFiles = useCallback(async (paths: string[]) => {
    // Filter out already-scanned paths
    const uncached = paths.filter(p => !cache.current.has(p));
    if (uncached.length === 0) return;

    const results = await scanFilesSensitive(uncached);
    for (const r of results) {
      cache.current.set(r.path, r);
    }
    setScanResults(new Map(cache.current));
  }, []);

  const clearCache = useCallback(() => {
    cache.current.clear();
    setScanResults(new Map());
  }, []);

  return { scanResults, scanFiles, clearCache };
}
```

### Task 5.4: Redaction Count in Footer

After `assemblePrompt` returns, if `redaction_count > 0`, show a small indicator in the Footer or as a toast:

```
"🛡️ 12 sensitive items redacted"
```

This gives users confidence that their data was protected.

---

## 7. Cross-cutting Concerns

### Error Handling

- Add `RegexError` variant to `AppError` in `src-tauri/src/error.rs`:
  ```rust
  #[error("Regex error: {0}")]
  Regex(#[from] regex::Error),
  ```

### Performance

- Pattern compilation is expensive. Cache compiled patterns in the Tauri state (e.g., as a `Mutex<Vec<CompiledPattern>>`) and invalidate when settings change.
- For large files (>100KB), consider timeout/cancellation.
- The `has_sensitive_data()` fast-check uses `is_match()` which short-circuits on first match.

### Testing Strategy

| Layer | Test Location | Framework |
|-------|--------------|-----------|
| Rust patterns | `src-tauri/src/sensitive/patterns.rs` | `cargo test` |
| Rust detection | `src-tauri/src/sensitive/detection.rs` | `cargo test` |
| Rust redaction | `src-tauri/src/sensitive/redaction.rs` | `cargo test` |
| Rust commands | `src-tauri/src/commands/sensitive.rs` | `cargo test` |
| Rust integration | `src-tauri/src/commands/prompts.rs` | `cargo test` |
| Frontend service | `tests/ui/services/sensitive.test.ts` | `vitest` |
| Frontend component | `tests/ui/components/SensitiveDataSettings.test.tsx` | `vitest + RTL` |
| Frontend hook | `tests/ui/hooks/useSensitiveScan.test.tsx` | `vitest + RTL` |

### Settings Export/Import Compatibility

The `export_settings` / `import_settings` commands serialize `AppSettings` struct. Since sensitive data settings are stored in the same `settings` table but under separate keys (not part of `AppSettings` struct), they **will not** be included in export/import by default.

**Decision**: This is acceptable for v1. Sensitive patterns should not be exported (they may contain user-specific patterns). If needed later, add a separate export for sensitive settings.

---

## 8. File Inventory

### New Files to Create

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src-tauri/src/sensitive/mod.rs` | Module declarations + shared types |
| 2 | `src-tauri/src/sensitive/patterns.rs` | Built-in pattern definitions |
| 3 | `src-tauri/src/sensitive/detection.rs` | Pattern matching engine |
| 4 | `src-tauri/src/sensitive/redaction.rs` | Content redaction logic |
| 5 | `src-tauri/src/commands/sensitive.rs` | Tauri commands (CRUD + scanning) |
| 6 | `src/services/sensitive.ts` | Frontend → backend bridge |
| 7 | `src/components/SensitiveDataSettings.tsx` | Settings UI component |
| 8 | `src/hooks/useSensitiveScan.ts` | Scan hook for file tree |
| 9 | `tests/ui/services/sensitive.test.ts` | Service tests |
| 10 | `tests/ui/components/SensitiveDataSettings.test.tsx` | Component tests |
| 11 | `tests/ui/hooks/useSensitiveScan.test.tsx` | Hook tests |

### Files to Modify

| # | File Path | Change |
|---|-----------|--------|
| 1 | `src-tauri/src/lib.rs` | Add `mod sensitive;` and register new commands |
| 2 | `src-tauri/src/commands/mod.rs` | Add `pub mod sensitive;` and re-exports |
| 3 | `src-tauri/src/commands/prompts.rs` | Add redaction step to `build_prompt_from_files` |
| 4 | `src-tauri/src/error.rs` | Add `Regex` error variant |
| 5 | `src/components/Settings.tsx` | Import and embed `SensitiveDataSettings` |
| 6 | `src/services/prompts.ts` | Add `redaction_count` to `BuildPromptResponse` |
| 7 | `src/components/FileTree/FileTreeRow.tsx` | Add sensitive data badge |
| 8 | `src/components/FileTree/FileTreeContext.tsx` | Add prevention logic to `toggleCheck` |
| 9 | `tests/ui/setup.ts` | Add mocks for new invoke commands |

### Dependency Changes

None required. The `regex` crate is already in `Cargo.toml`.

---

## Implementation Order (Recommended)

Follow this exact sequence. Each step references a plan.md task:

1. **Create `src-tauri/src/sensitive/` module** (mod.rs, types) → lightweight, no tests yet
2. **Write tests for patterns** → `patterns.rs` tests
3. **Implement patterns** → `patterns.rs`
4. **Write tests for detection** → `detection.rs` tests
5. **Implement detection** → `detection.rs`
6. **Write tests for redaction** → `redaction.rs` tests
7. **Implement redaction** → `redaction.rs`
8. **Run `cargo test`** — all should pass
9. **Write tests for commands** → `commands/sensitive.rs` tests
10. **Implement commands** → `commands/sensitive.rs`
11. **Register commands** → `lib.rs`, `commands/mod.rs`
12. **Write tests for prompt integration** → modify `prompts.rs` tests
13. **Integrate redaction into `build_prompt_from_files`** → `prompts.rs`
14. **Run `cargo test`** — all should pass
15. **Create frontend service** → `src/services/sensitive.ts`
16. **Write frontend service tests** → `tests/ui/services/sensitive.test.ts`
17. **Create Settings component** → `SensitiveDataSettings.tsx`
18. **Write component tests** → `tests/ui/components/SensitiveDataSettings.test.tsx`
19. **Integrate into Settings.tsx**
20. **Run `npx vitest run`** — all should pass
21. **Create scan hook** → `useSensitiveScan.ts`
22. **Add file tree badge** → `FileTreeRow.tsx`
23. **Add prevention logic** → `FileTreeContext.tsx`
24. **Final integration testing** — `npm run tauri dev` and manually verify
