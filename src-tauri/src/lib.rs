mod cache;
mod commands;
mod db;
mod error;
pub mod gitignore;
mod sensitive;
mod templates;

use cache::TextCache;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    log::info!("Starting AI Context Collector application");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // Initialize database
            let db = db::init_db(app.handle())?;
            app.manage(db);
            log::info!("Database initialized successfully");

            // Initialize text cache
            let cache_dir = app
                .path()
                .app_cache_dir()
                .map_err(|e| format!("Failed to get cache directory: {}", e))?
                .join("text_cache");
            
            let text_cache = TextCache::new(cache_dir)
                .map_err(|e| format!("Failed to initialize text cache: {}", e))?;
            app.manage(Mutex::new(text_cache));
            log::info!("Text cache initialized successfully");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::indexing::index_folder,
            commands::indexing::get_children,
            commands::indexing::search_path,
            commands::indexing::clear_index,
            commands::browser::launch_browser,
            commands::browser::get_available_interfaces,
            commands::extraction::extract_text,
            commands::extraction::get_supported_file_types,
            commands::prompts::get_templates,
            commands::prompts::get_file_content,
            commands::prompts::get_file_contents,
            commands::prompts::build_prompt_from_files,
            commands::history::save_history,
            commands::history::load_history,
            commands::history::validate_history_paths,
            commands::history::delete_history,
            commands::history::clear_history,
            commands::settings::save_setting,
            commands::settings::get_setting,
            commands::settings::get_all_settings,
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::settings::export_settings,
            commands::settings::import_settings,
            commands::settings::delete_setting,
            commands::settings::reset_settings,
            commands::sensitive::get_sensitive_patterns,
            commands::sensitive::get_sensitive_data_enabled,
            commands::sensitive::set_sensitive_data_enabled,
            commands::sensitive::get_prevent_selection,
            commands::sensitive::set_prevent_selection,
            commands::sensitive::add_custom_pattern,
            commands::sensitive::delete_custom_pattern,
            commands::sensitive::toggle_pattern_enabled,
            commands::sensitive::scan_files_sensitive,
            commands::sensitive::get_sensitive_marked_paths,
            commands::sensitive::validate_regex_pattern,
            commands::sensitive::test_pattern,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
