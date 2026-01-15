mod cache;
mod commands;
mod db;
mod error;

use cache::TextCache;
use db::DbConnection;
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
            commands::index_folder,
            commands::get_children,
            commands::search_path,
            commands::extract_text,
            commands::get_supported_file_types,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
