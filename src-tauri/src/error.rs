use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Walkdir error: {0}")]
    Walkdir(#[from] walkdir::Error),

    #[error("Path error: {0}")]
    Path(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("Browser automation error: {0}")]
    BrowserError(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display_messages() {
        let path_error = AppError::Path("invalid path".to_string());
        assert_eq!(path_error.to_string(), "Path error: invalid path");

        let invalid_arg = AppError::InvalidArgument("missing field".to_string());
        assert_eq!(invalid_arg.to_string(), "Invalid argument: missing field");

        let browser_error = AppError::BrowserError("connection failed".to_string());
        assert_eq!(
            browser_error.to_string(),
            "Browser automation error: connection failed"
        );

        let unknown = AppError::Unknown("unexpected".to_string());
        assert_eq!(unknown.to_string(), "Unknown error: unexpected");
    }

    #[test]
    fn test_error_to_string_conversion() {
        let error = AppError::Path("test path".to_string());
        let error_string: String = error.into();
        assert_eq!(error_string, "Path error: test path");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_error: AppError = io_error.into();
        assert!(matches!(app_error, AppError::Io(_)));
        assert!(app_error.to_string().contains("file not found"));
    }

    #[test]
    fn test_json_error_conversion() {
        let json_str = "{ invalid json }";
        let json_result: Result<serde_json::Value, _> = serde_json::from_str(json_str);
        let json_error = json_result.unwrap_err();
        let app_error: AppError = json_error.into();
        assert!(matches!(app_error, AppError::Serialization(_)));
        assert!(app_error.to_string().contains("Serialization error"));
    }

    #[test]
    fn test_app_result_ok() {
        let result: AppResult<i32> = Ok(42);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_app_result_err() {
        let result: AppResult<i32> = Err(AppError::InvalidArgument("bad input".to_string()));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("bad input"));
    }

    #[test]
    fn test_error_debug_impl() {
        let error = AppError::Unknown("debug test".to_string());
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("Unknown"));
        assert!(debug_str.contains("debug test"));
    }
}
