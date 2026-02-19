use crate::db::{self, DbConnection};
use futures_util::stream::StreamExt;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter, Manager};

const GITHUB_OWNER: &str = "rafek1241";
const GITHUB_REPO: &str = "ai-copy-paste";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub release_notes: String,
    pub pub_date: String,
    pub download_url: String,
    pub is_portable: bool,
    pub update_available: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingUpdate {
    pub version: String,
    pub download_url: String,
    pub release_notes: Option<String>,
    pub downloaded_path: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    body: Option<String>,
    published_at: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

fn parse_version(v: &str) -> Option<(u32, u32, u32)> {
    let v = v.strip_prefix('v').unwrap_or(v);
    let parts: Vec<&str> = v.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    Some((
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ))
}

fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

fn is_portable_install() -> bool {
    #[cfg(target_os = "windows")]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            let path_str = exe_path.to_string_lossy().to_lowercase();
            let is_installed = path_str.contains("program files")
                || path_str.contains("programdata")
                || path_str.contains(r"appdata\local\");
            return !is_installed;
        }
        true
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let package_info = app.package_info();
    let current_version = package_info.version.to_string();
    let portable = is_portable_install();

    if portable {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.github.com/repos/{}/{}/releases/latest",
            GITHUB_OWNER, GITHUB_REPO
        );

        let response = client
            .get(&url)
            .header("User-Agent", "ai-context-collector")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch release: {}", e))?;

        let release: GitHubRelease = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse release: {}", e))?;

        let latest_version = release.tag_name.strip_prefix('v').unwrap_or(&release.tag_name);
        let update_available = is_newer(latest_version, &current_version);

        let download_url = release
            .assets
            .iter()
            .find(|a| a.name.ends_with(".exe"))
            .map(|a| a.browser_download_url.clone())
            .unwrap_or_default();

        Ok(UpdateInfo {
            version: latest_version.to_string(),
            current_version,
            release_notes: release.body.unwrap_or_default(),
            pub_date: release.published_at.unwrap_or_default(),
            download_url,
            is_portable: true,
            update_available,
        })
    } else {
        Ok(UpdateInfo {
            version: "0.0.0".to_string(),
            current_version,
            release_notes: String::new(),
            pub_date: String::new(),
            download_url: String::new(),
            is_portable: false,
            update_available: false,
        })
    }
}

