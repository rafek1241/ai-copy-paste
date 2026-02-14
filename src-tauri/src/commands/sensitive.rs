use crate::db::DbConnection;
use crate::sensitive::patterns::get_builtin_patterns;
use crate::sensitive::detection::{compile_patterns, detect_sensitive_data, has_sensitive_data};
use crate::sensitive::redaction::redact_content;
use crate::sensitive::{SensitivePattern, ScanResult, RedactionResult};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const KEY_ENABLED: &str = "sensitive_data_enabled";
const KEY_PREVENT: &str = "sensitive_prevent_selection";
const KEY_CUSTOM_PATTERNS: &str = "sensitive_custom_patterns";
const KEY_DISABLED_BUILTINS: &str = "sensitive_disabled_builtins";

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

pub(crate) fn get_all_patterns_internal(db: &DbConnection) -> Result<Vec<SensitivePattern>, String> {
    let custom_patterns: Vec<SensitivePattern> = match get_setting(db, KEY_CUSTOM_PATTERNS)? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => vec![],
    };

    let disabled_builtins: Vec<String> = match get_setting(db, KEY_DISABLED_BUILTINS)? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => vec![],
    };
    let disabled_set: HashSet<&str> = disabled_builtins.iter().map(|s| s.as_str()).collect();

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
        .unwrap_or(false))
}

fn is_prevent_selection_enabled(db: &DbConnection) -> Result<bool, String> {
    Ok(get_setting(db, KEY_PREVENT)?
        .map(|v| v == "true")
        .unwrap_or(false))
}

#[tauri::command]
pub async fn get_sensitive_patterns(
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<SensitivePattern>, String> {
    get_all_patterns_internal(&db)
}

#[tauri::command]
pub async fn get_sensitive_data_enabled(
    db: tauri::State<'_, DbConnection>,
) -> Result<bool, String> {
    is_feature_enabled(&db)
}

#[tauri::command]
pub async fn set_sensitive_data_enabled(
    db: tauri::State<'_, DbConnection>,
    enabled: bool,
) -> Result<(), String> {
    set_setting(&db, KEY_ENABLED, &enabled.to_string())
}

#[tauri::command]
pub async fn get_prevent_selection(
    db: tauri::State<'_, DbConnection>,
) -> Result<bool, String> {
    is_prevent_selection_enabled(&db)
}

#[tauri::command]
pub async fn set_prevent_selection(
    db: tauri::State<'_, DbConnection>,
    enabled: bool,
) -> Result<(), String> {
    set_setting(&db, KEY_PREVENT, &enabled.to_string())
}

#[tauri::command]
pub async fn add_custom_pattern(
    db: tauri::State<'_, DbConnection>,
    pattern: SensitivePattern,
) -> Result<(), String> {
    regex::Regex::new(&pattern.pattern)
        .map_err(|e| format!("Invalid regex pattern: {}", e))?;

    let mut custom: Vec<SensitivePattern> = match get_setting(&db, KEY_CUSTOM_PATTERNS)? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => vec![],
    };

    if custom.iter().any(|p| p.id == pattern.id) {
        return Err(format!("Pattern with id '{}' already exists", pattern.id));
    }

    custom.push(SensitivePattern { builtin: false, ..pattern });
    let json = serde_json::to_string(&custom)
        .map_err(|e| format!("Serialization error: {}", e))?;
    set_setting(&db, KEY_CUSTOM_PATTERNS, &json)
}

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

#[tauri::command]
pub async fn toggle_pattern_enabled(
    db: tauri::State<'_, DbConnection>,
    pattern_id: String,
    enabled: bool,
) -> Result<(), String> {
    let builtins = get_builtin_patterns();
    let is_builtin = builtins.iter().any(|p| p.id == pattern_id);

    if is_builtin {
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
            let mut seen = HashSet::new();
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

#[tauri::command]
pub async fn validate_regex_pattern(
    pattern: String,
) -> Result<bool, String> {
    match regex::Regex::new(&pattern) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Invalid regex: {}", e)),
    }
}

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

        let json = serde_json::to_string(&vec![custom.clone()]).unwrap();
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

    #[test]
    fn test_toggle_enables_disables_all_redaction() {
        let db = setup_db();
        set_setting(&db, KEY_ENABLED, "true").unwrap();
        assert!(is_feature_enabled(&db).unwrap());
        
        set_setting(&db, KEY_ENABLED, "false").unwrap();
        assert!(!is_feature_enabled(&db).unwrap());
    }

    #[test]
    fn test_setting_persists() {
        let db = setup_db();
        set_setting(&db, KEY_ENABLED, "true").unwrap();
        
        let value = get_setting(&db, KEY_ENABLED).unwrap();
        assert_eq!(value, Some("true".to_string()));
    }

    #[test]
    fn test_delete_custom_pattern() {
        let db = setup_db();
        let custom = vec![SensitivePattern {
            id: "test_custom".into(),
            name: "Test".into(),
            pattern: r"\btest\b".into(),
            placeholder: "[TEST]".into(),
            enabled: true,
            builtin: false,
            category: "Custom".into(),
        }];
        let json = serde_json::to_string(&custom).unwrap();
        set_setting(&db, KEY_CUSTOM_PATTERNS, &json).unwrap();

        let all = get_all_patterns_internal(&db).unwrap();
        assert!(all.iter().any(|p| p.id == "test_custom"));

        let mut updated: Vec<SensitivePattern> = serde_json::from_str(&get_setting(&db, KEY_CUSTOM_PATTERNS).unwrap().unwrap()).unwrap();
        updated.retain(|p| p.id != "test_custom");
        let json = serde_json::to_string(&updated).unwrap();
        set_setting(&db, KEY_CUSTOM_PATTERNS, &json).unwrap();

        let all = get_all_patterns_internal(&db).unwrap();
        assert!(!all.iter().any(|p| p.id == "test_custom" && !p.builtin));
    }

    #[test]
    fn test_toggle_custom_pattern_enabled() {
        let db = setup_db();
        let custom = vec![SensitivePattern {
            id: "test_custom".into(),
            name: "Test".into(),
            pattern: r"\btest\b".into(),
            placeholder: "[TEST]".into(),
            enabled: true,
            builtin: false,
            category: "Custom".into(),
        }];
        let json = serde_json::to_string(&custom).unwrap();
        set_setting(&db, KEY_CUSTOM_PATTERNS, &json).unwrap();

        let all = get_all_patterns_internal(&db).unwrap();
        let test_pattern = all.iter().find(|p| p.id == "test_custom").unwrap();
        assert!(test_pattern.enabled);

        let mut updated: Vec<SensitivePattern> = serde_json::from_str(&get_setting(&db, KEY_CUSTOM_PATTERNS).unwrap().unwrap()).unwrap();
        if let Some(p) = updated.iter_mut().find(|p| p.id == "test_custom") {
            p.enabled = false;
        }
        let json = serde_json::to_string(&updated).unwrap();
        set_setting(&db, KEY_CUSTOM_PATTERNS, &json).unwrap();

        let all = get_all_patterns_internal(&db).unwrap();
        let test_pattern = all.iter().find(|p| p.id == "test_custom").unwrap();
        assert!(!test_pattern.enabled);
    }

    #[test]
    fn test_invalid_regex_handling() {
        let pattern = SensitivePattern {
            id: "bad_pattern".into(),
            name: "Bad".into(),
            pattern: r"[invalid(".into(),
            placeholder: "[BAD]".into(),
            enabled: true,
            builtin: false,
            category: "Custom".into(),
        };
        
        let result = regex::Regex::new(&pattern.pattern);
        assert!(result.is_err());
    }
}
