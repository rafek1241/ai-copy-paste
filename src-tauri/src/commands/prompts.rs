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
    pub file_paths: Vec<String>,
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
        request.file_paths.len()
    );

    let conn = db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    // Verify files exist in database and read content
    let mut file_contents = Vec::new();
    let mut total_chars = 0;

    for file_path in &request.file_paths {
        // Verify file exists in index and is not a directory
        let is_valid: bool = conn
            .query_row(
                "SELECT 1 FROM files WHERE path = ? AND is_dir = 0",
                params![file_path],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !is_valid {
            log::warn!("File not in index or is a directory: {}", file_path);
            continue;
        }

        match read_file_content(file_path) {
            Ok(content) => {
                total_chars += content.len();
                file_contents.push((file_path.clone(), content));
            }
            Err(e) => {
                log::warn!("Failed to read file {}: {}", file_path, e);
                file_contents.push((file_path.clone(), format!("[Error reading file: {}]", e)));
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

/// Get file content by path
#[tauri::command]
pub async fn get_file_content(
    file_path: String,
    db: tauri::State<'_, DbConnection>,
) -> Result<FileContent, String> {
    let conn = db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    // Verify file exists in index and is not a directory
    conn.query_row(
        "SELECT 1 FROM files WHERE path = ? AND is_dir = 0",
        params![&file_path],
        |_| Ok(()),
    )
    .map_err(|e| format!("File not found in index: {}", e))?;

    let content = read_file_content(&file_path)
        .map_err(|e| format!("Failed to read file content: {}", e))?;

    Ok(FileContent {
        path: file_path,
        content,
    })
}

/// Get multiple file contents by paths
#[tauri::command]
pub async fn get_file_contents(
    file_paths: Vec<String>,
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<FileContent>, String> {
    let conn = db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut contents = Vec::new();

    for file_path in file_paths {
        // Verify file exists in index and is not a directory
        let is_valid: bool = conn
            .query_row(
                "SELECT 1 FROM files WHERE path = ? AND is_dir = 0",
                params![&file_path],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !is_valid {
            log::warn!("File not in index or is a directory: {}", file_path);
            continue;
        }

        match read_file_content(&file_path) {
            Ok(content) => {
                contents.push(FileContent {
                    path: file_path,
                    content,
                });
            }
            Err(e) => {
                log::warn!("Failed to read file {}: {}", file_path, e);
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
