use crate::db::DbConnection;
use crate::error::AppError;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Represents a session history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: Option<i64>,
    pub created_at: i64,
    pub root_paths: Vec<String>,
    pub selected_paths: Vec<String>,
    pub template_id: Option<String>,
    pub custom_prompt: Option<String>,
}

/// Validation result for a history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub missing_paths: Vec<String>,
}

/// Save a new history entry to the database
/// Maintains a maximum of 10 entries (FIFO eviction)
#[tauri::command]
pub async fn save_history(
    db: tauri::State<'_, DbConnection>,
    root_paths: Vec<String>,
    selected_paths: Vec<String>,
    template_id: Option<String>,
    custom_prompt: Option<String>,
) -> Result<i64, String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    // Get current count
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM history", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count history entries: {}", e))?;

    // If we have 10 or more entries, delete the oldest
    if count >= 10 {
        conn.execute(
            "DELETE FROM history WHERE id IN (
                SELECT id FROM history ORDER BY created_at ASC LIMIT ?1
            )",
            params![count - 9],
        )
        .map_err(|e| format!("Failed to evict old history entries: {}", e))?;
    }

    // Insert new entry
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let root_paths_json = serde_json::to_string(&root_paths)
        .map_err(|e| format!("Failed to serialize root_paths: {}", e))?;
    let selected_paths_json = serde_json::to_string(&selected_paths)
        .map_err(|e| format!("Failed to serialize selected_paths: {}", e))?;

    conn.execute(
        "INSERT INTO history (created_at, root_paths, selected_paths, template_id, custom_prompt)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            created_at,
            root_paths_json,
            selected_paths_json,
            template_id,
            custom_prompt
        ],
    )
    .map_err(|e| format!("Failed to insert history entry: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// Load all history entries from the database
#[tauri::command]
pub async fn load_history(db: tauri::State<'_, DbConnection>) -> Result<Vec<HistoryEntry>, String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, created_at, root_paths, selected_paths, template_id, custom_prompt FROM history ORDER BY created_at DESC")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let entries = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let created_at: i64 = row.get(1)?;
            let root_paths_json: String = row.get(2)?;
            let selected_paths_json: String = row.get(3)?;
            let template_id: Option<String> = row.get(4)?;
            let custom_prompt: Option<String> = row.get(5)?;

            let root_paths: Vec<String> = serde_json::from_str(&root_paths_json)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            let selected_paths: Vec<String> = serde_json::from_str(&selected_paths_json)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

            Ok(HistoryEntry {
                id: Some(id),
                created_at,
                root_paths,
                selected_paths,
                template_id,
                custom_prompt,
            })
        })
        .map_err(|e| format!("Failed to query history: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect history entries: {}", e))?;

    Ok(entries)
}

/// Validate paths in a history entry
/// Returns a list of missing paths that no longer exist
#[tauri::command]
pub async fn validate_history_paths(paths: Vec<String>) -> Result<ValidationResult, String> {
    let mut missing_paths = Vec::new();

    for path_str in &paths {
        let path = Path::new(path_str);
        if !path.exists() {
            missing_paths.push(path_str.clone());
        }
    }

    Ok(ValidationResult {
        valid: missing_paths.is_empty(),
        missing_paths,
    })
}

/// Delete a history entry by ID
#[tauri::command]
pub async fn delete_history(db: tauri::State<'_, DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute("DELETE FROM history WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete history entry: {}", e))?;

    Ok(())
}

/// Clear all history entries
#[tauri::command]
pub async fn clear_history(db: tauri::State<'_, DbConnection>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute("DELETE FROM history", [])
        .map_err(|e| format!("Failed to clear history: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use crate::db::schema::init_database;
    use std::sync::{Arc, Mutex};

    fn setup_test_db() -> DbConnection {
        let conn = Connection::open_in_memory().unwrap();
        init_database(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[tokio::test]
    async fn test_save_and_load_history() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        let root_paths = vec!["/test/path".to_string()];
        let selected_paths = vec!["/test/path/file.txt".to_string()];
        let template_id = Some("agent".to_string());
        let custom_prompt = Some("Test prompt".to_string());

        let id = save_history(
            state.clone(),
            root_paths.clone(),
            selected_paths.clone(),
            template_id.clone(),
            custom_prompt.clone(),
        )
        .await
        .unwrap();

        assert!(id > 0);

        let history = load_history(state).await.unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].root_paths, root_paths);
        assert_eq!(history[0].selected_paths, selected_paths);
        assert_eq!(history[0].template_id, template_id);
        assert_eq!(history[0].custom_prompt, custom_prompt);
    }

    #[tokio::test]
    async fn test_history_fifo_eviction() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        // Add 12 entries
        for i in 0..12 {
            save_history(
                state.clone(),
                vec![format!("/test/path{}", i)],
                vec![format!("/test/path{}/file.txt", i)],
                None,
                None,
            )
            .await
            .unwrap();
        }

        // Should only have 10 entries
        let history = load_history(state).await.unwrap();
        assert_eq!(history.len(), 10);

        // Should have the 10 most recent entries
        // The oldest entries (0 and 1) should be evicted
        assert_eq!(history[9].root_paths[0], "/test/path2");
        assert_eq!(history[0].root_paths[0], "/test/path11");
    }

    #[tokio::test]
    async fn test_validate_history_paths() {
        // Create a temp file
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_file = temp_dir.path().join("test.txt");
        std::fs::write(&temp_file, "test").unwrap();

        let paths = vec![
            temp_file.to_string_lossy().to_string(),
            "/nonexistent/path.txt".to_string(),
        ];

        let result = validate_history_paths(paths).await.unwrap();

        assert!(!result.valid);
        assert_eq!(result.missing_paths.len(), 1);
        assert_eq!(result.missing_paths[0], "/nonexistent/path.txt");
    }

    #[tokio::test]
    async fn test_delete_history() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        let id = save_history(
            state.clone(),
            vec!["/test/path".to_string()],
            vec!["/test/path/file.txt".to_string()],
            None,
            None,
        )
        .await
        .unwrap();

        delete_history(state.clone(), id).await.unwrap();

        let history = load_history(state).await.unwrap();
        assert_eq!(history.len(), 0);
    }

    #[tokio::test]
    async fn test_clear_history() {
        let db = setup_test_db();
        let state = tauri::State::from(&db);

        // Add 3 entries
        for i in 0..3 {
            save_history(
                state.clone(),
                vec![format!("/test/path{}", i)],
                vec![format!("/test/path{}/file.txt", i)],
                None,
                None,
            )
            .await
            .unwrap();
        }

        clear_history(state.clone()).await.unwrap();

        let history = load_history(state).await.unwrap();
        assert_eq!(history.len(), 0);
    }
}
