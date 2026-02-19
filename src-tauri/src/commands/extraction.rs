use crate::cache::TextCache;
use crate::db::DbConnection;
use crate::error::{AppError, AppResult};
use chardetng::EncodingDetector;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

/// Progress event for extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionProgress {
    pub path: String,
    pub status: String,
    pub progress: f32,
}

/// Result of text extraction
#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractionResult {
    pub text: String,
    pub encoding: Option<String>,
    pub error: Option<String>,
}

/// Extract text from a file
/// Supports: plain text, source code, markdown, and other text-based files
/// PDF and DOCX extraction should be done from the frontend using pdfjs-dist and mammoth
#[tauri::command]
pub async fn extract_text(
    path: String,
    db: State<'_, DbConnection>,
    cache: State<'_, Mutex<TextCache>>,
) -> Result<ExtractionResult, String> {
    log::info!("Extracting text from: {}", path);
    extract_text_internal(&path, &db, &cache)
        .await
        .map_err(to_command_error)
}

fn to_command_error(error: AppError) -> String {
    match error {
        AppError::Unknown(message)
        | AppError::Path(message)
        | AppError::InvalidArgument(message) => message,
        other => other.to_string(),
    }
}

async fn extract_text_internal(
    path: &str,
    db: &DbConnection,
    cache: &Mutex<TextCache>,
) -> AppResult<ExtractionResult> {
    let fingerprint = get_indexed_file_fingerprint(path, db)?;

    if let Some(cached_text) = get_cached_text(path, &fingerprint, cache)? {
        log::info!("Using cached text for: {}", path);
        return Ok(ExtractionResult {
            text: cached_text,
            encoding: Some("utf-8".to_string()),
            error: None,
        });
    }

    let path_for_io = path.to_string();
    let extraction = tokio::task::spawn_blocking(move || extract_text_from_file(&path_for_io))
        .await
        .map_err(|e| AppError::Unknown(format!("Text extraction task failed: {}", e)))?;

    let result = match extraction {
        Ok((text, encoding)) => {
            cache_extracted_text(path, &fingerprint, &text, cache)?;
            ExtractionResult {
                text,
                encoding: Some(encoding),
                error: None,
            }
        }
        Err(e) => {
            log::warn!("Failed to extract text from {}: {}", path, e);
            ExtractionResult {
                text: String::new(),
                encoding: None,
                error: Some(e.to_string()),
            }
        }
    };

    Ok(result)
}

fn get_indexed_file_fingerprint(path: &str, db: &DbConnection) -> AppResult<String> {
    let conn = db
        .lock()
        .map_err(|e| AppError::Unknown(format!("Failed to lock database: {}", e)))?;

    let (fingerprint, is_dir): (Option<String>, bool) = conn
        .query_row(
            "SELECT fingerprint, is_dir FROM files WHERE path = ?",
            params![path],
            |row| Ok((row.get(0)?, row.get::<_, i32>(1)? != 0)),
        )
        .map_err(|e| AppError::Unknown(format!("Failed to get file metadata: {}", e)))?;

    if is_dir {
        return Err(AppError::InvalidArgument(
            "Cannot extract text from directory".to_string(),
        ));
    }

    fingerprint.ok_or_else(|| AppError::Path("File fingerprint not found".to_string()))
}

fn get_cached_text(
    path: &str,
    fingerprint: &str,
    cache: &Mutex<TextCache>,
) -> AppResult<Option<String>> {
    let mut cache_guard = cache
        .lock()
        .map_err(|e| AppError::Unknown(format!("Failed to lock cache: {}", e)))?;

    if let Ok(Some(cached_text)) = cache_guard.get(path, fingerprint) {
        return Ok(Some(cached_text));
    }

    Ok(None)
}

fn cache_extracted_text(
    path: &str,
    fingerprint: &str,
    text: &str,
    cache: &Mutex<TextCache>,
) -> AppResult<()> {
    let mut cache_guard = cache
        .lock()
        .map_err(|e| AppError::Unknown(format!("Failed to lock cache: {}", e)))?;

    if let Err(e) = cache_guard.put(path, fingerprint, text) {
        log::warn!("Failed to cache text for {}: {}", path, e);
    }

    Ok(())
}

/// Extract text from a plain text file with encoding detection
fn extract_text_from_file(path: &str) -> AppResult<(String, String)> {
    let path_obj = Path::new(path);

    if !path_obj.exists() {
        return Err(AppError::Path(format!("File not found: {}", path)));
    }

    // Read file as bytes
    let bytes = fs::read(path_obj)?;

    if bytes.is_empty() {
        return Ok((String::new(), "utf-8".to_string()));
    }

    // Detect encoding
    let (encoding, text) = detect_encoding_and_decode(&bytes)?;

    log::debug!(
        "Extracted {} chars from {} (encoding: {})",
        text.len(),
        path,
        encoding
    );

    Ok((text, encoding))
}

