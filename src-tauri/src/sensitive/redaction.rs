use super::detection::{compile_patterns, detect_sensitive_data, CompiledPattern, DetectionMatch};
use super::{RedactionResult, SensitivePattern};
use std::collections::HashMap;

pub fn redact_content(content: &str, compiled_patterns: &[CompiledPattern]) -> RedactionResult {
    let matches = detect_sensitive_data(content, compiled_patterns);

    if matches.is_empty() {
        return RedactionResult {
            content: content.to_string(),
            replacements: 0,
            applied_patterns: vec![],
        };
    }

    let placeholder_map: HashMap<&str, &str> = compiled_patterns
        .iter()
        .map(|cp| (cp.pattern.id.as_str(), cp.pattern.placeholder.as_str()))
        .collect();

    let non_overlapping = remove_overlapping_matches(&matches);

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
    }

    result
}

pub fn redact_with_patterns(content: &str, patterns: &[SensitivePattern]) -> RedactionResult {
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
        let content = "auth: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234";
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
            DetectionMatch {
                pattern_id: "a".into(),
                matched_text: "abc".into(),
                start: 0,
                end: 3,
            },
            DetectionMatch {
                pattern_id: "b".into(),
                matched_text: "bc".into(),
                start: 1,
                end: 3,
            },
            DetectionMatch {
                pattern_id: "c".into(),
                matched_text: "def".into(),
                start: 5,
                end: 8,
            },
        ];
        let result = remove_overlapping_matches(&matches);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].pattern_id, "a");
        assert_eq!(result[1].pattern_id, "c");
    }
}
