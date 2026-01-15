pub mod indexing;

// Re-export all commands for easy access
pub use indexing::{get_children, index_folder, search_path};
