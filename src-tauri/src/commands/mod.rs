pub mod indexing;
pub mod browser;

// Re-export all commands for easy access
pub use indexing::{get_children, index_folder, search_path};
pub use browser::{launch_browser, get_available_interfaces};
