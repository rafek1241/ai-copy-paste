use crate::db::DbConnection;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub excluded_extensions: Vec<String>,
    pub token_limit: i64,
    pub default_template: String,
    pub auto_save_history: bool,
    pub cache_size_mb: i64,
    pub respect_gitignore: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            excluded_extensions: vec![
                ".exe".to_string(),
                ".dll".to_string(),
                ".so".to_string(),
                ".dylib".to_string(),
                ".bin".to_string(),
                ".jpg".to_string(),
                ".png".to_string(),
                ".gif".to_string(),
                ".ico".to_string(),
                ".zip".to_string(),
                ".tar".to_string(),
                ".gz".to_string(),
            ],
            token_limit: 200000,
            default_template: "agent".to_string(),
            auto_save_history: true,
            cache_size_mb: 100,
            respect_gitignore: true,
        }
    }
}

/// Internal function to save a setting
fn save_setting_internal(db: &DbConnection, key: &str, value: &str) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| format!("Failed to save setting: {}", e))?;

    Ok(())
}

/// Save a setting to the database
#[tauri::command]
pub async fn save_setting(
    db: tauri::State<'_, DbConnection>,
    key: String,
    value: String,
) -> Result<(), String> {
    save_setting_internal(&db, &key, &value)
}

/// Internal function to get a setting
fn get_setting_internal(db: &DbConnection, key: &str) -> Result<Option<String>, String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let result = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to get setting: {}", e))?;

    Ok(result)
}

/// Get a setting from the database
#[tauri::command]
pub async fn get_setting(
    db: tauri::State<'_, DbConnection>,
    key: String,
) -> Result<Option<String>, String> {
    get_setting_internal(&db, &key)
}

/// Internal function to get all settings
fn get_all_settings_internal(db: &DbConnection) -> Result<HashMap<String, String>, String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let settings = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to query settings: {}", e))?
        .collect::<Result<HashMap<_, _>, _>>()
        .map_err(|e| format!("Failed to collect settings: {}", e))?;

    Ok(settings)
}

/// Get all settings as a HashMap
#[tauri::command]
pub async fn get_all_settings(
    db: tauri::State<'_, DbConnection>,
) -> Result<HashMap<String, String>, String> {
    get_all_settings_internal(&db)
}

/// Internal function to load settings
pub(crate) fn load_settings_internal(db: &DbConnection) -> Result<AppSettings, String> {
    let settings_map = get_all_settings_internal(db)?;

    let mut settings = AppSettings::default();

    // Parse excluded_extensions
    if let Some(excluded_ext) = settings_map.get("excluded_extensions") {
        if let Ok(ext_list) = serde_json::from_str::<Vec<String>>(excluded_ext) {
            settings.excluded_extensions = ext_list;
        }
    }

    // Parse token_limit
    if let Some(token_limit) = settings_map.get("token_limit") {
        if let Ok(limit) = token_limit.parse::<i64>() {
            settings.token_limit = limit;
        }
    }

    // Parse default_template
    if let Some(template) = settings_map.get("default_template") {
        settings.default_template = template.clone();
    }

    // Parse auto_save_history
    if let Some(auto_save) = settings_map.get("auto_save_history") {
        if let Ok(auto_save_bool) = auto_save.parse::<bool>() {
            settings.auto_save_history = auto_save_bool;
        }
    }

    // Parse cache_size_mb
    if let Some(cache_size) = settings_map.get("cache_size_mb") {
        if let Ok(size) = cache_size.parse::<i64>() {
            settings.cache_size_mb = size;
        }
    }

    // Parse respect_gitignore
    if let Some(respect_gitignore) = settings_map.get("respect_gitignore") {
        if let Ok(respect_gitignore_bool) = respect_gitignore.parse::<bool>() {
            settings.respect_gitignore = respect_gitignore_bool;
        }
    }

    Ok(settings)
}

/// Load application settings with defaults
#[tauri::command]
pub async fn load_settings(db: tauri::State<'_, DbConnection>) -> Result<AppSettings, String> {
    load_settings_internal(&db)
}

/// Internal function to save settings
fn save_settings_internal(db: &DbConnection, settings: &AppSettings) -> Result<(), String> {
    // Serialize and save each setting
    let excluded_ext_json = serde_json::to_string(&settings.excluded_extensions)
        .map_err(|e| format!("Failed to serialize excluded_extensions: {}", e))?;

    save_setting_internal(db, "excluded_extensions", &excluded_ext_json)?;
    save_setting_internal(db, "token_limit", &settings.token_limit.to_string())?;
    save_setting_internal(db, "default_template", &settings.default_template)?;
    save_setting_internal(db, "auto_save_history", &settings.auto_save_history.to_string())?;
    save_setting_internal(db, "cache_size_mb", &settings.cache_size_mb.to_string())?;
    save_setting_internal(db, "respect_gitignore", &settings.respect_gitignore.to_string())?;

    Ok(())
}

/// Save application settings
#[tauri::command]
pub async fn save_settings(
    db: tauri::State<'_, DbConnection>,
    settings: AppSettings,
) -> Result<(), String> {
    save_settings_internal(&db, &settings)
}

/// Internal function to export settings
fn export_settings_internal(db: &DbConnection) -> Result<String, String> {
    let settings = load_settings_internal(db)?;
    serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to export settings: {}", e))
}

/// Export all settings as JSON
#[tauri::command]
pub async fn export_settings(db: tauri::State<'_, DbConnection>) -> Result<String, String> {
    export_settings_internal(&db)
}

