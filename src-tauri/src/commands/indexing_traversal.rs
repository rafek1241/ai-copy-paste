use super::{FileEntry, IndexProgress};
use crate::gitignore::GitignoreManager;
use rayon::prelude::*;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

pub(crate) struct TraversalOutcome {
    pub(crate) entries: Vec<FileEntry>,
    pub(crate) ignored_count: u64,
    pub(crate) error_count: u64,
}

pub(crate) fn collect_entries(
    root: &Path,
    app: &AppHandle,
    gitignore_manager: Option<Arc<GitignoreManager>>,
) -> TraversalOutcome {
    let processed_count = Arc::new(AtomicU64::new(0));
    let error_count = Arc::new(AtomicU64::new(0));
    let ignored_count = Arc::new(AtomicU64::new(0));
    let last_progress_time = Arc::new(Mutex::new(Instant::now()));

    let gitignore_manager_for_filter = gitignore_manager.clone();
    let entries: Vec<FileEntry> = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            if entry.path_is_symlink() {
                return false;
            }

            if let Some(manager) = &gitignore_manager_for_filter {
                let is_dir = entry.file_type().is_dir();
                if manager.is_ignored_with_type(entry.path(), is_dir) {
                    ignored_count.fetch_add(1, Ordering::Relaxed);
                    return false;
                }
            }

            true
        })
        .par_bridge()
        .filter_map(|entry_result| {
            let count = processed_count.fetch_add(1, Ordering::Relaxed);
            let should_emit = should_emit_progress(&last_progress_time);

            if should_emit {
                let current_path = entry_result
                    .as_ref()
                    .map(|entry| entry.path().to_string_lossy().to_string())
                    .unwrap_or_else(|_| "Unknown".to_string());

                let progress = IndexProgress {
                    processed: count,
                    total_estimate: count + 100,
                    current_path,
                    errors: error_count.load(Ordering::Relaxed),
                };

                if let Err(error) = app.emit("indexing-progress", &progress) {
                    log::warn!("Failed to emit progress event: {}", error);
                }
            }

            match entry_result {
                Ok(entry) => match FileEntry::from_dir_entry(&entry) {
                    Ok(file_entry) => Some(file_entry),
                    Err(error) => {
                        error_count.fetch_add(1, Ordering::Relaxed);
                        log::warn!("Failed to process entry {:?}: {}", entry.path(), error);
                        None
                    }
                },
                Err(error) => {
                    error_count.fetch_add(1, Ordering::Relaxed);
                    log::warn!("Error during traversal: {}", error);
                    None
                }
            }
        })
        .collect();

    TraversalOutcome {
        entries,
        ignored_count: ignored_count.load(Ordering::Relaxed),
        error_count: error_count.load(Ordering::Relaxed),
    }
}

fn should_emit_progress(last_progress_time: &Arc<Mutex<Instant>>) -> bool {
    match last_progress_time.lock() {
        Ok(mut last_time) => {
            let now = Instant::now();
            if now.duration_since(*last_time) > Duration::from_millis(100) {
                *last_time = now;
                true
            } else {
                false
            }
        }
        Err(_) => true,
    }
}
