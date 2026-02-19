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

    // Pending update tracking for "Update on Exit" feature
    conn.execute(
        "CREATE TABLE IF NOT EXISTS pending_updates (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version TEXT NOT NULL,
            download_url TEXT NOT NULL,
            release_notes TEXT,
            downloaded_path TEXT,
            created_at INTEGER NOT NULL
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
        assert_eq!(table_count, 4); // files, history, settings, pending_updates

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

    #[test]
    fn test_pending_updates_table() {
        let conn = Connection::open_in_memory().unwrap();
        init_database(&conn).unwrap();

        // Insert a pending update
        conn.execute(
            "INSERT INTO pending_updates (id, version, download_url, release_notes, created_at)
             VALUES (1, '1.0.1', 'https://example.com/update.exe', 'Release notes', 1234567890)",
            [],
        )
        .unwrap();

        // Read it back
        let (version, download_url): (String, String) = conn
            .query_row(
                "SELECT version, download_url FROM pending_updates WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(version, "1.0.1");
        assert_eq!(download_url, "https://example.com/update.exe");

        // Test CHECK constraint - inserting id=2 should fail
        let result = conn.execute(
            "INSERT INTO pending_updates (id, version, download_url, created_at)
             VALUES (2, '1.0.2', 'https://example.com/update2.exe', 1234567890)",
            [],
        );
        assert!(result.is_err());
    }
}
