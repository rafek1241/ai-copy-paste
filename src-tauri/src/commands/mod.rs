pub mod extraction;
pub mod indexing;

// Re-export all commands for easy access
pub use extraction::{extract_text, get_supported_file_types};
pub use indexing::{get_children, index_folder, search_path};