/// Internal function to import settings
fn import_settings_internal(db: &DbConnection, json_data: &str) -> Result<(), String> {
    let settings: AppSettings =
        serde_json::from_str(json_data).map_err(|e| format!("Failed to parse settings: {}", e))?;

    save_settings_internal(db, &settings)?;

    Ok(())
}

/// Import settings from JSON
#[tauri::command]
pub async fn import_settings(
    db: tauri::State<'_, DbConnection>,
    json_data: String,
) -> Result<(), String> {
    import_settings_internal(&db, &json_data)
}

/// Internal function to delete a setting
fn delete_setting_internal(db: &DbConnection, key: &str) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])
        .map_err(|e| format!("Failed to delete setting: {}", e))?;

    Ok(())
}

/// Delete a setting from the database
#[tauri::command]
pub async fn delete_setting(db: tauri::State<'_, DbConnection>, key: String) -> Result<(), String> {
    delete_setting_internal(&db, &key)
}

/// Internal function to reset settings
fn reset_settings_internal(db: &DbConnection) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute("DELETE FROM settings", [])
        .map_err(|e| format!("Failed to reset settings: {}", e))?;

    Ok(())
}

/// Reset all settings to defaults
#[tauri::command]
pub async fn reset_settings(db: tauri::State<'_, DbConnection>) -> Result<(), String> {
    reset_settings_internal(&db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::init_database;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

    fn setup_test_db() -> DbConnection {
        let conn = Connection::open_in_memory().unwrap();
        init_database(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[test]
    fn test_save_and_get_setting() {
        let db = setup_test_db();

        save_setting_internal(&db, "test_key", "test_value").unwrap();

        let value = get_setting_internal(&db, "test_key").unwrap();
        assert_eq!(value, Some("test_value".to_string()));
    }

    #[test]
    fn test_get_all_settings() {
        let db = setup_test_db();

        save_setting_internal(&db, "key1", "value1").unwrap();
        save_setting_internal(&db, "key2", "value2").unwrap();

        let settings = get_all_settings_internal(&db).unwrap();
        assert_eq!(settings.len(), 2);
        assert_eq!(settings.get("key1"), Some(&"value1".to_string()));
        assert_eq!(settings.get("key2"), Some(&"value2".to_string()));
    }

    #[test]
    fn test_save_and_load_settings() {
        let db = setup_test_db();

        let settings = AppSettings {
            excluded_extensions: vec![".test".to_string()],
            token_limit: 100000,
            default_template: "test".to_string(),
            auto_save_history: false,
            cache_size_mb: 50,
            respect_gitignore: false,
        };

        save_settings_internal(&db, &settings).unwrap();

        let loaded = load_settings_internal(&db).unwrap();
        assert_eq!(loaded.excluded_extensions, settings.excluded_extensions);
        assert_eq!(loaded.token_limit, settings.token_limit);
        assert_eq!(loaded.default_template, settings.default_template);
        assert_eq!(loaded.auto_save_history, settings.auto_save_history);
        assert_eq!(loaded.cache_size_mb, settings.cache_size_mb);
        assert_eq!(loaded.respect_gitignore, settings.respect_gitignore);
    }

    #[test]
    fn test_export_import_settings() {
        let db = setup_test_db();

        let settings = AppSettings {
            excluded_extensions: vec![".test".to_string()],
            token_limit: 100000,
            default_template: "test".to_string(),
            auto_save_history: false,
            cache_size_mb: 50,
            respect_gitignore: false,
        };

        save_settings_internal(&db, &settings).unwrap();

        let exported = export_settings_internal(&db).unwrap();
        assert!(exported.contains("excluded_extensions"));
        assert!(exported.contains("respect_gitignore"));

        // Clear settings
        reset_settings_internal(&db).unwrap();

        // Import settings
        import_settings_internal(&db, &exported).unwrap();

        let loaded = load_settings_internal(&db).unwrap();
        assert_eq!(loaded.excluded_extensions, vec![".test".to_string()]);
        assert_eq!(loaded.token_limit, 100000);
        assert_eq!(loaded.respect_gitignore, false);
    }

    #[test]
    fn test_delete_setting() {
        let db = setup_test_db();

        save_setting_internal(&db, "test_key", "test_value").unwrap();

        delete_setting_internal(&db, "test_key").unwrap();

        let value = get_setting_internal(&db, "test_key").unwrap();
        assert_eq!(value, None);
    }

    #[test]
    fn test_reset_settings() {
        let db = setup_test_db();

        save_setting_internal(&db, "key1", "value1").unwrap();
        save_setting_internal(&db, "key2", "value2").unwrap();

        reset_settings_internal(&db).unwrap();

        let settings = get_all_settings_internal(&db).unwrap();
        assert_eq!(settings.len(), 0);
    }

    #[test]
    fn test_default_settings() {
        let db = setup_test_db();

        let settings = load_settings_internal(&db).unwrap();

        // Should return default settings when database is empty
        assert_eq!(settings.token_limit, 200000);
        assert_eq!(settings.default_template, "agent");
        assert!(settings.auto_save_history);
        assert_eq!(settings.cache_size_mb, 100);
        assert!(settings.excluded_extensions.contains(&".exe".to_string()));
        assert!(settings.respect_gitignore);
    }

    #[test]
    fn test_respect_gitignore_setting() {
        let db = setup_test_db();

        // Test saving respect_gitignore as true
        save_setting_internal(&db, "respect_gitignore", "true").unwrap();
        let settings = load_settings_internal(&db).unwrap();
        assert!(settings.respect_gitignore);

        // Test saving respect_gitignore as false
        save_setting_internal(&db, "respect_gitignore", "false").unwrap();
        let settings = load_settings_internal(&db).unwrap();
        assert!(!settings.respect_gitignore);
    }
}
