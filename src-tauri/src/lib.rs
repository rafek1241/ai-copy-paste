mod commands;
mod db;
mod error;

use db::DbConnection;
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
        .setup(|app| {
            // Initialize database
            let db = db::init_db(app.handle())?;
            app.manage(db);
            log::info!("Database initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::index_folder,
            commands::get_children,
            commands::search_path,
            commands::launch_browser,
            commands::get_available_interfaces,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
