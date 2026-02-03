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
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_get_templates() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let templates = get_templates().await.unwrap();
            assert!(templates.len() >= 4);
        });
    }

    #[test]
    fn test_read_file_content_success() {
        let mut temp_file = NamedTempFile::new().unwrap();
        let content = "Hello, world!";
        temp_file.write_all(content.as_bytes()).unwrap();

        let result = read_file_content(temp_file.path().to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    #[test]
    fn test_read_file_content_nonexistent() {
        let result = read_file_content("/nonexistent/path/to/file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_file_content_serialization() {
        let file_content = FileContent {
            path: "/test/path.rs".to_string(),
            content: "fn main() {}".to_string(),
        };

        let json = serde_json::to_string(&file_content).unwrap();
        assert!(json.contains("/test/path.rs"));
        assert!(json.contains("fn main() {}"));

        let deserialized: FileContent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.path, file_content.path);
        assert_eq!(deserialized.content, file_content.content);
    }

    #[test]
    fn test_build_prompt_request_serialization() {
        let request = BuildPromptRequest {
            template_id: "code-review".to_string(),
            custom_instructions: Some("Focus on security".to_string()),
            file_paths: vec!["/path/a.rs".to_string(), "/path/b.rs".to_string()],
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: BuildPromptRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.template_id, request.template_id);
        assert_eq!(deserialized.custom_instructions, request.custom_instructions);
        assert_eq!(deserialized.file_paths, request.file_paths);
    }

    #[test]
    fn test_build_prompt_request_without_custom_instructions() {
        let request = BuildPromptRequest {
            template_id: "explain-code".to_string(),
            custom_instructions: None,
            file_paths: vec!["/path/file.rs".to_string()],
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: BuildPromptRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.template_id, "explain-code");
        assert!(deserialized.custom_instructions.is_none());
    }

    #[test]
    fn test_build_prompt_response_serialization() {
        let response = BuildPromptResponse {
            prompt: "Generated prompt content".to_string(),
            file_count: 3,
            total_chars: 1500,
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: BuildPromptResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.prompt, response.prompt);
        assert_eq!(deserialized.file_count, response.file_count);
        assert_eq!(deserialized.total_chars, response.total_chars);
    }

    #[test]
    fn test_read_file_content_utf8() {
        let mut temp_file = NamedTempFile::new().unwrap();
        let content = "Unicode: 你好世界 🦀 Ñoño";
        temp_file.write_all(content.as_bytes()).unwrap();

        let result = read_file_content(temp_file.path().to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    #[test]
    fn test_read_file_content_multiline() {
        let mut temp_file = NamedTempFile::new().unwrap();
        let content = "Line 1\nLine 2\nLine 3\n";
        temp_file.write_all(content.as_bytes()).unwrap();

        let result = read_file_content(temp_file.path().to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }
}
