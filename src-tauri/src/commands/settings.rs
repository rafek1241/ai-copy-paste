use crate::db::DbConnection;
use rusqlite::params;
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
        }
    }
}

/// Save a setting to the database
#[tauri::command]
pub async fn save_setting(
    db: tauri::State<'_, DbConnection>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| format!("Failed to save setting: {}", e))?;

    Ok(())
}

/// Get a setting from the database
#[tauri::command]
pub async fn get_setting(
    db: tauri::State<'_, DbConnection>,
    key: String,
) -> Result<Option<String>, String> {
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

/// Get all settings as a HashMap
#[tauri::command]
pub async fn get_all_settings(
    db: tauri::State<'_, DbConnection>,
) -> Result<HashMap<String, String>, String> {
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

/// Load application settings with defaults
#[tauri::command]
pub async fn load_settings(db: tauri::State<'_, DbConnection>) -> Result<AppSettings, String> {
    let settings_map = get_all_settings(db).await?;

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

    Ok(settings)
}

/// Save application settings
#[tauri::command]
pub async fn save_settings(
    db: tauri::State<'_, DbConnection>,
    settings: AppSettings,
) -> Result<(), String> {
    // Serialize and save each setting
    let excluded_ext_json = serde_json::to_string(&settings.excluded_extensions)
        .map_err(|e| format!("Failed to serialize excluded_extensions: {}", e))?;

    save_setting(
        db.clone(),
        "excluded_extensions".to_string(),
        excluded_ext_json,
    )
    .await?;

    save_setting(
        db.clone(),
        "token_limit".to_string(),
        settings.token_limit.to_string(),
    )
    .await?;

    save_setting(
        db.clone(),
        "default_template".to_string(),
        settings.default_template,
    )
    .await?;

    save_setting(
        db.clone(),
        "auto_save_history".to_string(),
        settings.auto_save_history.to_string(),
    )
    .await?;

    save_setting(
        db.clone(),
        "cache_size_mb".to_string(),
        settings.cache_size_mb.to_string(),
    )
    .await?;

    Ok(())
}

/// Export all settings as JSON
#[tauri::command]
pub async fn export_settings(db: tauri::State<'_, DbConnection>) -> Result<String, String> {
    let settings = load_settings(db).await?;
    serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to export settings: {}", e))
}

/// Import settings from JSON
#[tauri::command]
pub async fn import_settings(
    db: tauri::State<'_, DbConnection>,
    json_data: String,
) -> Result<(), String> {
    let settings: AppSettings =
        serde_json::from_str(&json_data).map_err(|e| format!("Failed to parse settings: {}", e))?;

    save_settings(db, settings).await?;

    Ok(())
}

/// Delete a setting from the database
#[tauri::command]
pub async fn delete_setting(db: tauri::State<'_, DbConnection>, key: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])
        .map_err(|e| format!("Failed to delete setting: {}", e))?;

    Ok(())
}

/// Reset all settings to defaults
#[tauri::command]
pub async fn reset_settings(db: tauri::State<'_, DbConnection>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute("DELETE FROM settings", [])
        .map_err(|e| format!("Failed to reset settings: {}", e))?;

    Ok(())
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

    #[tokio::test]
    async fn test_save_and_get_setting() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        save_setting(
            state.clone(),
            "test_key".to_string(),
            "test_value".to_string(),
        )
        .await
        .unwrap();

        let value = get_setting(state, "test_key".to_string()).await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));
    }

    #[tokio::test]
    async fn test_get_all_settings() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        save_setting(state.clone(), "key1".to_string(), "value1".to_string())
            .await
            .unwrap();
        save_setting(state.clone(), "key2".to_string(), "value2".to_string())
            .await
            .unwrap();

        let settings = get_all_settings(state).await.unwrap();
        assert_eq!(settings.len(), 2);
        assert_eq!(settings.get("key1"), Some(&"value1".to_string()));
        assert_eq!(settings.get("key2"), Some(&"value2".to_string()));
    }

    #[tokio::test]
    async fn test_save_and_load_settings() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        let settings = AppSettings {
            excluded_extensions: vec![".test".to_string()],
            token_limit: 100000,
            default_template: "test".to_string(),
            auto_save_history: false,
            cache_size_mb: 50,
        };

        save_settings(state.clone(), settings.clone())
            .await
            .unwrap();

        let loaded = load_settings(state).await.unwrap();
        assert_eq!(loaded.excluded_extensions, settings.excluded_extensions);
        assert_eq!(loaded.token_limit, settings.token_limit);
        assert_eq!(loaded.default_template, settings.default_template);
        assert_eq!(loaded.auto_save_history, settings.auto_save_history);
        assert_eq!(loaded.cache_size_mb, settings.cache_size_mb);
    }

    #[tokio::test]
    async fn test_export_import_settings() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        let settings = AppSettings {
            excluded_extensions: vec![".test".to_string()],
            token_limit: 100000,
            default_template: "test".to_string(),
            auto_save_history: false,
            cache_size_mb: 50,
        };

        save_settings(state.clone(), settings).await.unwrap();

        let exported = export_settings(state.clone()).await.unwrap();
        assert!(exported.contains("excluded_extensions"));

        // Clear settings
        reset_settings(state.clone()).await.unwrap();

        // Import settings
        import_settings(state.clone(), exported).await.unwrap();

        let loaded = load_settings(state).await.unwrap();
        assert_eq!(loaded.excluded_extensions, vec![".test".to_string()]);
        assert_eq!(loaded.token_limit, 100000);
    }

    #[tokio::test]
    async fn test_delete_setting() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        save_setting(state.clone(), "test_key".to_string(), "test_value".to_string())
            .await
            .unwrap();

        delete_setting(state.clone(), "test_key".to_string())
            .await
            .unwrap();

        let value = get_setting(state, "test_key".to_string()).await.unwrap();
        assert_eq!(value, None);
    }

    #[tokio::test]
    async fn test_reset_settings() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        save_setting(state.clone(), "key1".to_string(), "value1".to_string())
            .await
            .unwrap();
        save_setting(state.clone(), "key2".to_string(), "value2".to_string())
            .await
            .unwrap();

        reset_settings(state.clone()).await.unwrap();

        let settings = get_all_settings(state).await.unwrap();
        assert_eq!(settings.len(), 0);
    }

    #[tokio::test]
    async fn test_default_settings() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        let settings = load_settings(state).await.unwrap();

        // Should return default settings when database is empty
        assert_eq!(settings.token_limit, 200000);
        assert_eq!(settings.default_template, "agent");
        assert_eq!(settings.auto_save_history, true);
        assert_eq!(settings.cache_size_mb, 100);
        assert!(settings.excluded_extensions.contains(&".exe".to_string()));
    }
}