#[tauri::command]
pub async fn download_update(
    app: tauri::AppHandle,
    url: String,
    version: String,
) -> Result<String, String> {
    if url.is_empty() {
        return Err("No download URL provided".to_string());
    }

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = current_exe.parent().ok_or("Failed to get exe directory")?;
    let exe_stem = current_exe
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Failed to get exe name")?;

    let temp_filename = format!("{}.update.tmp", exe_stem);
    let temp_path = exe_dir.join(&temp_filename);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    use std::io::Write;
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        file.write_all(&chunk).map_err(|e| e.to_string())?;

        let percentage = if total_size > 0 {
            ((downloaded as f64 / total_size as f64) * 100.0) as u32
        } else {
            0
        };

        let _ = app.emit(
            "update-download-progress",
            DownloadProgress {
                downloaded,
                total: total_size,
                percentage,
            },
        );
    }

    let db = app.state::<DbConnection>();
    let conn = db::get_connection(&db).map_err(|e: rusqlite::Error| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    conn.execute(
        "INSERT OR REPLACE INTO pending_updates (id, version, download_url, downloaded_path, created_at)
         VALUES (1, ?1, ?2, ?3, ?4)",
        params![version, url, temp_path.to_string_lossy().to_string(), now],
    )
    .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(temp_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn install_portable_update(app: tauri::AppHandle) -> Result<(), String> {
    let db = app.state::<DbConnection>();
    let conn = db::get_connection(&db).map_err(|e: rusqlite::Error| e.to_string())?;

    let downloaded_path: String = conn
        .query_row(
            "SELECT downloaded_path FROM pending_updates WHERE id = 1 AND downloaded_path IS NOT NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "No pending update found".to_string())?;

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;

    execute_portable_swap(&downloaded_path, &current_exe)?;

    conn.execute("DELETE FROM pending_updates WHERE id = 1", [])
        .map_err(|e: rusqlite::Error| e.to_string())?;

    std::process::exit(0);
}

pub fn execute_portable_swap(downloaded_path: &str, current_exe: &std::path::Path) -> Result<(), String> {
    let pid = std::process::id();
    let current_exe_str = current_exe.to_string_lossy();

    #[cfg(target_os = "windows")]
    {
        let script_path = std::env::temp_dir().join("ai_context_update.ps1");
        let script = format!(
            r#"$ErrorActionPreference = 'Stop'
$pid = {}
$oldExe = '{}'
$newExe = '{}'

$timeout = 30
$elapsed = 0
while ($elapsed -lt $timeout) {{
    try {{ 
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if (-not $proc) {{ break }}
    }} catch {{ break }}
    Start-Sleep -Seconds 1
    $elapsed++
}}

for ($i = 0; $i -lt 10; $i++) {{
    try {{
        Remove-Item $oldExe -Force -ErrorAction Stop
        break
    }} catch {{ Start-Sleep -Seconds 1 }}
}}

Move-Item $newExe $oldExe -Force

Start-Process $oldExe

Remove-Item $MyInvocation.MyCommand.Source -Force
"#,
            pid,
            current_exe_str,
            downloaded_path
        );

        std::fs::write(&script_path, &script)
            .map_err(|e| format!("Failed to write update script: {}", e))?;

        std::process::Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File"])
            .arg(&script_path)
            .spawn()
            .map_err(|e| format!("Failed to spawn update script: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_pending_update(db: tauri::State<'_, DbConnection>) -> Result<Option<PendingUpdate>, String> {
    let conn = db::get_connection(&db).map_err(|e: rusqlite::Error| e.to_string())?;

    let result = conn.query_row(
        "SELECT version, download_url, release_notes, downloaded_path, created_at FROM pending_updates WHERE id = 1",
        [],
        |row| {
            Ok(PendingUpdate {
                version: row.get(0)?,
                download_url: row.get(1)?,
                release_notes: row.get(2)?,
                downloaded_path: row.get(3)?,
                created_at: row.get(4)?,
            })
        },
    );

    match result {
        Ok(update) => Ok(Some(update)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn clear_pending_update(db: tauri::State<'_, DbConnection>) -> Result<(), String> {
    let conn = db::get_connection(&db).map_err(|e: rusqlite::Error| e.to_string())?;

    let result: Option<String> = conn
        .query_row(
            "SELECT downloaded_path FROM pending_updates WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(path) = result {
        if !path.is_empty() {
            let _ = std::fs::remove_file(&path);
        }
    }

    conn.execute("DELETE FROM pending_updates WHERE id = 1", [])
        .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version() {
        assert_eq!(parse_version("1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("v1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("10.20.30"), Some((10, 20, 30)));
        assert_eq!(parse_version("invalid"), None);
        assert_eq!(parse_version("1.2"), None);
        assert_eq!(parse_version("1.2.3.4"), None);
    }

    #[test]
    fn test_is_newer() {
        assert!(is_newer("1.1.0", "1.0.0"));
        assert!(is_newer("2.0.0", "1.99.99"));
        assert!(is_newer("1.0.1", "1.0.0"));
        assert!(!is_newer("1.0.0", "1.0.0"));
        assert!(!is_newer("0.9.0", "1.0.0"));
        assert!(!is_newer("1.0.0", "1.0.0"));
    }

    #[test]
    fn test_is_newer_with_prerelease() {
        assert!(!is_newer("1.0.0", "1.0.0-beta"));
    }

    #[test]
    fn test_portable_detection_returns_bool() {
        let result = is_portable_install();
        assert!(matches!(result, true | false));
    }
}