/// Detect encoding and decode bytes to string
fn detect_encoding_and_decode(bytes: &[u8]) -> AppResult<(String, String)> {
    // Try UTF-8 first (most common)
    if let Ok(text) = std::str::from_utf8(bytes) {
        return Ok(("utf-8".to_string(), text.to_string()));
    }

    // Use chardetng for encoding detection
    let mut detector = EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);

    log::debug!("Detected encoding: {}", encoding.name());

    // Decode using detected encoding
    let (decoded, _encoding_used, had_errors) = encoding.decode(bytes);

    if had_errors {
        log::warn!("Encoding errors during decode, some characters may be replaced");
    }

    Ok((encoding.name().to_string(), decoded.to_string()))
}

/// Check if a file is likely a text file based on extension
pub fn is_text_file(path: &str) -> bool {
    let path_obj = Path::new(path);
    
    if let Some(ext) = path_obj.extension().and_then(|e| e.to_str()) {
        let ext_lower = ext.to_lowercase();
        
        // Common text file extensions
        matches!(
            ext_lower.as_str(),
            "txt" | "md" | "markdown" | "rst" | "text" |
            // Source code
            "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "java" | "c" | "cpp" | "h" | "hpp" |
            "go" | "rb" | "php" | "swift" | "kt" | "scala" | "cs" | "vb" | "r" |
            // Web
            "html" | "htm" | "css" | "scss" | "sass" | "less" | "xml" | "svg" | "vue" |
            // Config
            "json" | "yaml" | "yml" | "toml" | "ini" | "cfg" | "conf" | "config" |
            // Shell
            "sh" | "bash" | "zsh" | "fish" | "ps1" | "bat" | "cmd" |
            // Documentation
            "tex" | "rtf" | "org" | "adoc" | "asciidoc" |
            // Data
            "csv" | "tsv" | "log" | "sql"
        )
    } else {
        // No extension - check if it's a common text file
        let file_name = path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("");
        matches!(
            file_name,
            "README" | "LICENSE" | "Makefile" | "Dockerfile" | "Cargo.lock" |
            "package-lock.json" | ".gitignore" | ".gitattributes" | ".editorconfig"
        )
    }
}

/// Get list of supported file types for extraction
#[tauri::command]
pub async fn get_supported_file_types() -> Result<Vec<String>, String> {
    Ok(vec![
        "txt".to_string(),
        "md".to_string(),
        "markdown".to_string(),
        "rst".to_string(),
        "rs".to_string(),
        "py".to_string(),
        "js".to_string(),
        "ts".to_string(),
        "jsx".to_string(),
        "tsx".to_string(),
        "java".to_string(),
        "c".to_string(),
        "cpp".to_string(),
        "h".to_string(),
        "hpp".to_string(),
        "go".to_string(),
        "rb".to_string(),
        "php".to_string(),
        "swift".to_string(),
        "kt".to_string(),
        "html".to_string(),
        "css".to_string(),
        "json".to_string(),
        "yaml".to_string(),
        "yml".to_string(),
        "toml".to_string(),
        "xml".to_string(),
        "sql".to_string(),
        "sh".to_string(),
        "bash".to_string(),
        "csv".to_string(),
        "log".to_string(),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_text_file() {
        assert!(is_text_file("file.txt"));
        assert!(is_text_file("file.md"));
        assert!(is_text_file("file.rs"));
        assert!(is_text_file("file.py"));
        assert!(is_text_file("README"));
        assert!(is_text_file("Makefile"));
        
        assert!(!is_text_file("file.pdf"));
        assert!(!is_text_file("file.docx"));
        assert!(!is_text_file("file.exe"));
        assert!(!is_text_file("file.png"));
    }

    #[test]
    fn test_detect_utf8() {
        let text = "Hello, World! 你好世界";
        let bytes = text.as_bytes();
        
        let (encoding, decoded) = detect_encoding_and_decode(bytes).unwrap();
        assert_eq!(encoding, "utf-8");
        assert_eq!(decoded, text);
    }

    #[test]
    fn test_detect_encoding() {
        // ASCII text
        let text = "Hello, World!";
        let bytes = text.as_bytes();
        
        let (encoding, decoded) = detect_encoding_and_decode(bytes).unwrap();
        assert_eq!(decoded, text);
    }
}
