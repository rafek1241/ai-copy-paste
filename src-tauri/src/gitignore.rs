//! Gitignore pattern parsing and filtering module
//!
//! This module provides functionality to read .gitignore files and filter
//! files/directories based on the patterns defined in them.

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Manages .gitignore patterns for directory traversal
pub struct GitignoreManager {
    /// Cached gitignore matchers per directory
    gitignores: HashMap<PathBuf, Gitignore>,
    /// Root directory being indexed
    root: PathBuf,
}

impl GitignoreManager {
    /// Create a new GitignoreManager for the given root directory
    pub fn new(root: &Path) -> Self {
        Self {
            gitignores: HashMap::new(),
            root: root.to_path_buf(),
        }
    }

    /// Load .gitignore patterns from a file
    pub fn add_patterns_from_file(&mut self, gitignore_path: &Path) -> Result<(), String> {
        let parent = gitignore_path
            .parent()
            .ok_or_else(|| "Invalid gitignore path".to_string())?;

        let mut builder = GitignoreBuilder::new(parent);
        if let Some(err) = builder.add(gitignore_path) {
            log::warn!(
                "Error parsing .gitignore at {:?}: {}",
                gitignore_path,
                err
            );
            // Continue with partial patterns if some were valid
        }

        match builder.build() {
            Ok(gitignore) => {
                self.gitignores.insert(parent.to_path_buf(), gitignore);
                log::debug!("Loaded .gitignore from {:?}", gitignore_path);
                Ok(())
            }
            Err(e) => {
                log::warn!("Failed to build gitignore from {:?}: {}", gitignore_path, e);
                Err(format!("Failed to build gitignore: {}", e))
            }
        }
    }

    /// Check if a path should be ignored based on loaded .gitignore patterns
    /// Returns true if the path should be ignored
    pub fn is_ignored(&self, path: &Path) -> bool {
        // Never ignore .gitignore files themselves
        if path.file_name().map(|n| n == ".gitignore").unwrap_or(false) {
            return false;
        }

        let is_dir = path.is_dir();

        // Check all gitignore files from root to the path's parent
        // Patterns closer to the file have higher priority (checked last)
        let mut current = Some(self.root.as_path());
        let mut ignored = false;

        while let Some(dir) = current {
            if let Some(gitignore) = self.gitignores.get(dir) {
                match gitignore.matched(path, is_dir) {
                    ignore::Match::None => {}
                    ignore::Match::Ignore(_) => ignored = true,
                    ignore::Match::Whitelist(_) => ignored = false,
                }
            }

            // Move to next directory in path towards the target
            if dir == path || path.starts_with(dir) {
                // Find the next directory between current and path
                let relative = path.strip_prefix(dir).ok();
                if let Some(rel) = relative {
                    if let Some(first_component) = rel.components().next() {
                        let next_dir = dir.join(first_component);
                        if next_dir != path && next_dir.is_dir() {
                            current = Some(self.gitignores.get(&next_dir).map(|_| &next_dir).unwrap_or(dir));
                            if current == Some(dir) {
                                break;
                            }
                            continue;
                        }
                    }
                }
            }
            break;
        }

        // Re-check with all gitignores in the path hierarchy for correct precedence
        let mut ancestor = path.parent();
        while let Some(dir) = ancestor {
            if !dir.starts_with(&self.root) {
                break;
            }
            if let Some(gitignore) = self.gitignores.get(dir) {
                match gitignore.matched(path, is_dir) {
                    ignore::Match::None => {}
                    ignore::Match::Ignore(_) => ignored = true,
                    ignore::Match::Whitelist(_) => ignored = false,
                }
            }
            ancestor = dir.parent();
        }

        ignored
    }

    /// Check if a path should be ignored, given explicit is_dir information
    /// This is useful during traversal when we already know if the entry is a directory
    pub fn is_ignored_with_type(&self, path: &Path, is_dir: bool) -> bool {
        // Never ignore .gitignore files themselves
        if path.file_name().map(|n| n == ".gitignore").unwrap_or(false) {
            return false;
        }

        let mut ignored = false;

        // Check all gitignore files from ancestors of this path
        let mut ancestor = path.parent();
        while let Some(dir) = ancestor {
            if !dir.starts_with(&self.root) && dir != self.root {
                break;
            }
            if let Some(gitignore) = self.gitignores.get(dir) {
                match gitignore.matched(path, is_dir) {
                    ignore::Match::None => {}
                    ignore::Match::Ignore(_) => ignored = true,
                    ignore::Match::Whitelist(_) => ignored = false,
                }
            }
            if dir == self.root {
                break;
            }
            ancestor = dir.parent();
        }

        ignored
    }

    /// Discover and load all .gitignore files in the directory tree
    /// This should be called during the first pass of directory traversal
    pub fn discover_gitignores(&mut self, root: &Path) -> Result<usize, String> {
        use walkdir::WalkDir;

        let mut count = 0;

        for entry in WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.file_name().map(|n| n == ".gitignore").unwrap_or(false) {
                if self.add_patterns_from_file(path).is_ok() {
                    count += 1;
                }
            }
        }

