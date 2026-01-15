use rusqlite::{Connection, Result};

/// Initialize the database schema
pub fn init_database(conn: &Connection) -> Result<()> {
    // Core file index table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY,
            parent_id INTEGER REFERENCES files(id),
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            size INTEGER,
            mtime INTEGER,
            is_dir INTEGER DEFAULT 0,
            token_count INTEGER,
            fingerprint TEXT
        )",
        [],
    )?;

    // Create indices for efficient queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_parent ON files(parent_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_path ON files(path)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_fingerprint ON files(fingerprint)",
        [],
    )?;

    // Session history table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY,
            created_at INTEGER NOT NULL,
            root_paths TEXT NOT NULL,
            selected_paths TEXT NOT NULL,
            template_id TEXT,
            custom_prompt TEXT
        )",
        [],
    )?;

    // Settings persistence table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_init_database() {
        let conn = Connection::open_in_memory().unwrap();
        assert!(init_database(&conn).is_ok());

        // Verify tables were created
        let table_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 3); // files, history, settings
    }
}
