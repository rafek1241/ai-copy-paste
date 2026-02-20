use super::FileEntry;
use crate::error::AppResult;
use rusqlite::{params, OptionalExtension};
use std::path::Path;

const BATCH_SIZE: usize = 1000;

pub(crate) fn persist_entries_in_batches(
    conn: &mut rusqlite::Connection,
    mut entries: Vec<FileEntry>,
) -> AppResult<u64> {
    sort_entries_by_depth(&mut entries);

    let mut total_inserted = 0u64;
    for (batch_idx, chunk) in entries.chunks(BATCH_SIZE).enumerate() {
        let tx = conn.transaction()?;

        for entry in chunk {
            upsert_entry(&tx, entry)?;
        }

        tx.commit()?;
        total_inserted += chunk.len() as u64;
        log::debug!(
            "Inserted batch {} ({} entries)",
            batch_idx + 1,
            total_inserted
        );
    }

    Ok(total_inserted)
}

fn sort_entries_by_depth(entries: &mut [FileEntry]) {
    entries.sort_by_key(|entry| Path::new(&entry.path).components().count());
}

fn upsert_entry(tx: &rusqlite::Transaction<'_>, entry: &FileEntry) -> AppResult<()> {
    let existing_fingerprint: Option<Option<String>> = tx
        .query_row(
            "SELECT fingerprint FROM files WHERE path = ?",
            params![&entry.path],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(existing_fp) = existing_fingerprint {
        if existing_fp != entry.fingerprint {
            tx.execute(
                "UPDATE files SET size = ?, mtime = ?, fingerprint = ?, name = ?, parent_path = ? WHERE path = ?",
                params![
                    entry.size,
                    entry.mtime,
                    &entry.fingerprint,
                    &entry.name,
                    &entry.parent_path,
                    &entry.path
                ],
            )?;
        }
    } else {
        tx.execute(
            "INSERT INTO files (path, parent_path, name, size, mtime, is_dir, fingerprint)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                &entry.path,
                &entry.parent_path,
                &entry.name,
                entry.size,
                entry.mtime,
                entry.is_dir as i32,
                &entry.fingerprint,
            ],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::schema::init_database(&conn).unwrap();
        conn
    }

    fn test_entry(path: &str, parent_path: Option<&str>, is_dir: bool, fingerprint: &str) -> FileEntry {
        FileEntry {
            path: path.to_string(),
            parent_path: parent_path.map(std::string::ToString::to_string),
            name: Path::new(path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(path)
                .to_string(),
            size: if is_dir { None } else { Some(10) },
            mtime: Some(1000),
            is_dir,
            token_count: None,
            fingerprint: Some(fingerprint.to_string()),
            child_count: None,
        }
    }

    #[test]
    fn sort_entries_by_depth_places_parent_before_child() {
        let mut entries = vec![
            test_entry("/root/child/file.rs", Some("/root/child"), false, "f3"),
            test_entry("/root", None, true, "f1"),
            test_entry("/root/child", Some("/root"), true, "f2"),
        ];

        sort_entries_by_depth(&mut entries);

        assert_eq!(entries[0].path, "/root");
        assert_eq!(entries[1].path, "/root/child");
        assert_eq!(entries[2].path, "/root/child/file.rs");
    }

    #[test]
    fn persist_entries_upserts_existing_rows() {
        let mut conn = create_test_db();

        let first = vec![test_entry("/root/file.txt", Some("/root"), false, "100_10")];
        let inserted_first = persist_entries_in_batches(&mut conn, first).unwrap();
        assert_eq!(inserted_first, 1);

        let second = vec![test_entry("/root/file.txt", Some("/root"), false, "200_10")];
        let inserted_second = persist_entries_in_batches(&mut conn, second).unwrap();
        assert_eq!(inserted_second, 1);

        let (row_count, fingerprint): (i64, Option<String>) = conn
            .query_row(
                "SELECT COUNT(*), MAX(fingerprint) FROM files WHERE path = '/root/file.txt'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(row_count, 1);
        assert_eq!(fingerprint.as_deref(), Some("200_10"));
    }
}
