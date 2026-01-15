use crate::db::DbConnection;
use crate::error::AppResult;
use crate::templates::{build_prompt, get_builtin_templates, PromptTemplate};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildPromptRequest {
    pub template_id: String,
    pub custom_instructions: Option<String>,
    pub file_ids: Vec<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildPromptResponse {
    pub prompt: String,
    pub file_count: usize,
    pub total_chars: usize,
}

/// Get all available prompt templates
#[tauri::command]
pub async fn get_templates() -> Result<Vec<PromptTemplate>, String> {
    Ok(get_builtin_templates())
}

/// Read file content from the filesystem
fn read_file_content(path: &str) -> AppResult<String> {
    let content = fs::read_to_string(path)?;
    Ok(content)
}

/// Build a prompt from selected files and template
#[tauri::command]
pub async fn build_prompt_from_files(
    request: BuildPromptRequest,
    db: tauri::State<'_, DbConnection>,
) -> Result<BuildPromptResponse, String> {
    log::info!(
        "Building prompt with template '{}' for {} files",
        request.template_id,
        request.file_ids.len()
    );

    let conn = db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    // Get file paths from database
    let mut file_contents = Vec::new();
    let mut total_chars = 0;

    for file_id in &request.file_ids {
        let path: String = conn
            .query_row(
                "SELECT path FROM files WHERE id = ? AND is_dir = 0",
                params![file_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to get file path for id {}: {}", file_id, e))?;

        match read_file_content(&path) {
            Ok(content) => {
                total_chars += content.len();
                file_contents.push((path.clone(), content));
            }
            Err(e) => {
                log::warn!("Failed to read file {}: {}", path, e);
                file_contents.push((path.clone(), format!("[Error reading file: {}]", e)));
            }
        }
    }

    // Build the prompt
    let prompt = build_prompt(
        &request.template_id,
        request.custom_instructions.as_deref(),
        &file_contents,
    )?;

    Ok(BuildPromptResponse {
        prompt,
        file_count: file_contents.len(),
        total_chars,
    })
}

/// Get file content by ID
#[tauri::command]
pub async fn get_file_content(
    file_id: i64,
    db: tauri::State<'_, DbConnection>,
) -> Result<FileContent, String> {
    let conn = db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let path: String = conn
        .query_row(
            "SELECT path FROM files WHERE id = ? AND is_dir = 0",
            params![file_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get file path: {}", e))?;

    let content = read_file_content(&path)
        .map_err(|e| format!("Failed to read file content: {}", e))?;

    Ok(FileContent { path, content })
}

/// Get multiple file contents by IDs
#[tauri::command]
pub async fn get_file_contents(
    file_ids: Vec<i64>,
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<FileContent>, String> {
    let conn = db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut contents = Vec::new();

    for file_id in file_ids {
        let path: String = conn
            .query_row(
                "SELECT path FROM files WHERE id = ? AND is_dir = 0",
                params![file_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to get file path for id {}: {}", file_id, e))?;

        match read_file_content(&path) {
            Ok(content) => {
                contents.push(FileContent { path, content });
            }
            Err(e) => {
                log::warn!("Failed to read file {}: {}", path, e);
            }
        }
    }

    Ok(contents)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_templates() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let templates = get_templates().await.unwrap();
            assert!(templates.len() >= 4);
        });
    }
}
