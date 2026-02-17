use crate::db::DbConnection;
use crate::error::{AppError, AppResult};
use crate::gitignore::GitignoreManager;
use rayon::prelude::*;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;
// NOTE: Race condition fixed by always storing true parent_path and updating orphaned children when parent is indexed.
use super::sensitive::reprocess_sensitive_marks_if_enabled;

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
    pub path: String,
    pub parent_path: Option<String>,
    pub name: String,
    pub size: Option<i64>,
    pub mtime: Option<i64>,
    pub is_dir: bool,
    pub token_count: Option<i64>,
    pub fingerprint: Option<String>,
    pub child_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub parent_path: Option<String>,
    pub name: String,
    pub size: Option<i64>,
    pub mtime: Option<i64>,
    pub is_dir: bool,
    pub token_count: Option<i64>,
    pub fingerprint: Option<String>,
    pub child_count: Option<i64>,
    pub score: i32,
}

/// Normalize path separators to forward slashes for cross-platform consistency
fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

impl FileEntry {
    fn from_path(path: &Path, parent_path: Option<String>) -> AppResult<Self> {
        let metadata = fs::metadata(path)?;
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| AppError::Path("Invalid file name".to_string()))?
            .to_string();

        let path_str = normalize_path(
            path
                .to_str()
                .ok_or_else(|| AppError::Path("Invalid path".to_string()))?
        );

        // Normalize parent_path for consistency
        let normalized_parent = parent_path.map(|p| normalize_path(&p));

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
            path: path_str,
            parent_path: normalized_parent,
            name,
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

        let path_str = normalize_path(
            path
                .to_str()
                .ok_or_else(|| AppError::Path("Invalid path".to_string()))?
        );

        // Compute parent path from the file path and normalize it
        let parent_path = path
            .parent()
            .and_then(|p| p.to_str())
            .map(|s| normalize_path(s));

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
            path: path_str,
            parent_path,
            name,
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

    reprocess_sensitive_marks_if_enabled(&db)
        .map_err(|e| format!("Failed to refresh sensitive marks after indexing: {}", e))?;

    log::info!("Indexed {} entries from {}", count, path);
    Ok(count)
}

