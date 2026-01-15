pub mod schema;

use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

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
