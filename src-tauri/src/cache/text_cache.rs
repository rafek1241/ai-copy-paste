use crate::error::AppResult;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// LRU cache for extracted text with disk persistence
/// Max size: ~100MB
pub struct TextCache {
    cache_dir: PathBuf,
    index: HashMap<String, CacheEntry>,
    max_size_bytes: u64,
    current_size_bytes: u64,
}

#[derive(Debug, Clone)]
struct CacheEntry {
    fingerprint: String,
    size_bytes: u64,
    last_accessed: u64,
}

impl TextCache {
    const MAX_CACHE_SIZE: u64 = 100 * 1024 * 1024; // 100MB

    /// Create a new text cache in the specified directory
    pub fn new(cache_dir: PathBuf) -> AppResult<Self> {
        // Create cache directory if it doesn't exist
        fs::create_dir_all(&cache_dir)?;

        let mut cache = TextCache {
            cache_dir,
            index: HashMap::new(),
            max_size_bytes: Self::MAX_CACHE_SIZE,
            current_size_bytes: 0,
        };

        // Load existing cache index
        cache.rebuild_index()?;

        Ok(cache)
    }

    /// Get cached text for a file path with given fingerprint
    pub fn get(&mut self, path: &str, fingerprint: &str) -> AppResult<Option<String>> {
        let cache_key = Self::cache_key(path);

        if let Some(entry) = self.index.get(&cache_key) {
            // Check if fingerprint matches
            if entry.fingerprint == fingerprint {
                // Update last accessed time
                let now = Self::current_timestamp();
                if let Some(entry) = self.index.get_mut(&cache_key) {
                    entry.last_accessed = now;
                }

                // Read from disk
                let cache_file = self.cache_file_path(&cache_key);
                if cache_file.exists() {
                    let text = fs::read_to_string(&cache_file)?;
                    log::debug!("Cache hit for: {}", path);
                    return Ok(Some(text));
                }
            } else {
                // Fingerprint mismatch - invalidate
                log::debug!("Cache fingerprint mismatch for: {}", path);
                self.remove(&cache_key)?;
            }
        }

        log::debug!("Cache miss for: {}", path);
        Ok(None)
    }

    /// Store extracted text in cache
    pub fn put(&mut self, path: &str, fingerprint: &str, text: &str) -> AppResult<()> {
        let cache_key = Self::cache_key(path);
        let cache_file = self.cache_file_path(&cache_key);

        // Write to disk
        fs::write(&cache_file, text)?;

        let size_bytes = text.len() as u64;
        let now = Self::current_timestamp();

        // Update index
        if let Some(old_entry) = self.index.get(&cache_key) {
            self.current_size_bytes -= old_entry.size_bytes;
        }

        self.index.insert(
            cache_key.clone(),
            CacheEntry {
                fingerprint: fingerprint.to_string(),
                size_bytes,
                last_accessed: now,
            },
        );

        self.current_size_bytes += size_bytes;

        // Evict if necessary
        self.evict_if_needed()?;

        log::debug!("Cached text for: {} ({} bytes)", path, size_bytes);
        Ok(())
    }

    /// Remove a cache entry
    fn remove(&mut self, cache_key: &str) -> AppResult<()> {
        if let Some(entry) = self.index.remove(cache_key) {
            self.current_size_bytes -= entry.size_bytes;
            let cache_file = self.cache_file_path(cache_key);
            if cache_file.exists() {
                fs::remove_file(cache_file)?;
            }
        }
        Ok(())
    }

    /// Evict least recently used entries until under max size
    fn evict_if_needed(&mut self) -> AppResult<()> {
        while self.current_size_bytes > self.max_size_bytes {
            // Find least recently used entry
            let lru_key = self
                .index
                .iter()
                .min_by_key(|(_, entry)| entry.last_accessed)
                .map(|(key, _)| key.clone());

            if let Some(key) = lru_key {
                log::debug!("Evicting LRU cache entry: {}", key);
                self.remove(&key)?;
            } else {
                break;
            }
        }
        Ok(())
    }

    /// Rebuild cache index from disk
    fn rebuild_index(&mut self) -> AppResult<()> {
        if !self.cache_dir.exists() {
            return Ok(());
        }

        for entry in fs::read_dir(&self.cache_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Ok(metadata) = fs::metadata(&path) {
                    let size_bytes = metadata.len();
                    let last_accessed = metadata
                        .modified()
                        .ok()
                        .and_then(|t| {
                            t.duration_since(std::time::SystemTime::UNIX_EPOCH)
                                .ok()
                        })
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        // We don't have fingerprint info on rebuild, so set empty
                        // It will be invalidated on next access if fingerprint doesn't match
                        self.index.insert(
                            file_name.to_string(),
                            CacheEntry {
                                fingerprint: String::new(),
                                size_bytes,
                                last_accessed,
                            },
                        );
                        self.current_size_bytes += size_bytes;
                    }
                }
            }
        }

        log::info!(
            "Cache index rebuilt: {} entries, {} bytes",
            self.index.len(),
            self.current_size_bytes
        );

        // Evict if over limit
        self.evict_if_needed()?;

        Ok(())
    }

    /// Generate cache key from file path
    fn cache_key(path: &str) -> String {
        // Simple hash-like key generation
        format!("{:x}", hash_string(path))
    }

    /// Get cache file path for a cache key
    fn cache_file_path(&self, cache_key: &str) -> PathBuf {
        self.cache_dir.join(format!("{}.txt", cache_key))
    }

    /// Get current timestamp
    fn current_timestamp() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }
}

/// Simple hash function for cache keys
fn hash_string(input: &str) -> u64 {
    let mut hash: u64 = 0;
    for (i, byte) in input.bytes().enumerate() {
        hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
        if i % 8 == 7 {
            hash = hash.wrapping_mul(0x517cc1b727220a95);
        }
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_cache_put_and_get() {
        let temp_dir = env::temp_dir().join("test_cache");
        let _ = fs::remove_dir_all(&temp_dir);

        let mut cache = TextCache::new(temp_dir.clone()).unwrap();

        let path = "/test/file.txt";
        let fingerprint = "12345_1000";
        let text = "Hello, World!";

        // Put text in cache
        cache.put(path, fingerprint, text).unwrap();

        // Get text from cache
        let result = cache.get(path, fingerprint).unwrap();
        assert_eq!(result, Some(text.to_string()));

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_cache_fingerprint_mismatch() {
        let temp_dir = env::temp_dir().join("test_cache_fp");
        let _ = fs::remove_dir_all(&temp_dir);

        let mut cache = TextCache::new(temp_dir.clone()).unwrap();

        let path = "/test/file.txt";
        let text = "Hello, World!";

        // Put with fingerprint1
        cache.put(path, "fp1", text).unwrap();

        // Try to get with different fingerprint
        let result = cache.get(path, "fp2").unwrap();
        assert_eq!(result, None);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