/// Get children of a specific node by parent path
#[tauri::command]
pub async fn get_children(
    parent_path: Option<String>,
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<FileEntry>, String> {
    log::debug!("Getting children for parent_path: {:?}", parent_path);

    let conn = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // For root queries (parent_path IS NULL), also include orphaned entries
    // whose parent_path points to a non-existent path in the database.
    // This ensures files indexed before their parent folder still appear at root level.
    let query = if parent_path.is_none() {
        "SELECT path, parent_path, name, size, mtime, is_dir, token_count, fingerprint,
         (SELECT COUNT(*) FROM files f2 WHERE f2.parent_path = files.path) as child_count
         FROM files
         WHERE parent_path IS NULL
            OR (parent_path IS NOT NULL AND NOT EXISTS (SELECT 1 FROM files f2 WHERE f2.path = files.parent_path))
         ORDER BY is_dir DESC, name ASC"
    } else {
        "SELECT path, parent_path, name, size, mtime, is_dir, token_count, fingerprint,
         (SELECT COUNT(*) FROM files f2 WHERE f2.parent_path = files.path) as child_count
         FROM files
         WHERE parent_path = ?
         ORDER BY is_dir DESC, name ASC"
    };

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    let entries = if parent_path.is_none() {
        stmt.query_map([], |row| {
            Ok(FileEntry {
                path: row.get(0)?,
                parent_path: row.get(1)?,
                name: row.get(2)?,
                size: row.get(3)?,
                mtime: row.get(4)?,
                is_dir: row.get::<_, i32>(5)? != 0,
                token_count: row.get(6)?,
                fingerprint: row.get(7)?,
                child_count: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
    } else {
        stmt.query_map(params![parent_path], |row| {
            Ok(FileEntry {
                path: row.get(0)?,
                parent_path: row.get(1)?,
                name: row.get(2)?,
                size: row.get(3)?,
                mtime: row.get(4)?,
                is_dir: row.get::<_, i32>(5)? != 0,
                token_count: row.get(6)?,
                fingerprint: row.get(7)?,
                child_count: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
    };

    Ok(entries)
}

/// Parsed search filters for advanced query syntax
#[derive(Debug, Default)]
struct SearchFilter {
    file_name: Option<String>,
    directory_name: Option<String>,
    regex_pattern: Option<regex::Regex>,
    plain_text: Option<String>,
}

/// Parse a search query into structured filters.
/// Supports: file:<name>, dir:<name>, regex (auto-detected), plain text
fn parse_search_query(query: &str) -> SearchFilter {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return SearchFilter::default();
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    let mut file_name = None;
    let mut directory_name = None;
    let mut remaining_parts = Vec::new();

    for part in &parts {
        let lower = part.to_lowercase();
        if lower.starts_with("file:") && part.len() > 5 {
            file_name = Some(part[5..].to_string());
        } else if lower.starts_with("dir:") && part.len() > 4 {
            directory_name = Some(part[4..].to_string());
        } else {
            remaining_parts.push(*part);
        }
    }

    let remaining = remaining_parts.join(" ");
    let regex_special = regex::Regex::new(r"[.*?\[\]()|^${}+\\]").unwrap();

    let (regex_pattern, plain_text) = if !remaining.is_empty() {
        if regex_special.is_match(&remaining) {
            match regex::Regex::new(&format!("(?i){}", &remaining)) {
                Ok(re) => (Some(re), None),
                Err(_) => (None, Some(remaining)),
            }
        } else {
            (None, Some(remaining))
        }
    } else {
        (None, None)
    };

    SearchFilter {
        file_name,
        directory_name,
        regex_pattern,
        plain_text,
    }
}

/// Compute relevance score for a search result.
/// Higher score = better match. Scoring factors:
/// - Exact name match (case-insensitive): +100
/// - Name starts with query: +50
/// - Name contains query: +30
/// - Path contains query: +10
fn compute_score(name: &str, path: &str, query: &str, is_dir: bool) -> i32 {
    if query.is_empty() {
        return 0;
    }
    let name_lower = name.to_lowercase();
    let path_lower = path.to_lowercase();
    let query_lower = query.to_lowercase();
    let mut score = 0i32;

    // Name-based scoring
    if name_lower == query_lower {
        score += 100; // Exact name match
    } else if name_lower.starts_with(&query_lower) {
        score += 50; // Name starts with query
    } else if name_lower.contains(&query_lower) {
        score += 30; // Name contains query
    } else if path_lower.contains(&query_lower) {
        score += 10; // Only path contains query
    }

    // Bonus for shorter names (more specific match)
    if name_lower.contains(&query_lower) && name.len() < 20 {
        score += 5;
    }

    // Slight bonus for files over directories in general text search
    // (users typically search for files)
    if !is_dir && score > 0 {
        score += 1;
    }

    score
}

/// Internal search function that operates on a raw connection (testable without Tauri state).
fn search_db(conn: &rusqlite::Connection, pattern: &str) -> Result<Vec<SearchResult>, String> {
    let filters = parse_search_query(pattern);

    // Empty query returns nothing
    if filters.file_name.is_none()
        && filters.directory_name.is_none()
        && filters.regex_pattern.is_none()
        && filters.plain_text.is_none()
    {
        return Ok(Vec::new());
    }

    // Build SQL conditions based on parsed filters
    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<String> = Vec::new();

    if let Some(ref file_name) = filters.file_name {
        // file: matches FILES by name
        conditions.push("(is_dir = 0 AND LOWER(name) LIKE ?)".to_string());
        param_values.push(format!("%{}%", file_name.to_lowercase()));
    }

    if let Some(ref dir_name) = filters.directory_name {
        // dir: matches DIRECTORIES by name
        conditions.push("(is_dir = 1 AND LOWER(name) LIKE ?)".to_string());
        param_values.push(format!("%{}%", dir_name.to_lowercase()));
    }

    // When both file: and dir: are present, we need files matching file: that are inside dirs matching dir:
    if filters.file_name.is_some() && filters.directory_name.is_some() {
        // Override: find files with name matching file: AND path containing dir:
        conditions.clear();
        param_values.clear();
        let file_name = filters.file_name.as_ref().unwrap();
        let dir_name = filters.directory_name.as_ref().unwrap();
        conditions.push("(is_dir = 0 AND LOWER(name) LIKE ? AND LOWER(path) LIKE ?)".to_string());
        param_values.push(format!("%{}%", file_name.to_lowercase()));
        param_values.push(format!("%/{}/%", dir_name.to_lowercase()));
    }

    if let Some(ref plain_text) = filters.plain_text {
        conditions.push("(LOWER(name) LIKE ? OR LOWER(path) LIKE ?)".to_string());
        param_values.push(format!("%{}%", plain_text.to_lowercase()));
        param_values.push(format!("%{}%", plain_text.to_lowercase()));
    }

    // For regex, we fetch broadly and filter in Rust
    if filters.regex_pattern.is_some() && conditions.is_empty() {
        // No SQL filters, query everything (limited)
    }

    let where_clause = if conditions.is_empty() {
        "1=1".to_string()
    } else {
        conditions.join(" AND ")
    };

    let query = format!(
        "SELECT path, parent_path, name, size, mtime, is_dir, token_count, fingerprint,
         (SELECT COUNT(*) FROM files f2 WHERE f2.parent_path = files.path) as child_count
         FROM files
         WHERE {}
         LIMIT 500",
        where_clause
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = param_values
        .iter()
        .map(|p| p as &dyn rusqlite::types::ToSql)
        .collect();

    let entries: Vec<(String, Option<String>, String, Option<i64>, Option<i64>, bool, Option<i64>, Option<String>, Option<i64>)> = stmt
        .query_map(rusqlite::params_from_iter(param_refs), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, i32>(5)? != 0,
                row.get::<_, Option<i64>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<i64>>(8)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Build the score query string (what the user actually typed for scoring)
    let score_query = if let Some(ref file_name) = filters.file_name {
        file_name.clone()
    } else if let Some(ref dir_name) = filters.directory_name {
        dir_name.clone()
    } else if let Some(ref plain_text) = filters.plain_text {
        plain_text.clone()
    } else {
        String::new()
    };

    let mut results: Vec<SearchResult> = entries
        .into_iter()
        .map(|(path, parent_path, name, size, mtime, is_dir, token_count, fingerprint, child_count)| {
            let score = compute_score(&name, &path, &score_query, is_dir);
            SearchResult {
                path,
                parent_path,
                name,
                size,
                mtime,
                is_dir,
                token_count,
                fingerprint,
                child_count,
                score,
            }
        })
        .collect();

    // Apply regex filter in Rust if present
    if let Some(ref re) = filters.regex_pattern {
        results.retain(|r| re.is_match(&r.name) || re.is_match(&r.path));
        // Score regex matches
        for r in &mut results {
            r.score = if re.is_match(&r.name) { 50 } else { 10 };
        }
    }

    // Filter out zero-score results (no match)
    results.retain(|r| r.score > 0);

    // Sort by score DESC, then name ASC
    results.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.name.cmp(&b.name)));

    Ok(results)
}

/// Search for files by path pattern with advanced filter support.
/// Supports: file:<name>, dir:<name>, regex patterns, plain text
/// Returns results with relevance scores, sorted by score DESC.
#[tauri::command]
pub async fn search_path(
    pattern: String,
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<SearchResult>, String> {
    log::debug!("Searching for pattern: {}", pattern);
    let conn = db.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    search_db(&conn, &pattern)
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

    conn.execute("DELETE FROM sensitive_paths", [])
        .map_err(|e| format!("Failed to clear sensitive marks: {}", e))?;

    Ok(())
}

/// Internal function to recursively traverse and insert files
fn traverse_and_insert(
    conn: &rusqlite::Connection,
    path: &Path,
    parent_path: Option<String>,
) -> AppResult<u64> {
    let mut count = 0u64;

    let entry = FileEntry::from_path(path, parent_path)?;

    // Check if entry already exists with same fingerprint
    let existing_fingerprint: Option<Option<String>> = conn
        .query_row(
            "SELECT fingerprint FROM files WHERE path = ?",
            params![&entry.path],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(existing_fp) = existing_fingerprint {
        // Entry exists - check if we need to update
        if existing_fp != entry.fingerprint {
            conn.execute(
                "UPDATE files SET size = ?, mtime = ?, fingerprint = ?, name = ?, parent_path = ? WHERE path = ?",
                params![entry.size, entry.mtime, entry.fingerprint, entry.name, entry.parent_path, entry.path],
            )?;
        }
    } else {
        // Insert new entry
        conn.execute(
            "INSERT INTO files (path, parent_path, name, size, mtime, is_dir, fingerprint)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                entry.path,
                entry.parent_path,
                entry.name,
                entry.size,
                entry.mtime,
                entry.is_dir as i32,
                entry.fingerprint,
            ],
        )?;
    }

    count += 1;

    // If it's a directory, recursively index children
    if entry.is_dir {
        match fs::read_dir(path) {
            Ok(entries) => {
                for dir_entry in entries.filter_map(|e| e.ok()) {
                    let child_path = dir_entry.path();
                    match traverse_and_insert(conn, &child_path, Some(entry.path.clone())) {
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
    let gitignore_manager: Option<Arc<GitignoreManager>> = if respect_gitignore {
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
    let gitignore_manager_for_filter: Option<Arc<GitignoreManager>> = gitignore_manager.clone();


    // Collect entries with parallel iteration
    let entries: Vec<FileEntry> = WalkDir::new(root)
        .follow_links(false) // Don't follow symlinks to avoid cycles
        .into_iter()
        .filter_entry(|entry| {
            if entry.path_is_symlink() {
                return false;
            }

            if let Some(ref manager) = gitignore_manager_for_filter {
                let is_dir = entry.file_type().is_dir();
                if manager.is_ignored_with_type(entry.path(), is_dir) {
                    ignored_count.fetch_add(1, Ordering::Relaxed);
                    return false;
                }
            }

            true
        })
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
                let current_path = entry_result
                    .as_ref()
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
    log::info!(
        "Collected {} entries, now inserting into database",
        total_entries
    );

    // Second pass: batch insert into database
    let mut conn = db
        .lock()
        .map_err(|e| AppError::Unknown(format!("Failed to lock database: {}", e)))?;

    // Sort entries by path depth to ensure parents are processed before children
    // Use Path::components() for reliable cross-platform depth calculation
    let mut sorted_entries = entries;
    sorted_entries.sort_by_key(|entry| Path::new(&entry.path).components().count());

    // Insert in batches of 1000
    const BATCH_SIZE: usize = 1000;
    let mut total_inserted = 0u64;

    for (batch_idx, chunk) in sorted_entries.chunks(BATCH_SIZE).enumerate() {
        let tx = conn.transaction()?;

        for entry in chunk {
            // Always use the true parent_path from the file system.
            // This ensures correct hierarchy even if parent isn't indexed yet.
            // When we later index the parent, orphaned children will be found correctly.
            let parent_path = &entry.parent_path;

            // Check if entry already exists
            let existing_fingerprint: Option<Option<String>> = tx
                .query_row(
                    "SELECT fingerprint FROM files WHERE path = ?",
                    params![&entry.path],
                    |row| row.get(0),
                )
                .optional()?;

            if let Some(existing_fp) = existing_fingerprint {
                // Entry exists - check if we need to update
                if existing_fp != entry.fingerprint {
                    tx.execute(
                        "UPDATE files SET size = ?, mtime = ?, fingerprint = ?, name = ?, parent_path = ? WHERE path = ?",
                        params![entry.size, entry.mtime, entry.fingerprint, entry.name, parent_path, entry.path],
                    )?;
                }
            } else {
                // Insert new entry
                tx.execute(
                    "INSERT INTO files (path, parent_path, name, size, mtime, is_dir, fingerprint)
                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                    params![
                        entry.path,
                        parent_path,
                        entry.name,
                        entry.size,
                        entry.mtime,
                        entry.is_dir as i32,
                        entry.fingerprint,
                    ],
                )?;
            }
        }

        tx.commit()?;
        total_inserted += chunk.len() as u64;
        log::debug!(
            "Inserted batch {} ({} entries)",
            batch_idx + 1,
            total_inserted
        );
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

    log::info!(
        "Parallel indexing complete: {} entries inserted, {} errors",
        total_inserted,
        error_count.load(Ordering::Relaxed)
    );

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

        // Verify parent_path relationships work correctly
        let child_path = temp_dir.path().join("folder1").join("file2.txt");
        let normalized_child_path = normalize_path(child_path.to_str().unwrap());
        let parent_path: Option<String> = conn
            .query_row(
                "SELECT parent_path FROM files WHERE path = ?",
                params![&normalized_child_path],
                |row| row.get(0),
            )
            .unwrap();

        let expected_parent = normalize_path(temp_dir.path().join("folder1").to_str().unwrap());
        assert_eq!(parent_path, Some(expected_parent));
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

        // Should still have only one entry for the file (path is primary key)
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

    #[test]
    fn test_path_as_primary_key() {
        let temp_dir = create_test_directory();
        let conn = create_test_db();
        let file_path = temp_dir.path().join("file1.txt");
        let path_str = normalize_path(file_path.to_str().unwrap());

        // Insert the file
        traverse_and_insert(&conn, &file_path, None).unwrap();

        // Verify we can query by path (primary key)
        let name: String = conn
            .query_row(
                "SELECT name FROM files WHERE path = ?",
                params![&path_str],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "file1.txt");

        // Try to insert duplicate path - should update instead
        traverse_and_insert(&conn, &file_path, None).unwrap();

        // Should still have only one entry
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM files WHERE path = ?",
                params![&path_str],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_hierarchical_indexing_with_same_filenames() {
        // Test scenario: files with identical names in different parent directories
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path();

        // Create structure: folder1/plan.md, folder2/plan.md, folder3/spec.md
        fs::create_dir_all(path.join("folder1")).unwrap();
        fs::create_dir_all(path.join("folder2")).unwrap();
        fs::create_dir_all(path.join("folder3")).unwrap();
        fs::write(path.join("folder1/plan.md"), "plan from folder1").unwrap();
        fs::write(path.join("folder2/plan.md"), "plan from folder2").unwrap();
        fs::write(path.join("folder3/spec.md"), "spec from folder3").unwrap();

        let conn = create_test_db();

        // Index all three folders (simulating drag-and-drop of individual folders)
        traverse_and_insert(&conn, &path.join("folder1"), None).unwrap();
        traverse_and_insert(&conn, &path.join("folder2"), None).unwrap();
        traverse_and_insert(&conn, &path.join("folder3"), None).unwrap();

        // Query for all entries
        let mut stmt = conn.prepare("SELECT path, parent_path, name FROM files ORDER BY path").unwrap();
        let entries: Vec<(String, Option<String>, String)> = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        // Should have: folder1, folder1/plan.md, folder2, folder2/plan.md, folder3, folder3/spec.md = 6 entries
        assert_eq!(entries.len(), 6, "Expected 6 entries (3 folders + 3 files)");

        // Find all plan.md files
        let plan_files: Vec<_> = entries.iter().filter(|(_, _, name)| name == "plan.md").collect();
        assert_eq!(plan_files.len(), 2, "Should have 2 plan.md files");

        // Verify each plan.md has different parent path
        let parent_paths: Vec<_> = plan_files.iter().map(|(_, parent, _)| parent.clone()).collect();
        assert_ne!(parent_paths[0], parent_paths[1], "plan.md files should have different parents");

        // Verify normalized paths use forward slashes
        for (path, _, _) in &entries {
            assert!(!path.contains('\\'), "Path should not contain backslashes: {}", path);
        }

        // Verify we can query children of each folder
        let folder1_path = normalize_path(path.join("folder1").to_str().unwrap());
        let folder2_path = normalize_path(path.join("folder2").to_str().unwrap());

        let folder1_children: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM files WHERE parent_path = ?",
                params![&folder1_path],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(folder1_children, 1, "folder1 should have 1 child");

        let folder2_children: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM files WHERE parent_path = ?",
                params![&folder2_path],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(folder2_children, 1, "folder2 should have 1 child");
    }

    mod search_filter_tests {
        use super::*;

        #[test]
        fn test_parse_empty_query() {
            let f = parse_search_query("");
            assert!(f.file_name.is_none());
            assert!(f.directory_name.is_none());
            assert!(f.regex_pattern.is_none());
            assert!(f.plain_text.is_none());
        }

        #[test]
        fn test_parse_whitespace_query() {
            let f = parse_search_query("   ");
            assert!(f.file_name.is_none());
            assert!(f.plain_text.is_none());
        }

        #[test]
        fn test_parse_file_prefix() {
            let f = parse_search_query("file:App");
            assert_eq!(f.file_name.as_deref(), Some("App"));
            assert!(f.plain_text.is_none());
        }

        #[test]
        fn test_parse_dir_prefix() {
            let f = parse_search_query("dir:src");
            assert_eq!(f.directory_name.as_deref(), Some("src"));
            assert!(f.plain_text.is_none());
        }

        #[test]
        fn test_parse_combined_file_dir() {
            let f = parse_search_query("file:App dir:src");
            assert_eq!(f.file_name.as_deref(), Some("App"));
            assert_eq!(f.directory_name.as_deref(), Some("src"));
        }

        #[test]
        fn test_parse_plain_text() {
            let f = parse_search_query("test");
            assert_eq!(f.plain_text.as_deref(), Some("test"));
            assert!(f.regex_pattern.is_none());
        }

        #[test]
        fn test_parse_regex_pattern() {
            let f = parse_search_query("\\.test\\.ts$");
            assert!(f.regex_pattern.is_some());
            assert!(f.plain_text.is_none());
        }

        #[test]
        fn test_parse_invalid_regex_falls_back_to_plain() {
            let f = parse_search_query("[invalid");
            assert!(f.regex_pattern.is_none());
            assert_eq!(f.plain_text.as_deref(), Some("[invalid"));
        }

        #[test]
        fn test_parse_mixed_file_and_plain() {
            let f = parse_search_query("file:App test");
            assert_eq!(f.file_name.as_deref(), Some("App"));
            assert_eq!(f.plain_text.as_deref(), Some("test"));
        }

        #[test]
        fn test_parse_case_insensitive_prefix() {
            let f = parse_search_query("FILE:App DIR:src");
            assert_eq!(f.file_name.as_deref(), Some("App"));
            assert_eq!(f.directory_name.as_deref(), Some("src"));
        }
    }

    mod search_integration_tests {
        use super::*;

        fn populate_test_db(conn: &Connection) {
            // Create a realistic file structure:
            // /project/src/App.tsx
            // /project/src/components/Header.tsx
            // /project/src/components/Footer.tsx
            // /project/src/lib/utils.ts
            // /project/conductor/tracks/track1.md
            // /project/conductor/tracks/track2.md
            // /project/conductor/plan.md
            // /project/docs/plan.md  (duplicate name)
            // /project/tests/app.test.ts
            // /project/node_modules/react/index.js  (dir)
            let entries = vec![
                ("/project", None, "project", true),
                ("/project/src", Some("/project"), "src", true),
                ("/project/src/App.tsx", Some("/project/src"), "App.tsx", false),
                ("/project/src/components", Some("/project/src"), "components", true),
                ("/project/src/components/Header.tsx", Some("/project/src/components"), "Header.tsx", false),
                ("/project/src/components/Footer.tsx", Some("/project/src/components"), "Footer.tsx", false),
                ("/project/src/lib", Some("/project/src"), "lib", true),
                ("/project/src/lib/utils.ts", Some("/project/src/lib"), "utils.ts", false),
                ("/project/conductor", Some("/project"), "conductor", true),
                ("/project/conductor/tracks", Some("/project/conductor"), "tracks", true),
                ("/project/conductor/tracks/track1.md", Some("/project/conductor/tracks"), "track1.md", false),
                ("/project/conductor/tracks/track2.md", Some("/project/conductor/tracks"), "track2.md", false),
                ("/project/conductor/plan.md", Some("/project/conductor"), "plan.md", false),
                ("/project/docs", Some("/project"), "docs", true),
                ("/project/docs/plan.md", Some("/project/docs"), "plan.md", false),
                ("/project/tests", Some("/project"), "tests", true),
                ("/project/tests/app.test.ts", Some("/project/tests"), "app.test.ts", false),
            ];

            for (path, parent, name, is_dir) in entries {
                conn.execute(
                    "INSERT INTO files (path, parent_path, name, size, mtime, is_dir, fingerprint)
                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                    params![path, parent, name, if is_dir { None::<i64> } else { Some(100) }, Some(1000i64), is_dir as i32, None::<String>],
                ).unwrap();
            }
        }

        #[test]
        fn test_search_plain_text_finds_by_name() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "track1").unwrap();
            assert!(!results.is_empty());
            assert_eq!(results[0].name, "track1.md");
        }

        #[test]
        fn test_search_plain_text_ordered_by_score() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "plan").unwrap();
            // Should find both plan.md files, sorted by score DESC
            assert!(results.len() >= 2);
            assert!(results[0].score >= results[1].score);
        }

        #[test]
        fn test_search_exact_name_match_scores_higher() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "App.tsx").unwrap();
            // Exact name match should score highest
            assert!(!results.is_empty());
            assert_eq!(results[0].name, "App.tsx");
            // app.test.ts also has "App" in path but should score lower
            if results.len() > 1 {
                assert!(results[0].score > results[1].score);
            }
        }

        #[test]
        fn test_search_file_prefix_only_matches_files() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "file:App").unwrap();
            // Should find App.tsx (file), not any directory
            assert!(!results.is_empty());
            for r in &results {
                assert!(!r.is_dir, "file: prefix should only return files, got dir: {}", r.name);
            }
            assert!(results.iter().any(|r| r.name == "App.tsx"));
        }

        #[test]
        fn test_search_dir_prefix_only_matches_dirs() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "dir:src").unwrap();
            // Should find the "src" directory itself
            assert!(!results.is_empty());
            for r in &results {
                assert!(r.is_dir, "dir: prefix should only return directories, got file: {}", r.name);
            }
            assert!(results.iter().any(|r| r.name == "src"));
        }

        #[test]
        fn test_search_dir_prefix_partial_match() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "dir:track").unwrap();
            assert!(!results.is_empty());
            assert!(results.iter().any(|r| r.name == "tracks"));
        }

        #[test]
        fn test_search_combined_file_and_dir() {
            let conn = create_test_db();
            populate_test_db(&conn);
            // file:plan dir:conductor means: find files named "plan" inside "conductor" directory
            let results = search_db(&conn, "file:plan dir:conductor").unwrap();
            assert!(!results.is_empty());
            // Should find conductor/plan.md but NOT docs/plan.md
            assert!(results.iter().any(|r| r.path == "/project/conductor/plan.md"));
            assert!(!results.iter().any(|r| r.path == "/project/docs/plan.md"));
        }

        #[test]
        fn test_search_empty_returns_empty() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "").unwrap();
            assert!(results.is_empty());
        }

        #[test]
        fn test_search_no_match_returns_empty() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "xyznonexistent").unwrap();
            assert!(results.is_empty());
        }

        #[test]
        fn test_search_case_insensitive() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "app").unwrap();
            assert!(!results.is_empty());
            assert!(results.iter().any(|r| r.name == "App.tsx"));
        }

        #[test]
        fn test_search_results_have_scores() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "Header").unwrap();
            assert!(!results.is_empty());
            // All results should have a positive score
            for r in &results {
                assert!(r.score > 0, "Result {} should have positive score", r.name);
            }
        }

        #[test]
        fn test_search_regex_pattern() {
            let conn = create_test_db();
            populate_test_db(&conn);
            let results = search_db(&conn, "\\.tsx$").unwrap();
            // Should find all .tsx files
            assert!(!results.is_empty());
            for r in &results {
                assert!(r.name.ends_with(".tsx"), "Expected .tsx file, got {}", r.name);
            }
        }
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
