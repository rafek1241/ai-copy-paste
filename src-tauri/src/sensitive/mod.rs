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
