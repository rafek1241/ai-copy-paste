use crate::db::DbConnection;
use crate::error::{AppError, AppResult};
use crate::gitignore::GitignoreManager;
use rayon::prelude::*;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use super::settings::load_settings_internal;

/// Progress information for indexing operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexProgress {
    pub processed: u64,
    pub total_estimate: u64,
    pub current_path: String,
    pub errors: u64,
}

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
    pub child_count: Option<i64>,
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
            child_count: None,
        })
    }

    /// Create FileEntry from walkdir::DirEntry
    fn from_dir_entry(entry: &walkdir::DirEntry) -> AppResult<Self> {
        let path = entry.path();
        let metadata = entry.metadata()?;
        
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
            parent_id: None, // Will be set later based on path hierarchy
            name,
            path: path_str,
            size,
            mtime,
            is_dir: metadata.is_dir(),
            token_count: None,
            fingerprint,
            child_count: None,
        })
    }
}

/// Index a folder and its contents into the database with parallel processing
#[tauri::command]
pub async fn index_folder(
    path: String,
    app: AppHandle,
    db: tauri::State<'_, DbConnection>,
) -> Result<u64, String> {
    log::info!("Indexing folder: {}", path);

    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // Use parallel traversal and batch inserts
    let count = parallel_index_folder(&path_buf, &app, &db)
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
            "SELECT id, parent_id, name, path, size, mtime, is_dir, token_count, fingerprint,
             (SELECT COUNT(*) FROM files f2 WHERE f2.parent_id = files.id) as child_count
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
                child_count: row.get(9)?,
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
            "SELECT id, parent_id, name, path, size, mtime, is_dir, token_count, fingerprint,
             (SELECT COUNT(*) FROM files f2 WHERE f2.parent_id = files.id) as child_count
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
                child_count: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

/// Clear the file index
#[tauri::command]
pub async fn clear_index(
    db: tauri::State<'_, DbConnection>,
) -> Result<(), String> {
    log::info!("Clearing file index");

    let conn = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    conn.execute("DELETE FROM files", [])
        .map_err(|e| format!("Failed to clear index: {}", e))?;

    Ok(())
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

/// Parallel file system traversal with progress reporting and batch inserts
fn parallel_index_folder(
    root: &Path,
    app: &AppHandle,
    db: &DbConnection,
) -> AppResult<u64> {
    log::info!("Starting parallel traversal of {:?}", root);

    // Load settings to check respect_gitignore flag
    let settings = load_settings_internal(db).unwrap_or_default();
    let respect_gitignore = settings.respect_gitignore;
    log::info!("Gitignore support: {}", if respect_gitignore { "enabled" } else { "disabled" });

    // Create gitignore manager and discover .gitignore files if enabled
    let gitignore_manager = if respect_gitignore {
        let mut manager = GitignoreManager::new(root);
        match manager.discover_gitignores(root) {
            Ok(count) => log::info!("Loaded {} .gitignore files", count),
            Err(e) => log::warn!("Error discovering .gitignore files: {}", e),
        }
        Some(Arc::new(manager))
    } else {
        None
    };

    // First pass: collect all entries using parallel walkdir
    let processed_count = Arc::new(AtomicU64::new(0));
    let error_count = Arc::new(AtomicU64::new(0));
    let ignored_count = Arc::new(AtomicU64::new(0));
    let last_progress_time = Arc::new(Mutex::new(Instant::now()));

    // Clone Arc for closure
    let gitignore_manager_clone = gitignore_manager.clone();

    // Collect entries with parallel iteration
    let entries: Vec<FileEntry> = WalkDir::new(root)
        .follow_links(false) // Don't follow symlinks to avoid cycles
        .into_iter()
        .par_bridge() // Enable parallel processing
        .filter_map(|entry_result| {
            let count = processed_count.fetch_add(1, Ordering::Relaxed);

            // Throttle progress events to max 10 per second
            let should_emit = {
                let mut last_time = last_progress_time.lock().unwrap();
                let now = Instant::now();
                if now.duration_since(*last_time) > Duration::from_millis(100) {
                    *last_time = now;
                    true
                } else {
                    false
                }
            };

            if should_emit {
                let current_path = entry_result.as_ref()
                    .map(|e| e.path().to_string_lossy().to_string())
                    .unwrap_or_else(|_| "Unknown".to_string());

                let progress = IndexProgress {
                    processed: count,
                    total_estimate: count + 100, // Rough estimate
                    current_path,
                    errors: error_count.load(Ordering::Relaxed),
                };

                if let Err(e) = app.emit("indexing-progress", &progress) {
                    log::warn!("Failed to emit progress event: {}", e);
                }
            }

            match entry_result {
                Ok(entry) => {
                    // Skip symlinks
                    if entry.path_is_symlink() {
                        log::debug!("Skipping symlink: {:?}", entry.path());
                        return None;
                    }

                    // Check gitignore patterns if enabled
                    if let Some(ref manager) = gitignore_manager_clone {
                        let is_dir = entry.file_type().is_dir();
                        if manager.is_ignored_with_type(entry.path(), is_dir) {
                            ignored_count.fetch_add(1, Ordering::Relaxed);
                            log::debug!("Ignoring (gitignore): {:?}", entry.path());
                            return None;
                        }
                    }

                    match FileEntry::from_dir_entry(&entry) {
                        Ok(file_entry) => Some(file_entry),
                        Err(e) => {
                            error_count.fetch_add(1, Ordering::Relaxed);
                            log::warn!("Failed to process entry {:?}: {}", entry.path(), e);
                            None
                        }
                    }
                }
                Err(e) => {
                    error_count.fetch_add(1, Ordering::Relaxed);
                    log::warn!("Error during traversal: {}", e);
                    None
                }
            }
        })
        .collect();

    let ignored = ignored_count.load(Ordering::Relaxed);
    if ignored > 0 {
        log::info!("Ignored {} entries due to .gitignore patterns", ignored);
    }

    let total_entries = entries.len();
    log::info!("Collected {} entries, now inserting into database", total_entries);

    // Second pass: batch insert into database
    let mut conn = db.lock()
        .map_err(|e| AppError::Unknown(format!("Failed to lock database: {}", e)))?;

    // Sort entries by path depth to ensure parents are processed before children
    let mut sorted_entries = entries;
    sorted_entries.sort_by_key(|entry| {
        entry.path.matches(std::path::MAIN_SEPARATOR).count()
    });

    // Build an in-memory path -> id mapping to track insertions
    let mut path_to_id: HashMap<String, i64> = HashMap::new();

    // Insert in batches of 1000
    const BATCH_SIZE: usize = 1000;
    let mut total_inserted = 0u64;

    for (batch_idx, chunk) in sorted_entries.chunks(BATCH_SIZE).enumerate() {
        let tx = conn.transaction()?;

        for entry in chunk {
            // Get parent_id by looking up parent path
            let parent_id = PathBuf::from(&entry.path)
                .parent()
                .and_then(|p| p.to_str())
                .and_then(|parent_path| {
                    // First check in-memory mapping (for this batch)
                    path_to_id.get(parent_path).copied().or_else(|| {
                        // Then check database (for previous batches)
                        tx.query_row(
                            "SELECT id FROM files WHERE path = ?",
                            params![parent_path],
                            |row| row.get::<_, i64>(0),
                        )
                        .ok()
                    })
                });

            // Check if entry already exists
            let existing: Option<(i64, Option<String>)> = tx
                .query_row(
                    "SELECT id, fingerprint FROM files WHERE path = ?",
                    params![&entry.path],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()?;

            let current_id = if let Some((id, existing_fingerprint)) = existing {
                // Entry exists - check if we need to update
                if existing_fingerprint != entry.fingerprint {
                    tx.execute(
                        "UPDATE files SET size = ?, mtime = ?, fingerprint = ?, name = ?, parent_id = ? WHERE id = ?",
                        params![entry.size, entry.mtime, entry.fingerprint, entry.name, parent_id, id],
                    )?;
                }
                id
            } else {
                // Insert new entry
                tx.execute(
                    "INSERT INTO files (parent_id, name, path, size, mtime, is_dir, fingerprint)
                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                    params![
                        parent_id,
                        entry.name,
                        entry.path,
                        entry.size,
                        entry.mtime,
                        entry.is_dir as i32,
                        entry.fingerprint,
                    ],
                )?;
                tx.last_insert_rowid()
            };

            // Store the path -> id mapping for future lookups within this session
            path_to_id.insert(entry.path.clone(), current_id);
        }

        tx.commit()?;
        total_inserted += chunk.len() as u64;
        log::debug!("Inserted batch {} ({} entries)", batch_idx + 1, total_inserted);
    }

    // Send final progress event
    let final_progress = IndexProgress {
        processed: total_entries as u64,
        total_estimate: total_entries as u64,
        current_path: "Complete".to_string(),
        errors: error_count.load(Ordering::Relaxed),
    };
    
    if let Err(e) = app.emit("indexing-progress", &final_progress) {
        log::warn!("Failed to emit final progress event: {}", e);
    }

    log::info!("Parallel indexing complete: {} entries inserted, {} errors", 
              total_inserted, error_count.load(Ordering::Relaxed));
    
    Ok(total_inserted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::schema::init_database(&conn).unwrap();
        conn
    }

    fn create_test_directory() -> TempDir {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path();

        // Create test directory structure
        fs::create_dir_all(path.join("folder1")).unwrap();
        fs::create_dir_all(path.join("folder2/subfolder")).unwrap();
        fs::write(path.join("file1.txt"), "content1").unwrap();
        fs::write(path.join("folder1/file2.txt"), "content2").unwrap();
        fs::write(path.join("folder2/file3.txt"), "content3").unwrap();
        fs::write(path.join("folder2/subfolder/file4.txt"), "content4").unwrap();

        temp_dir
    }

    #[test]
    fn test_file_entry_from_path() {
        let temp_dir = create_test_directory();
        let file_path = temp_dir.path().join("file1.txt");

        let entry = FileEntry::from_path(&file_path, None).unwrap();

        assert_eq!(entry.name, "file1.txt");
        assert!(entry.path.ends_with("file1.txt"));
        assert!(!entry.is_dir);
        assert!(entry.size.is_some());
        assert!(entry.mtime.is_some());
        assert!(entry.fingerprint.is_some());
    }

    #[test]
    fn test_traverse_and_insert() {
        let temp_dir = create_test_directory();
        let conn = create_test_db();

        let count = traverse_and_insert(&conn, temp_dir.path(), None).unwrap();

        // Should have indexed: root dir + 2 folders + 1 subfolder + 4 files = 8 entries
        assert_eq!(count, 8);

        // Verify entries in database
        let file_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
            .unwrap();
        assert_eq!(file_count, 8);
    }

    #[test]
    fn test_fingerprint_update() {
        let temp_dir = create_test_directory();
        let conn = create_test_db();
        let file_path = temp_dir.path().join("file1.txt");

        // First insert
        traverse_and_insert(&conn, &file_path, None).unwrap();
        let original_fingerprint: Option<String> = conn
            .query_row(
                "SELECT fingerprint FROM files WHERE name = ?",
                params!["file1.txt"],
                |row| row.get(0),
            )
            .unwrap();

        // Modify file
        std::thread::sleep(std::time::Duration::from_secs(1));
        fs::write(&file_path, "modified content").unwrap();

        // Re-index
        traverse_and_insert(&conn, &file_path, None).unwrap();
        let new_fingerprint: Option<String> = conn
            .query_row(
                "SELECT fingerprint FROM files WHERE name = ?",
                params!["file1.txt"],
                |row| row.get(0),
            )
            .unwrap();

        // Fingerprint should have changed
        assert_ne!(original_fingerprint, new_fingerprint);

        // Should still have only one entry for the file
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM files WHERE name = ?",
                params!["file1.txt"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_index_progress_serialization() {
        let progress = IndexProgress {
            processed: 100,
            total_estimate: 1000,
            current_path: "/test/path".to_string(),
            errors: 5,
        };

        let serialized = serde_json::to_string(&progress).unwrap();
        let deserialized: IndexProgress = serde_json::from_str(&serialized).unwrap();

        assert_eq!(progress.processed, deserialized.processed);
        assert_eq!(progress.total_estimate, deserialized.total_estimate);
        assert_eq!(progress.current_path, deserialized.current_path);
        assert_eq!(progress.errors, deserialized.errors);
    }

    #[test]
    fn test_permission_error_recovery() {
        let conn = create_test_db();

        // Try to index a non-existent path
        let result = traverse_and_insert(&conn, &PathBuf::from("/nonexistent/path"), None);

        // Should return an error but not panic
        assert!(result.is_err());
    }

    // Gitignore integration tests
    mod gitignore_integration {
        use super::*;
        use crate::gitignore::GitignoreManager;

        fn create_test_directory_with_gitignore() -> TempDir {
            let temp_dir = TempDir::new().unwrap();
            let path = temp_dir.path();

            // Create test directory structure
            fs::create_dir_all(path.join("src")).unwrap();
            fs::create_dir_all(path.join("node_modules/package")).unwrap();
            fs::create_dir_all(path.join("build")).unwrap();

            // Create test files
            fs::write(path.join("main.rs"), "fn main() {}").unwrap();
            fs::write(path.join("src/lib.rs"), "pub fn lib() {}").unwrap();
            fs::write(path.join("node_modules/package/index.js"), "module.exports = {}").unwrap();
            fs::write(path.join("build/output.js"), "compiled").unwrap();
            fs::write(path.join("debug.log"), "log content").unwrap();

            // Create .gitignore
            fs::write(path.join(".gitignore"), "node_modules/\nbuild/\n*.log\n").unwrap();

            temp_dir
        }

        #[test]
        fn test_gitignore_manager_filters_node_modules() {
            let temp_dir = create_test_directory_with_gitignore();
            let path = temp_dir.path();

            let mut manager = GitignoreManager::new(path);
            manager.discover_gitignores(path).unwrap();

            // node_modules should be ignored
            assert!(manager.is_ignored(&path.join("node_modules")));
            assert!(manager.is_ignored(&path.join("node_modules/package/index.js")));

            // src should not be ignored
            assert!(!manager.is_ignored(&path.join("src")));
            assert!(!manager.is_ignored(&path.join("src/lib.rs")));
        }

        #[test]
        fn test_gitignore_manager_filters_build_directory() {
            let temp_dir = create_test_directory_with_gitignore();
            let path = temp_dir.path();

            let mut manager = GitignoreManager::new(path);
            manager.discover_gitignores(path).unwrap();

            // build should be ignored
            assert!(manager.is_ignored(&path.join("build")));
            assert!(manager.is_ignored(&path.join("build/output.js")));
        }

        #[test]
        fn test_gitignore_manager_filters_log_files() {
            let temp_dir = create_test_directory_with_gitignore();
            let path = temp_dir.path();

            let mut manager = GitignoreManager::new(path);
            manager.discover_gitignores(path).unwrap();

            // .log files should be ignored
            assert!(manager.is_ignored(&path.join("debug.log")));

            // .rs files should not be ignored
            assert!(!manager.is_ignored(&path.join("main.rs")));
        }

        #[test]
        fn test_gitignore_file_not_ignored() {
            let temp_dir = create_test_directory_with_gitignore();
            let path = temp_dir.path();

            let mut manager = GitignoreManager::new(path);
            manager.discover_gitignores(path).unwrap();

            // .gitignore itself should never be ignored
            assert!(!manager.is_ignored(&path.join(".gitignore")));
        }

        #[test]
        fn test_gitignore_count_after_discovery() {
            let temp_dir = create_test_directory_with_gitignore();
            let path = temp_dir.path();

            let mut manager = GitignoreManager::new(path);
            let count = manager.discover_gitignores(path).unwrap();

            assert_eq!(count, 1);
            assert_eq!(manager.gitignore_count(), 1);
        }

        #[test]
        fn test_nested_gitignore_files() {
            let temp_dir = TempDir::new().unwrap();
            let path = temp_dir.path();

            // Create directory structure
            fs::create_dir_all(path.join("src")).unwrap();
            fs::write(path.join("src/main.rs"), "fn main() {}").unwrap();
            fs::write(path.join("src/debug.log"), "debug log").unwrap();
            fs::write(path.join("src/important.log"), "important log").unwrap();

            // Root .gitignore ignores all .log files
            fs::write(path.join(".gitignore"), "*.log\n").unwrap();

            // Nested .gitignore whitelists important.log
            fs::write(path.join("src/.gitignore"), "!important.log\n").unwrap();

            let mut manager = GitignoreManager::new(path);
            manager.discover_gitignores(path).unwrap();

            // debug.log should be ignored
            assert!(manager.is_ignored(&path.join("src/debug.log")));

            // important.log should NOT be ignored (whitelisted)
            assert!(!manager.is_ignored(&path.join("src/important.log")));
        }

        #[test]
        fn test_file_entry_collection_with_walkdir() {
            let temp_dir = create_test_directory_with_gitignore();
            let path = temp_dir.path();

            let mut manager = GitignoreManager::new(path);
            manager.discover_gitignores(path).unwrap();

            // Collect entries using walkdir and filter with gitignore
            let entries: Vec<PathBuf> = WalkDir::new(path)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| !manager.is_ignored_with_type(e.path(), e.file_type().is_dir()))
                .map(|e| e.path().to_path_buf())
                .collect();

            // Check that ignored entries are not in the list
            assert!(!entries.iter().any(|p| p.to_string_lossy().contains("node_modules")));
            assert!(!entries.iter().any(|p| p.to_string_lossy().contains("build")));
            assert!(!entries.iter().any(|p| p.to_string_lossy().ends_with(".log")));

            // Check that non-ignored entries are in the list
            assert!(entries.iter().any(|p| p.to_string_lossy().contains("src")));
            assert!(entries.iter().any(|p| p.to_string_lossy().contains("main.rs")));
            assert!(entries.iter().any(|p| p.to_string_lossy().contains(".gitignore")));
        }
    }
}
