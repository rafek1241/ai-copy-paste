use crate::db::DbConnection;
use crate::error::AppResult;
use crate::templates::{build_prompt, get_builtin_templates, PromptTemplate};
use crate::sensitive::detection::compile_patterns;
use crate::sensitive::redaction::redact_content;
use rusqlite::params;
use rusqlite::OptionalExtension;
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
    pub redaction_count: usize,
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

    let (sensitive_enabled, compiled_patterns) = {
        let conn = db
            .lock()
            .map_err(|e| format!("Failed to lock database: {}", e))?;

        let sensitive_enabled: bool = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'sensitive_data_enabled'",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .ok()
            .flatten()
            .map(|v| v == "true")
            .unwrap_or(false);

        let compiled_patterns = if sensitive_enabled {
            let custom_patterns_json: Option<String> = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'sensitive_custom_patterns'",
                    [],
                    |row| row.get(0),
                )
                .optional()
                .ok()
                .flatten();

            let disabled_builtins_json: Option<String> = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'sensitive_disabled_builtins'",
                    [],
                    |row| row.get(0),
                )
                .optional()
                .ok()
                .flatten();

            let mut all_patterns = crate::sensitive::patterns::get_builtin_patterns();

            if let Some(json) = disabled_builtins_json {
                if let Ok(disabled_ids) = serde_json::from_str::<Vec<String>>(&json) {
                    let disabled_set: std::collections::HashSet<&str> =
                        disabled_ids.iter().map(|s| s.as_str()).collect();
                    for p in &mut all_patterns {
                        if disabled_set.contains(p.id.as_str()) {
                            p.enabled = false;
                        }
                    }
                }
            }

            if let Some(json) = custom_patterns_json {
                if let Ok(custom) = serde_json::from_str::<Vec<crate::sensitive::SensitivePattern>>(&json) {
                    all_patterns.extend(custom);
                }
            }

            compile_patterns(&all_patterns)
        } else {
            vec![]
        };

        (sensitive_enabled, compiled_patterns)
    };

    let conn = db
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut file_contents = Vec::new();
    let mut total_chars = 0;
    let mut redaction_count = 0;

    for file_path in &request.file_paths {
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
                let final_content = if sensitive_enabled && !compiled_patterns.is_empty() {
                    let result = redact_content(&content, &compiled_patterns);
                    if result.replacements > 0 {
                        log::info!(
                            "Redacted {} sensitive items in {}",
                            result.replacements,
                            file_path
                        );
                        redaction_count += result.replacements;
                    }
                    result.content
                } else {
                    content
                };
                total_chars += final_content.len();
                file_contents.push((file_path.clone(), final_content));
            }
            Err(e) => {
                log::warn!("Failed to read file {}: {}", file_path, e);
                file_contents.push((file_path.clone(), format!("[Error reading file: {}]", e)));
            }
        }
    }

    let prompt = build_prompt(
        &request.template_id,
        request.custom_instructions.as_deref(),
        &file_contents,
    )?;

    Ok(BuildPromptResponse {
        prompt,
        file_count: file_contents.len(),
        total_chars,
        redaction_count,
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
            redaction_count: 5,
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: BuildPromptResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.prompt, response.prompt);
        assert_eq!(deserialized.file_count, response.file_count);
        assert_eq!(deserialized.total_chars, response.total_chars);
        assert_eq!(deserialized.redaction_count, 5);
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

    #[test]
    fn test_redact_content_with_github_token() {
        let mut patterns = crate::sensitive::patterns::get_builtin_patterns();
        for p in &mut patterns {
            p.enabled = true;
        }
        let compiled = compile_patterns(&patterns);

        let content = "auth: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234";
        let result = redact_content(content, &compiled);

        assert!(result.content.contains("[GITHUB_TOKEN]"));
        assert!(!result.content.contains("ghp_"));
        assert!(result.replacements >= 1);
    }

    #[test]
    fn test_redact_content_with_sensitive_disabled() {
        let patterns: Vec<crate::sensitive::SensitivePattern> = vec![];
        let compiled = compile_patterns(&patterns);

        let content = "token = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234";
        let result = redact_content(content, &compiled);

        assert_eq!(result.content, content);
        assert_eq!(result.replacements, 0);
    }

    #[test]
    fn test_redact_content_multiple_patterns() {
        let mut patterns = crate::sensitive::patterns::get_builtin_patterns();
        for p in &mut patterns {
            p.enabled = true;
        }
        let compiled = compile_patterns(&patterns);

        let content = r#"
DATABASE_URL=postgresql://admin:secret@localhost:5432/mydb
API_KEY=sk-proj-test1234567890abcdefghijklmnopqrstuvwxyz1234567890ABCD
"#;
        let result = redact_content(content, &compiled);

        assert!(result.replacements >= 1);
        assert!(!result.content.contains("admin:secret"));
    }
}
