use crate::db::DbConnection;
use crate::sensitive::patterns::get_builtin_patterns;
use crate::sensitive::detection::{compile_patterns, detect_sensitive_data};
use crate::sensitive::{SensitivePattern, ScanResult};
use rusqlite::{params, OptionalExtension};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

const KEY_ENABLED: &str = "sensitive_data_enabled";
const KEY_PREVENT: &str = "sensitive_prevent_selection";
const KEY_CUSTOM_PATTERNS: &str = "sensitive_custom_patterns";
const KEY_BUILTIN_OVERRIDES: &str = "sensitive_builtin_overrides";

#[derive(Debug, Clone)]
struct SensitivePathMark {
    path: String,
    is_sensitive_file: bool,
    matched_patterns: Vec<String>,
    match_count: usize,
}

fn normalize_path(path: &str) -> String {
    let normalized = path.replace('\\', "/");

    if normalized.len() >= 2 && normalized.as_bytes()[1] == b':' {
        return normalized.to_ascii_lowercase();
    }

    if normalized.starts_with("//") {
        return normalized.to_ascii_lowercase();
    }

    normalized
}

pub(crate) fn normalize_path_for_sensitive(path: &str) -> String {
    normalize_path(path)
}

fn get_parent_path(path: &str) -> Option<String> {
    let normalized = normalize_path(path);
    let last_slash = normalized.rfind('/')?;
    if last_slash == 0 {
        return None;
    }

    let parent = normalized[..last_slash].to_string();
    if parent.is_empty() {
        None
    } else {
        Some(parent)
    }
}

fn get_indexed_file_paths_internal(db: &DbConnection) -> Result<Vec<String>, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let mut stmt = conn
        .prepare("SELECT path FROM files WHERE is_dir = 0")
        .map_err(|e| format!("Failed to prepare indexed file query: {}", e))?;

    let paths = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query indexed files: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect indexed files: {}", e))?;

    Ok(paths)
}

fn get_indexed_dir_paths_internal(db: &DbConnection) -> Result<HashSet<String>, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let mut stmt = conn
        .prepare("SELECT path FROM files WHERE is_dir = 1")
        .map_err(|e| format!("Failed to prepare indexed directory query: {}", e))?;

    let paths = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query indexed directories: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect indexed directories: {}", e))?;

    Ok(paths.into_iter().map(|path| normalize_path(&path)).collect())
}

fn clear_sensitive_marks_internal(db: &DbConnection) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    conn.execute("DELETE FROM sensitive_paths", [])
        .map_err(|e| format!("Failed to clear sensitive path marks: {}", e))?;
    Ok(())
}

