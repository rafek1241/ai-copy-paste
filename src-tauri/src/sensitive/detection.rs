use super::SensitivePattern;
use regex::Regex;
use std::collections::HashMap;

pub struct CompiledPattern {
    pub pattern: SensitivePattern,
    pub regex: Regex,
}

pub fn compile_patterns(patterns: &[SensitivePattern]) -> Vec<CompiledPattern> {
    patterns
        .iter()
        .filter(|p| p.enabled)
        .filter_map(|p| match Regex::new(&p.pattern) {
            Ok(regex) => Some(CompiledPattern {
                pattern: p.clone(),
                regex,
            }),
            Err(e) => {
                log::warn!("Invalid regex for pattern '{}': {}", p.id, e);
                None
            }
        })
        .collect()
}

#[derive(Debug, Clone)]
pub struct DetectionMatch {
    pub pattern_id: String,
    pub matched_text: String,
    pub start: usize,
    pub end: usize,
}

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

    matches.sort_by_key(|m| m.start);
    matches
}

pub fn has_sensitive_data(content: &str, compiled_patterns: &[CompiledPattern]) -> bool {
    compiled_patterns
        .iter()
        .any(|cp| cp.regex.is_match(content))
}

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
    fn test_detect_openai_key() {
        let compiled = compile_all();
        let content = "OPENAI_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCD";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "openai_key"));
    }

    #[test]
    fn test_detect_email() {
        let compiled = compile_all();
        let content = "contact us at admin@example.com for support";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "email"));
    }

    #[test]
    fn test_detect_ssn() {
        let compiled = compile_all();
        let content = "SSN: 123-45-6789";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "ssn"));
    }

    #[test]
    fn test_detect_credit_card() {
        let compiled = compile_all();
        let content = "Card: 4111111111111111";
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "credit_card"));
    }

    #[test]
    fn test_detect_mysql_connection_string() {
        let compiled = compile_all();
        let content = r#"DATABASE_URL=mysql://user:pass@localhost:3306/mydb"#;
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "mysql_conn"));
    }

    #[test]
    fn test_detect_postgres_connection_string() {
        let compiled = compile_all();
        let content = r#"DATABASE_URL=postgresql://user:pass@localhost:5432/mydb"#;
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "postgres_conn"));
    }

    #[test]
    fn test_detect_mongodb_connection_string() {
        let compiled = compile_all();
        let content = r#"MONGO_URI=mongodb://admin:secret@cluster.mongodb.net/db"#;
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "mongodb_conn"));
    }

    #[test]
    fn test_detect_redis_connection_string() {
        let compiled = compile_all();
        let content = r#"REDIS_URL=redis://:password@localhost:6379/0"#;
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "redis_conn"));
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
    fn test_detect_password_in_config() {
        let compiled = compile_all();
        let content = r#"password = "super_secret_123""#;
        let matches = detect_sensitive_data(content, &compiled);
        assert!(matches.iter().any(|m| m.pattern_id == "password_field"));
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
            API_KEY=sk-proj-test1234567890abcdefghijklmnopqrstuvwxyz1234567890ABCD
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
        for p in &mut patterns {
            p.enabled = false;
        }
        let compiled = compile_patterns(&patterns);
        assert!(
            compiled.is_empty(),
            "No patterns should be compiled when all disabled"
        );
    }

    #[test]
    fn test_invalid_regex_skipped() {
        let patterns = vec![SensitivePattern {
            id: "bad".into(),
            name: "Bad Pattern".into(),
            pattern: r"[invalid".into(),
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
            assert!(
                window[0].start <= window[1].start,
                "Matches should be sorted by position"
            );
        }
    }
}
