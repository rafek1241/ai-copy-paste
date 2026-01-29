pub mod schema;

use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

pub type DbConnection = Arc<Mutex<Connection>>;

/// Initialize the database connection and create tables
pub fn init_db(app: &AppHandle) -> Result<DbConnection> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");

    let db_path = app_dir.join("ai-context-collector.db");
    log::info!("Database path: {:?}", db_path);

    let conn = Connection::open(db_path)?;
    
    // Initialize schema
    schema::init_database(&conn)?;
    
    Ok(Arc::new(Mutex::new(conn)))
}

/// Get a database connection from the state
pub fn get_connection(db: &DbConnection) -> Result<std::sync::MutexGuard<Connection>> {
    db.lock().map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to lock database: {}", e),
        )))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> DbConnection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        schema::init_database(&conn).expect("Failed to init schema");
        Arc::new(Mutex::new(conn))
    }

    #[test]
    fn test_get_connection_success() {
        let db = create_test_db();
        let conn = get_connection(&db);
        assert!(conn.is_ok());
    }

    #[test]
    fn test_get_connection_can_execute_query() {
        let db = create_test_db();
        let conn = get_connection(&db).unwrap();

        // Verify we can execute queries through the connection
        let result: i32 = conn
            .query_row("SELECT 1", [], |row| row.get(0))
            .expect("Query failed");
        assert_eq!(result, 1);
    }

    #[test]
    fn test_db_connection_is_shareable() {
        let db = create_test_db();

        // Clone the Arc to simulate sharing
        let db_clone = Arc::clone(&db);

        // Both should be able to access (sequentially)
        {
            let conn1 = get_connection(&db).unwrap();
            let _: i32 = conn1.query_row("SELECT 1", [], |row| row.get(0)).unwrap();
        }

        {
            let conn2 = get_connection(&db_clone).unwrap();
            let _: i32 = conn2.query_row("SELECT 2", [], |row| row.get(0)).unwrap();
        }
    }

    #[test]
    fn test_db_connection_tables_exist() {
        let db = create_test_db();
        let conn = get_connection(&db).unwrap();

        // Verify the files table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='files'",
                [],
                |_| Ok(true),
            )
            .unwrap_or(false);
        assert!(table_exists, "files table should exist");

        // Verify the settings table exists
        let settings_exists: bool = conn
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='settings'",
                [],
                |_| Ok(true),
            )
            .unwrap_or(false);
        assert!(settings_exists, "settings table should exist");
    }
}