fn persist_sensitive_marks_internal(
    db: &DbConnection,
    marks: &[SensitivePathMark],
) -> Result<(), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to resolve timestamp: {}", e))?
        .as_secs() as i64;

    let mut conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start sensitive mark transaction: {}", e))?;

    tx.execute("DELETE FROM sensitive_paths", [])
        .map_err(|e| format!("Failed to clear existing sensitive marks: {}", e))?;

    for mark in marks {
        let matched_patterns = serde_json::to_string(&mark.matched_patterns)
            .map_err(|e| format!("Failed to serialize matched patterns: {}", e))?;

        tx.execute(
            "INSERT INTO sensitive_paths (path, is_sensitive_file, matched_patterns, match_count, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &mark.path,
                if mark.is_sensitive_file { 1 } else { 0 },
                matched_patterns,
                mark.match_count as i64,
                timestamp,
            ],
        )
        .map_err(|e| format!("Failed to persist sensitive mark for '{}': {}", mark.path, e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit sensitive mark transaction: {}", e))?;

    Ok(())
}

fn build_sensitive_marks_internal(db: &DbConnection) -> Result<Vec<SensitivePathMark>, String> {
    let all_patterns = get_all_patterns_internal(db)?;
    let compiled = compile_patterns(&all_patterns);

    if compiled.is_empty() {
        return Ok(vec![]);
    }

    let indexed_file_paths = get_indexed_file_paths_internal(db)?;
    if indexed_file_paths.is_empty() {
        return Ok(vec![]);
    }

    let indexed_dir_paths = get_indexed_dir_paths_internal(db)?;
    let mut marks = Vec::new();
    let mut marked_paths = HashSet::new();

    for path in indexed_file_paths {
        let content = match std::fs::read_to_string(&path) {
            Ok(content) => content,
            Err(_) => continue,
        };

        let matches = detect_sensitive_data(&content, &compiled);
        if matches.is_empty() {
            continue;
        }

        let matched_ids: Vec<String> = {
            let mut seen = HashSet::new();
            matches
                .iter()
                .filter(|m| seen.insert(m.pattern_id.clone()))
                .map(|m| m.pattern_id.clone())
                .collect()
        };

        let normalized_path = normalize_path(&path);

        if marked_paths.insert(normalized_path.clone()) {
            marks.push(SensitivePathMark {
                path: normalized_path.clone(),
                is_sensitive_file: true,
                matched_patterns: matched_ids,
                match_count: matches.len(),
            });
        }

        let mut parent_path = get_parent_path(&normalized_path);
        while let Some(parent) = parent_path {
            if indexed_dir_paths.contains(&parent) && marked_paths.insert(parent.clone()) {
                marks.push(SensitivePathMark {
                    path: parent.clone(),
                    is_sensitive_file: false,
                    matched_patterns: vec![],
                    match_count: 0,
                });
            }
            parent_path = get_parent_path(&parent);
        }
    }

    Ok(marks)
}

pub(crate) fn reprocess_sensitive_marks_if_enabled(db: &DbConnection) -> Result<(), String> {
    if !is_feature_enabled(db)? {
        clear_sensitive_marks_internal(db)?;
        return Ok(());
    }

    let marks = build_sensitive_marks_internal(db)?;
    persist_sensitive_marks_internal(db, &marks)
}

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

    let overrides: std::collections::HashMap<String, bool> = match get_setting(db, KEY_BUILTIN_OVERRIDES)? {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => std::collections::HashMap::new(),
    };

    let mut all_patterns: Vec<SensitivePattern> = get_builtin_patterns()
        .into_iter()
        .map(|mut p| {
            if let Some(&enabled_override) = overrides.get(&p.id) {
                p.enabled = enabled_override;
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

fn set_prevent_selection_internal(db: &DbConnection, enabled: bool) -> Result<(), String> {
    if enabled && !is_feature_enabled(db)? {
        return Err("Sensitive data protection must be enabled before enabling prevent selection".to_string());
    }

    set_setting(db, KEY_PREVENT, &enabled.to_string())
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
    set_setting(&db, KEY_ENABLED, &enabled.to_string())?;

    if enabled {
        reprocess_sensitive_marks_if_enabled(&db)?;
    } else {
        clear_sensitive_marks_internal(&db)?;
    }

    Ok(())
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
    set_prevent_selection_internal(&db, enabled)
}

pub(crate) fn get_sensitive_marked_paths_internal(
    db: &DbConnection,
    paths: &[String],
) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Ok(vec![]);
    }

    if !is_feature_enabled(db)? {
        return Ok(vec![]);
    }

    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let mut marked_paths = Vec::new();

    for path in paths {
        let normalized_path = normalize_path(path);
        let is_marked = conn
            .query_row(
                "SELECT 1 FROM sensitive_paths WHERE path = ?1",
                params![&normalized_path],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if is_marked {
            marked_paths.push(normalized_path);
        }
    }

    Ok(marked_paths)
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
    set_setting(&db, KEY_CUSTOM_PATTERNS, &json)?;

    reprocess_sensitive_marks_if_enabled(&db)?;
    Ok(())
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
    set_setting(&db, KEY_CUSTOM_PATTERNS, &json)?;

    reprocess_sensitive_marks_if_enabled(&db)?;
    Ok(())
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
        let mut overrides: std::collections::HashMap<String, bool> = match get_setting(&db, KEY_BUILTIN_OVERRIDES)? {
            Some(json) => serde_json::from_str(&json).unwrap_or_default(),
            None => std::collections::HashMap::new(),
        };
        
        let default_pattern = builtins.iter().find(|p| p.id == pattern_id).unwrap();
        if enabled == default_pattern.enabled {
            overrides.remove(&pattern_id);
        } else {
            overrides.insert(pattern_id, enabled);
        }
        
        let json = serde_json::to_string(&overrides)
            .map_err(|e| format!("Serialization error: {}", e))?;
        set_setting(&db, KEY_BUILTIN_OVERRIDES, &json)?;
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
        set_setting(&db, KEY_CUSTOM_PATTERNS, &json)?;
    }

    reprocess_sensitive_marks_if_enabled(&db)?;
    Ok(())
}

#[tauri::command]
pub async fn get_sensitive_marked_paths(
    db: tauri::State<'_, DbConnection>,
    paths: Vec<String>,
) -> Result<Vec<String>, String> {
    get_sensitive_marked_paths_internal(&db, &paths)
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
        let mut overrides: std::collections::HashMap<String, bool> = std::collections::HashMap::new();
        overrides.insert("email".to_string(), false);
        let json = serde_json::to_string(&overrides).unwrap();
        set_setting(&db, KEY_BUILTIN_OVERRIDES, &json).unwrap();

        let all = get_all_patterns_internal(&db).unwrap();
        let email = all.iter().find(|p| p.id == "email").unwrap();
        assert!(!email.enabled, "Email pattern should be disabled");
    }

    #[test]
    fn test_enable_default_disabled_builtin() {
        let db = setup_db();
        
        let all = get_all_patterns_internal(&db).unwrap();
        let email = all.iter().find(|p| p.id == "email").unwrap();
        assert!(!email.enabled, "Email pattern should be disabled by default");
        
        let mut overrides: std::collections::HashMap<String, bool> = std::collections::HashMap::new();
        overrides.insert("email".to_string(), true);
        let json = serde_json::to_string(&overrides).unwrap();
        set_setting(&db, KEY_BUILTIN_OVERRIDES, &json).unwrap();

        let all = get_all_patterns_internal(&db).unwrap();
        let email = all.iter().find(|p| p.id == "email").unwrap();
        assert!(email.enabled, "Email pattern should now be enabled");
    }

    #[test]
    fn test_prevent_selection_disabled_by_default() {
        let db = setup_db();
        assert!(!is_prevent_selection_enabled(&db).unwrap());
    }

    #[test]
    fn test_set_prevent_selection_requires_sensitive_enabled() {
        let db = setup_db();
        let result = set_prevent_selection_internal(&db, true);
        assert!(result.is_err());
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
