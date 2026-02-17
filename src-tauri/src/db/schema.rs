use rusqlite::{Connection, Result};

/// Initialize the database schema
pub fn init_database(conn: &Connection) -> Result<()> {
    // Core file index table - using path as PRIMARY KEY
    // Note: parent_path is NOT a foreign key - it stores the true filesystem parent path
    // even if that parent hasn't been indexed yet. This allows indexing individual files
    // without requiring their parent folder to be indexed first.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS files (
            path TEXT PRIMARY KEY,
            parent_path TEXT,
            name TEXT NOT NULL,
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
        "CREATE INDEX IF NOT EXISTS idx_parent_path ON files(parent_path)",
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

    // Sensitive path marks table (files and ancestor directories)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sensitive_paths (
            path TEXT PRIMARY KEY,
            is_sensitive_file INTEGER NOT NULL DEFAULT 0,
            matched_patterns TEXT NOT NULL DEFAULT '[]',
            match_count INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sensitive_paths_file ON sensitive_paths(is_sensitive_file)",
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
        assert_eq!(table_count, 4); // files, history, settings, sensitive_paths

        // Verify path is primary key
        let pk_info: String = conn
            .query_row(
                "SELECT name FROM pragma_table_info('files') WHERE pk = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(pk_info, "path");
    }
}