        log::info!("Discovered {} .gitignore files in {:?}", count, root);
        Ok(count)
    }

    /// Clear all loaded patterns
    pub fn clear(&mut self) {
        self.gitignores.clear();
    }

    /// Get the number of loaded gitignore files
    pub fn gitignore_count(&self) -> usize {
        self.gitignores.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_directory() -> TempDir {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path();

        // Create test directory structure
        fs::create_dir_all(path.join("src")).unwrap();
        fs::create_dir_all(path.join("node_modules/package")).unwrap();
        fs::create_dir_all(path.join("build")).unwrap();

        // Create test files
        fs::write(path.join("file.txt"), "content").unwrap();
        fs::write(path.join("file.log"), "log content").unwrap();
        fs::write(path.join("src/main.rs"), "fn main() {}").unwrap();
        fs::write(path.join("node_modules/package/index.js"), "module.exports = {}").unwrap();
        fs::write(path.join("build/output.js"), "compiled").unwrap();

        temp_dir
    }

    #[test]
    fn test_new_gitignore_manager() {
        let temp_dir = create_test_directory();
        let manager = GitignoreManager::new(temp_dir.path());
        assert_eq!(manager.gitignore_count(), 0);
    }

    #[test]
    fn test_add_patterns_from_file() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "*.log\nnode_modules/\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        assert_eq!(manager.gitignore_count(), 1);
    }

    #[test]
    fn test_basic_wildcard_pattern() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "*.log\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // .log files should be ignored
        assert!(manager.is_ignored(&temp_dir.path().join("file.log")));
        // .txt files should not be ignored
        assert!(!manager.is_ignored(&temp_dir.path().join("file.txt")));
    }

    #[test]
    fn test_directory_pattern() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "node_modules/\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // node_modules directory should be ignored
        assert!(manager.is_ignored(&temp_dir.path().join("node_modules")));
        // Files inside node_modules should also be ignored
        assert!(manager.is_ignored(&temp_dir.path().join("node_modules/package/index.js")));
    }

    #[test]
    fn test_double_star_pattern() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "**/build/\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // build directory should be ignored
        assert!(manager.is_ignored(&temp_dir.path().join("build")));
    }

    #[test]
    fn test_negation_pattern() {
        let temp_dir = create_test_directory();
        fs::write(temp_dir.path().join("important.log"), "important").unwrap();

        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "*.log\n!important.log\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // Regular .log files should be ignored
        assert!(manager.is_ignored(&temp_dir.path().join("file.log")));
        // important.log should NOT be ignored (negation pattern)
        assert!(!manager.is_ignored(&temp_dir.path().join("important.log")));
    }

    #[test]
    fn test_gitignore_file_not_ignored() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "*\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // .gitignore file should never be ignored
        assert!(!manager.is_ignored(&gitignore_path));
    }

    #[test]
    fn test_comment_lines() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "# This is a comment\n*.log\n# Another comment\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // Comments should be ignored, pattern should work
        assert!(manager.is_ignored(&temp_dir.path().join("file.log")));
    }

    #[test]
    fn test_empty_gitignore() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // Nothing should be ignored with empty .gitignore
        assert!(!manager.is_ignored(&temp_dir.path().join("file.log")));
        assert!(!manager.is_ignored(&temp_dir.path().join("file.txt")));
    }

    #[test]
    fn test_discover_gitignores() {
        let temp_dir = create_test_directory();

        // Create .gitignore in root
        fs::write(temp_dir.path().join(".gitignore"), "*.log\n").unwrap();
        // Create .gitignore in subdirectory
        fs::write(temp_dir.path().join("src/.gitignore"), "*.bak\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        let count = manager.discover_gitignores(temp_dir.path()).unwrap();

        assert_eq!(count, 2);
        assert_eq!(manager.gitignore_count(), 2);
    }

    #[test]
    fn test_nested_gitignore_precedence() {
        let temp_dir = create_test_directory();

        // Root .gitignore ignores all .log files
        fs::write(temp_dir.path().join(".gitignore"), "*.log\n").unwrap();
        // src/.gitignore whitelists debug.log
        fs::write(temp_dir.path().join("src/.gitignore"), "!debug.log\n").unwrap();

        fs::write(temp_dir.path().join("src/debug.log"), "debug info").unwrap();
        fs::write(temp_dir.path().join("src/error.log"), "error info").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.discover_gitignores(temp_dir.path()).unwrap();

        // debug.log in src should NOT be ignored (whitelisted in nested .gitignore)
        assert!(!manager.is_ignored(&temp_dir.path().join("src/debug.log")));
        // error.log in src should be ignored (matches root pattern)
        assert!(manager.is_ignored(&temp_dir.path().join("src/error.log")));
    }

    #[test]
    fn test_clear_patterns() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "*.log\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();
        assert_eq!(manager.gitignore_count(), 1);

        manager.clear();
        assert_eq!(manager.gitignore_count(), 0);

        // After clearing, nothing should be ignored
        assert!(!manager.is_ignored(&temp_dir.path().join("file.log")));
    }

    #[test]
    fn test_is_ignored_with_type() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "build/\n").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // Directory patterns should only match directories
        assert!(manager.is_ignored_with_type(&temp_dir.path().join("build"), true));
    }

    #[test]
    fn test_specific_file_pattern() {
        let temp_dir = create_test_directory();
        let gitignore_path = temp_dir.path().join(".gitignore");
        fs::write(&gitignore_path, "Cargo.lock\n").unwrap();

        fs::write(temp_dir.path().join("Cargo.lock"), "lock content").unwrap();

        let mut manager = GitignoreManager::new(temp_dir.path());
        manager.add_patterns_from_file(&gitignore_path).unwrap();

        // Specific file should be ignored
        assert!(manager.is_ignored(&temp_dir.path().join("Cargo.lock")));
    }
}
