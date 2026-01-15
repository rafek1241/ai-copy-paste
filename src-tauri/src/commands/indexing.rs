use crate::db::DbConnection;
use crate::error::{AppError, AppResult};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub id: Option<i64>,
    pub parent_id: Option<i64>,
    pub name: String,
    pub path: String,
    pub size: Option<i64>,
    pub mtime: Option<i64>,
    pub is_dir: bool,
    pub token_count: Option<i64>,
    pub fingerprint: Option<String>,
}

impl FileEntry {
    fn from_path(path: &Path, parent_id: Option<i64>) -> AppResult<Self> {
        let metadata = fs::metadata(path)?;
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| AppError::Path("Invalid file name".to_string()))?
            .to_string();

        let path_str = path
            .to_str()
            .ok_or_else(|| AppError::Path("Invalid path".to_string()))?
            .to_string();

        let size = if metadata.is_file() {
            Some(metadata.len() as i64)
        } else {
            None
        };

        let mtime = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        let fingerprint = size.and_then(|s| mtime.map(|m| format!("{}_{}", m, s)));

        Ok(FileEntry {
            id: None,
            parent_id,
            name,
            path: path_str,
            size,
            mtime,
            is_dir: metadata.is_dir(),
            token_count: None,
            fingerprint,
        })
    }
}

/// Index a folder and its contents into the database
#[tauri::command]
pub async fn index_folder(path: String, db: tauri::State<'_, DbConnection>) -> Result<u64, String> {
    log::info!("Indexing folder: {}", path);

    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let conn = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let count = traverse_and_insert(&conn, &path_buf, None)
        .map_err(|e| format!("Failed to index folder: {}", e))?;

    log::info!("Indexed {} entries from {}", count, path);
    Ok(count)
}

/// Get children of a specific node
#[tauri::command]
pub async fn get_children(
    parent_id: Option<i64>,
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<FileEntry>, String> {
    log::debug!("Getting children for parent_id: {:?}", parent_id);

    let conn = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, name, path, size, mtime, is_dir, token_count, fingerprint 
             FROM files 
             WHERE parent_id IS ? OR (parent_id IS NULL AND ? IS NULL)
             ORDER BY is_dir DESC, name ASC",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![parent_id, parent_id], |row| {
            Ok(FileEntry {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                size: row.get(4)?,
                mtime: row.get(5)?,
                is_dir: row.get::<_, i32>(6)? != 0,
                token_count: row.get(7)?,
                fingerprint: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

/// Search for files by path pattern
#[tauri::command]
pub async fn search_path(
    pattern: String,
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<FileEntry>, String> {
    log::debug!("Searching for pattern: {}", pattern);

    let conn = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let search_pattern = format!("%{}%", pattern);
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, name, path, size, mtime, is_dir, token_count, fingerprint 
             FROM files 
             WHERE path LIKE ? OR name LIKE ?
             ORDER BY is_dir DESC, name ASC
             LIMIT 100",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![search_pattern.clone(), search_pattern], |row| {
            Ok(FileEntry {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                size: row.get(4)?,
                mtime: row.get(5)?,
                is_dir: row.get::<_, i32>(6)? != 0,
                token_count: row.get(7)?,
                fingerprint: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

/// Internal function to recursively traverse and insert files
fn traverse_and_insert(
    conn: &rusqlite::Connection,
    path: &Path,
    parent_id: Option<i64>,
) -> AppResult<u64> {
    let mut count = 0u64;

    let entry = FileEntry::from_path(path, parent_id)?;

    // Check if entry already exists with same fingerprint
    let existing: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT id, fingerprint FROM files WHERE path = ?",
            params![&entry.path],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;

    let current_id = if let Some((id, existing_fingerprint)) = existing {
        // Entry exists - check if we need to update
        if existing_fingerprint != entry.fingerprint {
            conn.execute(
                "UPDATE files SET size = ?, mtime = ?, fingerprint = ?, name = ? WHERE id = ?",
                params![entry.size, entry.mtime, entry.fingerprint, entry.name, id],
            )?;
        }
        id
    } else {
        // Insert new entry
        conn.execute(
            "INSERT INTO files (parent_id, name, path, size, mtime, is_dir, fingerprint) 
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                entry.parent_id,
                entry.name,
                entry.path,
                entry.size,
                entry.mtime,
                entry.is_dir as i32,
                entry.fingerprint,
            ],
        )?;
        conn.last_insert_rowid()
    };

    count += 1;

    // If it's a directory, recursively index children
    if entry.is_dir {
        match fs::read_dir(path) {
            Ok(entries) => {
                for dir_entry in entries.filter_map(|e| e.ok()) {
                    let child_path = dir_entry.path();
                    match traverse_and_insert(conn, &child_path, Some(current_id)) {
                        Ok(child_count) => count += child_count,
                        Err(e) => {
                            log::warn!("Failed to index {:?}: {}", child_path, e);
                            // Continue with other entries even if one fails
                        }
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to read directory {:?}: {}", path, e);
            }
        }
    }

    Ok(count)
}
