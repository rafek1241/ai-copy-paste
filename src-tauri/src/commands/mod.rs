pub mod extraction;
pub mod indexing;
pub mod browser;
pub mod prompts;
pub mod history;
pub mod settings;
pub mod sensitive;

// Re-export all commands for easy access
pub use extraction::{extract_text, get_supported_file_types};
pub use indexing::{get_children, index_folder, search_path};
pub use browser::{launch_browser, get_available_interfaces};
pub use prompts::{build_prompt_from_files, get_file_content, get_file_contents, get_templates};
pub use history::{save_history, load_history, validate_history_paths, delete_history, clear_history};
pub use settings::{
    save_setting, get_setting, get_all_settings, load_settings, save_settings,
    export_settings, import_settings, delete_setting, reset_settings,
};
pub use sensitive::{
    get_sensitive_patterns, get_sensitive_data_enabled, set_sensitive_data_enabled,
    get_prevent_selection, set_prevent_selection,
    add_custom_pattern, delete_custom_pattern, toggle_pattern_enabled,
    scan_files_sensitive, get_sensitive_marked_paths, validate_regex_pattern, test_pattern,
};
