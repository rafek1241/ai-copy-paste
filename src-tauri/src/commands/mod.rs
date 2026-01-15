pub mod indexing;
pub mod prompts;

// Re-export all commands for easy access
pub use indexing::{get_children, index_folder, search_path};
pub use prompts::{build_prompt_from_files, get_file_content, get_file_contents, get_templates};
