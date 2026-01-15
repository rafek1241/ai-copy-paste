use crate::error::{AppError, AppResult};
use log::{info, warn};
use std::process::{Command, Stdio};
use tauri::Manager;

/// Available AI chat interfaces
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum AiInterface {
    ChatGPT,
    Claude,
    Gemini,
    AIStudio,
}

impl AiInterface {
    fn as_str(&self) -> &str {
        match self {
            AiInterface::ChatGPT => "chatgpt",
            AiInterface::Claude => "claude",
            AiInterface::Gemini => "gemini",
            AiInterface::AIStudio => "aistudio",
        }
    }
}

/// Launch browser with AI interface and fill prompt
/// 
/// This command spawns the Node.js sidecar process which uses Playwright
/// to launch a persistent browser context, navigate to the AI interface,
/// and fill the prompt. The browser remains open after the sidecar exits.
/// 
/// **Disconnect Pattern:** The sidecar process exits via `process.exit(0)` 
/// without calling `context.close()`. This leaves the browser process running 
/// independently, allowing the user to review and submit the prompt manually.
/// The persistent context stores session data in `.browser-data/` for reuse.
/// 
/// # Arguments
/// * `interface` - The AI interface to use (chatgpt, claude, gemini, aistudio)
/// * `text` - The prompt text to fill
/// * `custom_url` - Optional custom URL to override the default interface URL
/// 
/// # Returns
/// * `Ok(())` if the sidecar was launched successfully
/// * `Err(AppError)` if there was an error launching the sidecar
#[tauri::command]
pub async fn launch_browser(
    interface: AiInterface,
    text: String,
    custom_url: Option<String>,
) -> AppResult<()> {
    info!(
        "Launching browser for interface: {:?}, text length: {}",
        interface,
        text.len()
    );

    // Get the resource path for the sidecar
    let sidecar_path = get_sidecar_path()?;
    
    info!("Sidecar path: {}", sidecar_path.display());

    // Build command arguments
    let mut args = vec![
        sidecar_path.to_string_lossy().to_string(),
        interface.as_str().to_string(),
        text,
    ];

    if let Some(url) = custom_url {
        args.push(url);
    }

    // Spawn the Node.js sidecar process
    // Note: We use spawn instead of output to avoid blocking
    let child = Command::new("node")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            warn!("Failed to spawn sidecar process: {}", e);
            AppError::BrowserError(format!("Failed to launch browser automation: {}", e))
        })?;

    info!(
        "Sidecar process spawned with PID: {}",
        child.id()
    );

    // Note: We intentionally do NOT wait for the child process to complete
    // The sidecar will exit, but the browser will remain open
    // This is the key to the "disconnect" pattern

    Ok(())
}

/// Get available AI interfaces
/// 
/// Returns a list of supported AI chat interfaces that can be used
/// with the launch_browser command.
#[tauri::command]
pub async fn get_available_interfaces() -> AppResult<Vec<String>> {
    Ok(vec![
        "chatgpt".to_string(),
        "claude".to_string(),
        "gemini".to_string(),
        "aistudio".to_string(),
    ])
}

/// Get the path to the sidecar automation script
fn get_sidecar_path() -> AppResult<std::path::PathBuf> {
    // In development, the sidecar is in the project root
    // In production, it will be bundled with the app
    
    #[cfg(debug_assertions)]
    {
        // Development mode: use relative path from project root
        let mut path = std::env::current_dir()
            .map_err(|e| AppError::BrowserError(format!("Failed to get current directory: {}", e)))?;
        path.push("sidecar");
        path.push("automation.js");
        
        if !path.exists() {
            // Try parent directory (in case we're in src-tauri)
            let mut alt_path = std::env::current_dir()
                .map_err(|e| AppError::BrowserError(format!("Failed to get current directory: {}", e)))?;
            alt_path.push("..");
            alt_path.push("sidecar");
            alt_path.push("automation.js");
            
            if alt_path.exists() {
                return Ok(alt_path);
            }
            
            return Err(AppError::BrowserError(format!(
                "Sidecar script not found at: {}",
                path.display()
            )));
        }
        
        Ok(path)
    }
    
    #[cfg(not(debug_assertions))]
    {
        // Production mode: use bundled resource
        // TODO: Implement proper bundling with tauri-build (tracked in Phase 6 limitations)
        // IMPORTANT: Production builds will fail until sidecar is properly bundled.
        // This is a known limitation documented in AGENTS.md Phase 6 section.
        // 
        // To implement (future work):
        // 1. Add sidecar files to tauri.conf.json resources
        // 2. Use tauri::Manager::path().resource_dir() to locate bundled files
        // 3. Ensure Node.js is available on target system or bundle Node runtime
        // 4. Consider using pkg or nexe to bundle Node.js with the sidecar
        //
        // For now, we use the same logic as debug mode which won't work in production
        let mut path = std::env::current_dir()
            .map_err(|e| AppError::BrowserError(format!("Failed to get current directory: {}", e)))?;
        path.push("sidecar");
        path.push("automation.js");
        
        Ok(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interface_as_str() {
        assert_eq!(AiInterface::ChatGPT.as_str(), "chatgpt");
        assert_eq!(AiInterface::Claude.as_str(), "claude");
        assert_eq!(AiInterface::Gemini.as_str(), "gemini");
        assert_eq!(AiInterface::AIStudio.as_str(), "aistudio");
    }
}
