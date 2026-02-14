# Implementation Plan: Auto-Update Mechanism

> **Author:** Senior Engineer (Architecture Review)
> **Created:** 2026-02-14
> **Status:** Ready for Implementation
> **Spec:** [spec.md](./spec.md)

---

## Architecture Decision Record

### Approach: Hybrid (Tauri Updater Plugin + Custom Portable Logic)

The spec requires two update flows:

1. **Standard Installer Flow** (MSI/DMG/AppImage/deb) — Use **`tauri-plugin-updater`** which handles download, signature verification, and installation natively.
2. **Portable Executable Flow** — Custom Rust logic to download the new `.exe`, spawn a helper process to swap, and restart.

**Why not use Tauri updater for everything?**
The Tauri updater only works with installer-based bundles (MSI, AppImage, DMG). When users run a standalone/portable `.exe`, the updater can't patch it. The spec explicitly calls out a portable swap mechanism.

**Detection:** At runtime, check if the app is running from an installed location (e.g., `Program Files` on Windows) vs. a standalone path. This determines which flow to use.

### Update Source: GitHub Releases API

The release workflow already creates GitHub Releases with installers via `softprops/action-gh-release`. The Tauri updater plugin can consume these directly. For portable builds, we'll download the raw `.exe` asset from the release.

### Key Integration Points

| Layer | File(s) | What Changes |
|-------|---------|-------------|
| **Rust Backend** | `src-tauri/Cargo.toml` | Add `tauri-plugin-updater`, `tauri-plugin-process`, `reqwest` |
| **Rust Backend** | `src-tauri/src/lib.rs` | Register updater + process plugins, add update commands |
| **Rust Backend** | `src-tauri/src/commands/update.rs` | New command module: check, download, install, portable swap |
| **Rust Backend** | `src-tauri/src/commands/mod.rs` | Register new `update` module |
| **Rust Backend** | `src-tauri/src/db/schema.rs` | Add `pending_update` table |
| **Rust Backend** | `src-tauri/src/error.rs` | Add `UpdateError` variant |
| **Tauri Config** | `src-tauri/tauri.conf.json` | Add updater config (endpoints, pubkey) |
| **Tauri Config** | `src-tauri/capabilities/default.json` | Add updater + process permissions |
| **Frontend** | `src/types.ts` | Add `UpdateInfo`, `UpdateProgress` types |
| **Frontend** | `src/components/views/UpdateView.tsx` | New view: changelog, buttons, progress |
| **Frontend** | `src/hooks/useUpdateCheck.ts` | Hook for startup update check |
| **Frontend** | `src/App.tsx` | Integrate update view overlay |
| **Frontend** | `package.json` | Add `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` |
| **Release CI** | `.github/workflows/release.yml` | Generate `latest.json` updater manifest |

---

## Phase 1: Backend Infrastructure & Update Check

### Task 1.1: Add Dependencies to Cargo.toml
- [ ] **File:** `src-tauri/Cargo.toml`
- **What to do:**

Add these dependencies under `[dependencies]`:

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
reqwest = { version = "0.12", features = ["json", "stream"] }
```

**Why `reqwest`?** The portable update flow needs to download a binary from GitHub. `reqwest` provides async HTTP with streaming (for progress reporting). The Tauri updater plugin handles its own downloads internally, but the portable flow is custom.

**Why `tauri-plugin-process`?** Needed for `relaunch()` after the standard updater installs an update.

---

### Task 1.2: Add UpdateError Variant to error.rs
- [ ] **File:** `src-tauri/src/error.rs`
- **What to do:**

Add a new variant to `AppError`:

```rust
#[error("Update error: {0}")]
UpdateError(String),
```

This follows the existing pattern (see `BrowserError` variant).

---

### Task 1.3: Add `pending_updates` Table to Database Schema
- [ ] **File:** `src-tauri/src/db/schema.rs`
- **What to do:**

Add a new table creation statement inside `init_database()`, after the existing `settings` table:

```rust
// Pending update tracking for "Update on Exit" feature
conn.execute(
    "CREATE TABLE IF NOT EXISTS pending_updates (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version TEXT NOT NULL,
        download_url TEXT NOT NULL,
        release_notes TEXT,
        downloaded_path TEXT,
        created_at INTEGER NOT NULL
    )",
    [],
)?;
```

**Design notes:**
- `CHECK (id = 1)` ensures only one pending update can exist at a time (singleton pattern).
- `downloaded_path` is NULL until the binary has been downloaded — allows "download first, install on exit" flow.
- `release_notes` stores the markdown body from GitHub for display.

**Tests to write:**
- Test that the table is created (add to existing `test_init_database`: assert table count is now 4).
- Test the CHECK constraint — inserting id=2 should fail.

---

### Task 1.4: Create the `update` Command Module
- [ ] **Files:**
  - `src-tauri/src/commands/update.rs` (new)
  - `src-tauri/src/commands/mod.rs` (modify)

**What to create in `update.rs`:**

This module will contain 4 Tauri commands:

#### 1.4a: `check_for_updates` Command

```rust
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub release_notes: String,       // Markdown body from GitHub Release
    pub pub_date: String,            // ISO 8601 date
    pub download_url: String,        // Direct asset URL for portable
    pub is_portable: bool,           // Whether running as portable exe
    pub update_available: bool,
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    // Implementation steps:
    // 1. Get current version from app.package_info().version
    // 2. Determine if running as portable (see detection logic below)
    // 3. If NOT portable: Use tauri-plugin-updater's `check()` API
    //    - The plugin reads the updater config from tauri.conf.json
    //    - Returns version, release notes, etc.
    // 4. If portable: Call GitHub Releases API directly via reqwest
    //    - GET https://api.github.com/repos/{owner}/{repo}/releases/latest
    //    - Parse response for tag_name, body (release notes), assets
    //    - Find the .exe asset in the assets array
    // 5. Compare versions using semver parsing
    // 6. Return UpdateInfo
}
```

**Portable detection logic** (create a helper function):

```rust
fn is_portable_install() -> bool {
    // On Windows: Check if running from Program Files or a standard install location
    // A portable exe typically lives in a user-chosen directory, not under:
    //   C:\Program Files\
    //   C:\Program Files (x86)\
    //   %LOCALAPPDATA%\
    // 
    // Simple heuristic: Check if an "uninstall" registry key or .msi metadata exists
    // OR: Check if the exe directory contains an "unins000.exe" (NSIS uninstaller)
    // OR: Simplest approach - check if std::env::current_exe() path contains "Program Files"
    //
    // For macOS/Linux: The Tauri updater handles .dmg/.AppImage natively,
    // so portable detection is mainly a Windows concern.
    
    #[cfg(target_os = "windows")]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            let path_str = exe_path.to_string_lossy().to_lowercase();
            // If installed via MSI, it'll be in Program Files or LocalAppData
            let is_installed = path_str.contains("program files")
                || path_str.contains("programdata")
                || path_str.contains(r"appdata\local\");
            return !is_installed;
        }
        true // Default to portable if we can't determine
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        false // macOS/Linux always use standard updater
    }
}
```

**GitHub API response struct** (for portable flow):

```rust
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
    size: u64,
}
```

**Version comparison:** Parse version strings (strip leading `v` from tag) and do a simple `(major, minor, patch)` tuple comparison. You can use the existing pattern from the codebase (no external semver crate needed — the versions are simple `X.Y.Z`).

```rust
fn parse_version(v: &str) -> Option<(u32, u32, u32)> {
    let v = v.strip_prefix('v').unwrap_or(v);
    let parts: Vec<&str> = v.split('.').collect();
    if parts.len() != 3 { return None; }
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
```

**Constant for GitHub repo:**

```rust
const GITHUB_OWNER: &str = "YOUR_GITHUB_USERNAME"; // TODO: Replace with actual owner
const GITHUB_REPO: &str = "ai-copy-paste";          // TODO: Replace with actual repo name
```

#### 1.4b: `download_update` Command

```rust
#[tauri::command]
pub async fn download_update(
    app: tauri::AppHandle,
    url: String,
    version: String,
) -> Result<String, String> {
    // This is ONLY for portable mode.
    // For standard installer mode, the frontend calls the Tauri updater JS API directly.
    //
    // Implementation steps:
    // 1. Get the directory of the current executable (std::env::current_exe())
    // 2. Create a temp filename: "{exe_name}.update.tmp" in the same directory
    // 3. Use reqwest to download the file from `url` with streaming
    // 4. As chunks arrive, emit a Tauri event for progress:
    //    app.emit("update-download-progress", DownloadProgress { 
    //        downloaded: bytes_so_far,
    //        total: content_length,
    //        percentage: (bytes_so_far as f64 / content_length as f64 * 100.0) as u32
    //    })
    // 5. Write chunks to the temp file
    // 6. When complete, store the pending update in SQLite:
    //    INSERT OR REPLACE INTO pending_updates (id, version, download_url, downloaded_path, created_at)
    //    VALUES (1, ?, ?, ?, strftime('%s','now'))
    // 7. Return the temp file path
}

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: u32,
}
```

#### 1.4c: `install_portable_update` Command

```rust
#[tauri::command]
pub async fn install_portable_update(app: tauri::AppHandle) -> Result<(), String> {
    // Immediately swap the portable exe and restart
    //
    // Implementation steps:
    // 1. Read pending update from SQLite to get downloaded_path
    // 2. Get current exe path
    // 3. Create a batch/powershell script in the temp directory that:
    //    a. Waits for the current process to exit (timeout 10s, poll by PID)
    //    b. Deletes the old exe (retry loop for file lock release)
    //    c. Renames the .update.tmp to the original exe name (move/rename)
    //    d. Starts the new exe
    //    e. Deletes itself (the script)
    // 4. Spawn the script as a detached process
    // 5. Clear the pending_updates table
    // 6. Exit the current application (std::process::exit(0))
    //
    // The script content (Windows PowerShell):
    // ```powershell
    // $ErrorActionPreference = 'Stop'
    // $pid = {CURRENT_PID}
    // $oldExe = '{CURRENT_EXE_PATH}'
    // $newExe = '{TEMP_FILE_PATH}'
    // 
    // # Wait for process to exit
    // $timeout = 30
    // $elapsed = 0
    // while ($elapsed -lt $timeout) {
    //     try { 
    //         $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    //         if (-not $proc) { break }
    //     } catch { break }
    //     Start-Sleep -Seconds 1
    //     $elapsed++
    // }
    // 
    // # Retry delete old exe
    // for ($i = 0; $i -lt 10; $i++) {
    //     try {
    //         Remove-Item $oldExe -Force -ErrorAction Stop
    //         break
    //     } catch { Start-Sleep -Seconds 1 }
    // }
    // 
    // # Rename new exe
    // Move-Item $newExe $oldExe -Force
    // 
    // # Start new version
    // Start-Process $oldExe
    // ```
    //
    // On macOS/Linux, this is not needed (standard updater handles it).
}
```

#### 1.4d: `get_pending_update` & `clear_pending_update` Commands

```rust
#[tauri::command]
pub fn get_pending_update(db: tauri::State<'_, DbConnection>) -> Result<Option<PendingUpdate>, String> {
    // Query the pending_updates table for id=1
    // Return None if no row exists
}

#[tauri::command]
pub fn clear_pending_update(db: tauri::State<'_, DbConnection>) -> Result<(), String> {
    // DELETE FROM pending_updates WHERE id = 1
    // Also delete the downloaded temp file if it exists
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingUpdate {
    pub version: String,
    pub download_url: String,
    pub release_notes: Option<String>,
    pub downloaded_path: Option<String>,
    pub created_at: i64,
}
```

**Register in `mod.rs`:**

Add to `src-tauri/src/commands/mod.rs`:

```rust
pub mod update;
pub use update::{check_for_updates, download_update, install_portable_update, get_pending_update, clear_pending_update};
```

**Tests to write for Phase 1 (TDD):**

1. **Version parsing tests:**
   - `parse_version("1.2.3")` → `Some((1,2,3))`
   - `parse_version("v1.2.3")` → `Some((1,2,3))`
   - `parse_version("invalid")` → `None`
   - `is_newer("1.1.0", "1.0.0")` → `true`
   - `is_newer("1.0.0", "1.0.0")` → `false`
   - `is_newer("0.9.0", "1.0.0")` → `false`

2. **Pending update DB tests:**
   - Insert a pending update, read it back, verify fields
   - Verify CHECK constraint (only id=1 allowed)
   - Clear pending update, verify it's gone

3. **Portable detection test:**
   - Unit test `is_portable_install()` returns a bool (hard to test deterministically, but ensure no panic)

---

### Task 1.5: Register Plugins and Commands in lib.rs
- [ ] **File:** `src-tauri/src/lib.rs`
- **What to do:**

1. Add plugin registrations. The updater plugin should be registered in `.setup()` per the official docs:

```rust
.setup(|app| {
    // ... existing db and cache init ...
    
    #[cfg(desktop)]
    app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
    
    Ok(())
})
```

And `tauri_plugin_process` goes on the builder (before `.setup()`):

```rust
.plugin(tauri_plugin_process::init())
```

2. Add update commands to the `generate_handler![]` macro:

```rust
commands::update::check_for_updates,
commands::update::download_update,
commands::update::install_portable_update,
commands::update::get_pending_update,
commands::update::clear_pending_update,
```

3. Add the "Update on Exit" hook. In the `setup` closure, register a window close handler:

```rust
// Handle "Update on Exit" — check for pending updates when closing
let app_handle = app.handle().clone();
if let Some(window) = app.get_webview_window("main") {
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            // Check for pending portable update
            if let Some(db) = app_handle.try_state::<DbConnection>() {
                if let Ok(conn) = db.lock() {
                    let has_pending: bool = conn
                        .query_row(
                            "SELECT COUNT(*) > 0 FROM pending_updates WHERE downloaded_path IS NOT NULL",
                            [],
                            |row| row.get(0),
                        )
                        .unwrap_or(false);
                    
                    if has_pending {
                        // Trigger the portable update swap
                        log::info!("Pending update detected on exit — triggering portable update swap");
                        // Call the swap logic (see Task 4.1 for the shared function)
                    }
                }
            }
        }
    });
}
```

---

### Task 1.6: Configure Tauri Updater in tauri.conf.json
- [ ] **File:** `src-tauri/tauri.conf.json`
- **What to do:**

Add the `plugins` section at the top level:

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/YOUR_OWNER/YOUR_REPO/releases/latest/download/latest.json"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

**How to generate the signing key pair:**

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/myapp.key
```

This generates:
- A private key file at `~/.tauri/myapp.key` (keep secret, use in CI as `TAURI_SIGNING_PRIVATE_KEY`)
- A public key printed to stdout (put in `tauri.conf.json` as `pubkey`)

**The private key** must be set as a GitHub Actions secret: `TAURI_SIGNING_PRIVATE_KEY` and optionally `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if you set a password.

---

### Task 1.7: Update Capabilities (Permissions)
- [ ] **File:** `src-tauri/capabilities/default.json`
- **What to do:**

Add permissions to the `permissions` array:

```json
{
  "permissions": [
    "core:default",
    "opener:default",
    "dialog:default",
    "updater:default",
    "process:allow-restart",
    "process:allow-exit"
  ]
}
```

---

### Task 1.8: Conductor — User Manual Verification 'Phase 1'
- [ ] **Verification steps:**
  1. Run `cd src-tauri && cargo test` — all tests pass (including new version parsing + pending update DB tests)
  2. Run `cd src-tauri && cargo build` — compiles without errors
  3. Verify `tauri.conf.json` is valid JSON (no syntax errors)
  4. Run `npx tauri dev` — app starts without crashes (updater plugin registers, but no update available since we're in dev mode)

---

## Phase 2: Release CI — Updater Manifest Generation

### Task 2.1: Generate `latest.json` Updater Manifest in Release Workflow
- [ ] **File:** `.github/workflows/release.yml`
- **What to do:**

The Tauri updater plugin expects a JSON manifest at the endpoint configured in `tauri.conf.json`. The `tauri-apps/tauri-action@v0` action already supports generating the updater JSON.

1. Add the signing private key as a GitHub Actions secret:
   - `TAURI_SIGNING_PRIVATE_KEY` — the content of the `.key` file
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password (if set)

2. Update the `build-tauri` job's environment variables:

```yaml
- name: Build Tauri application
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  with:
    releaseId: ${{ needs.create-release.outputs.release_id }}
    args: ${{ matrix.args }}
    updaterJsonKeepUniversal: true
```

The `tauri-action` will automatically:
- Sign the bundles with the private key
- Generate a `latest.json` file
- Upload it as a release asset

The `latest.json` format looks like:

```json
{
  "version": "1.0.0",
  "notes": "Release notes here",
  "pub_date": "2026-02-14T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../asset.msi.zip"
    },
    "darwin-universal": {
      "signature": "...",
      "url": "https://github.com/.../asset.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../asset.AppImage.tar.gz"
    }
  }
}
```

3. Also upload the portable `.exe` as a standalone asset (for the portable update flow). Add a step after the Tauri build on the Windows runner:

```yaml
- name: Upload Portable Executable
  if: matrix.platform == 'windows-latest'
  uses: softprops/action-gh-release@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    tag_name: ${{ needs.create-release.outputs.release_id }}
    files: |
      src-tauri/target/release/ai-context-collector.exe
```

> **Note:** Adjust the exe name to match your actual binary name from `Cargo.toml` package name.

---

### Task 2.2: Conductor — User Manual Verification 'Phase 2'
- [ ] **Verification steps:**
  1. Generate signing keys locally: `npx @tauri-apps/cli signer generate -w ~/.tauri/myapp.key`
  2. Set the pubkey in `tauri.conf.json`
  3. Verify `release.yml` is valid YAML
  4. (Full verification requires pushing a tag and running CI — defer to integration testing)

---

## Phase 3: Frontend — Update View & Check Hook

### Task 3.1: Install Frontend Dependencies
- [ ] **File:** `package.json`
- **What to do:**

```bash
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

This adds:
- `@tauri-apps/plugin-updater` — JS API for `check()`, `download()`, `install()`
- `@tauri-apps/plugin-process` — JS API for `relaunch()`

---

### Task 3.2: Add Update Types to types.ts
- [ ] **File:** `src/types.ts`
- **What to do:**

Add at the bottom of the file:

```typescript
// Auto-update types
export interface UpdateInfo {
  version: string;
  current_version: string;
  release_notes: string;
  pub_date: string;
  download_url: string;
  is_portable: boolean;
  update_available: boolean;
}

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export type UpdateStatus = 
  | 'idle'
  | 'checking' 
  | 'available' 
  | 'downloading' 
  | 'installing' 
  | 'error' 
  | 'scheduled';  // "Update on Exit" selected
```

---

### Task 3.3: Create `useUpdateCheck` Hook
- [ ] **File:** `src/hooks/useUpdateCheck.ts` (new)
- **What to do:**

This hook runs on app startup, calls the backend to check for updates, and manages the update lifecycle state.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import type { UpdateInfo, UpdateProgress, UpdateStatus } from '../types';

interface UseUpdateCheckResult {
  updateInfo: UpdateInfo | null;
  status: UpdateStatus;
  progress: UpdateProgress;
  error: string | null;
  updateNow: () => Promise<void>;
  updateOnExit: () => Promise<void>;
  dismissError: () => void;
}

export function useUpdateCheck(): UseUpdateCheckResult {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const [progress, setProgress] = useState<UpdateProgress>({ downloaded: 0, total: 0, percentage: 0 });
  const [error, setError] = useState<string | null>(null);

  // Check for updates on mount (app startup)
  useEffect(() => {
    let cancelled = false;

    async function checkUpdate() {
      try {
        setStatus('checking');
        const info = await invoke<UpdateInfo>('check_for_updates');
        
        if (cancelled) return;
        
        if (info.update_available) {
          setUpdateInfo(info);
          setStatus('available');
        } else {
          setStatus('idle');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Update check failed:', err);
        // Don't block app usage on update check failure
        setStatus('idle');
      }
    }

    checkUpdate();

    return () => { cancelled = true; };
  }, []);

  // Listen for download progress events (portable mode)
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen<UpdateProgress>('update-download-progress', (event) => {
      setProgress(event.payload);
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  // "Update Now" handler
  const updateNow = useCallback(async () => {
    if (!updateInfo) return;

    try {
      setStatus('downloading');

      if (updateInfo.is_portable) {
        // Portable flow: download via backend, then install
        await invoke('download_update', {
          url: updateInfo.download_url,
          version: updateInfo.version,
        });
        setStatus('installing');
        await invoke('install_portable_update');
        // App will exit and restart via the swap script
      } else {
        // Standard Tauri updater flow
        const update = await check();
        if (update) {
          await update.downloadAndInstall((event) => {
            if (event.event === 'Started') {
              setProgress({ downloaded: 0, total: event.data.contentLength ?? 0, percentage: 0 });
            } else if (event.event === 'Progress') {
              setProgress((prev) => {
                const downloaded = prev.downloaded + (event.data.chunkLength ?? 0);
                const percentage = prev.total > 0 ? Math.round((downloaded / prev.total) * 100) : 0;
                return { downloaded, total: prev.total, percentage };
              });
            } else if (event.event === 'Finished') {
              setProgress((prev) => ({ ...prev, percentage: 100 }));
            }
          });
          setStatus('installing');
          await relaunch();
        }
      }
    } catch (err) {
      console.error('Update failed:', err);
      setError(String(err));
      setStatus('error');
    }
  }, [updateInfo]);

  // "Update on Exit" handler
  const updateOnExit = useCallback(async () => {
    if (!updateInfo) return;

    try {
      if (updateInfo.is_portable) {
        // Download now, install on exit
        setStatus('downloading');
        await invoke('download_update', {
          url: updateInfo.download_url,
          version: updateInfo.version,
        });
      } else {
        // For standard updater: download the update but don't install yet
        const update = await check();
        if (update) {
          await update.download((event) => {
            if (event.event === 'Started') {
              setProgress({ downloaded: 0, total: event.data.contentLength ?? 0, percentage: 0 });
            } else if (event.event === 'Progress') {
              setProgress((prev) => {
                const downloaded = prev.downloaded + (event.data.chunkLength ?? 0);
                const percentage = prev.total > 0 ? Math.round((downloaded / prev.total) * 100) : 0;
                return { downloaded, total: prev.total, percentage };
              });
            }
          });
          // Install will happen on app close
          await update.install();
          // Note: install() without relaunch() schedules it for next start
        }
      }
      setStatus('scheduled');
    } catch (err) {
      console.error('Update scheduling failed:', err);
      setError(String(err));
      setStatus('error');
    }
  }, [updateInfo]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus('available'); // Go back to showing the update dialog
  }, []);

  return {
    updateInfo,
    status,
    progress,
    error,
    updateNow,
    updateOnExit,
    dismissError,
  };
}
```

**Tests to write (vitest):**

Create `src/hooks/useUpdateCheck.test.ts`:

1. Mock `invoke` from `@tauri-apps/api/core`
2. Test that on mount, `check_for_updates` is called
3. Test that when `update_available: true`, status becomes `'available'`
4. Test that when `update_available: false`, status becomes `'idle'`
5. Test that on invoke error, status becomes `'idle'` (don't block the app)
6. Test that `updateNow` for portable mode calls `download_update` then `install_portable_update`
7. Test that `updateOnExit` calls `download_update` and sets status to `'scheduled'`

---

### Task 3.4: Create UpdateView Component
- [ ] **File:** `src/components/views/UpdateView.tsx` (new)
- **What to do:**

Create a dedicated update view that follows the existing view pattern (see `SettingsView.tsx` for reference). This is shown as an **overlay/modal** on top of the app when an update is available — not a sidebar-navigable view, since updates are mandatory.

```tsx
import React from 'react';
import type { UpdateInfo, UpdateProgress, UpdateStatus } from '../../types';

interface UpdateViewProps {
  updateInfo: UpdateInfo;
  status: UpdateStatus;
  progress: UpdateProgress;
  error: string | null;
  onUpdateNow: () => void;
  onUpdateOnExit: () => void;
  onDismissError: () => void;
}

export const UpdateView: React.FC<UpdateViewProps> = ({
  updateInfo,
  status,
  progress,
  error,
  onUpdateNow,
  onUpdateOnExit,
  onDismissError,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-border-dark rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-border-dark">
          <h2 className="text-lg font-semibold text-white">
            Update Available
          </h2>
          <p className="text-sm text-white/60 mt-1">
            Version {updateInfo.version} is available
            (current: {updateInfo.current_version})
          </p>
        </div>

        {/* Release Notes (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4">
          {status === 'available' && (
            <div className="prose prose-invert prose-sm max-w-none">
              {/* Render release_notes as markdown */}
              {/* Option A (simple): whitespace-pre-wrap text */}
              {/* Option B (rich): add react-markdown dependency */}
              <div className="text-sm text-white/80 whitespace-pre-wrap">
                {updateInfo.release_notes || 'No release notes available.'}
              </div>
            </div>
          )}

          {(status === 'downloading') && (
            <div className="space-y-3">
              <p className="text-sm text-white/80">Downloading update...</p>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-white/50 text-right">
                {progress.percentage}%
                {progress.total > 0 && (
                  <> — {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}</>
                )}
              </p>
            </div>
          )}

          {status === 'installing' && (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              <p className="text-sm text-white/80">Installing update and restarting...</p>
            </div>
          )}

          {status === 'scheduled' && (
            <div className="space-y-2">
              <p className="text-sm text-green-400">
                ✓ Update downloaded. It will be installed when you close the app.
              </p>
            </div>
          )}

          {status === 'error' && error && (
            <div className="space-y-3">
              <p className="text-sm text-red-400">Update failed: {error}</p>
              <button
                onClick={onDismissError}
                className="text-sm text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons — NO skip/close button (mandatory) */}
        {(status === 'available' || status === 'error') && (
          <div className="p-4 border-t border-border-dark flex justify-end gap-3">
            <button
              onClick={onUpdateOnExit}
              className="px-4 py-2 text-sm text-white/70 hover:text-white border
                border-border-dark rounded-md hover:bg-white/5 transition-colors"
              data-testid="update-on-exit-btn"
            >
              Update on Exit
            </button>
            <button
              onClick={onUpdateNow}
              className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90
                rounded-md transition-colors"
              data-testid="update-now-btn"
            >
              Update Now
            </button>
          </div>
        )}

        {/* No close/skip button — this is mandatory per spec */}
      </div>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
```

**Markdown Rendering Note:**
The release notes from GitHub are in Markdown. You have two options:

1. **Simple approach (recommended):** Render as `whitespace-pre-wrap` text. GitHub release notes are readable as plain text.
2. **Rich approach:** Add `react-markdown` to dependencies and use `<ReactMarkdown>{updateInfo.release_notes}</ReactMarkdown>`. However, be aware of bundle size (~30KB gzipped for react-markdown + remark).

For now, the simple approach is spec-compliant and avoids new dependencies.

**Tests to write (vitest + RTL):**

Create `src/components/views/UpdateView.test.tsx`:

1. Renders version info (new version + current version)
2. Renders release notes text
3. Shows "Update Now" and "Update on Exit" buttons when status is `'available'`
4. Does NOT show a skip/close button
5. Shows progress bar when status is `'downloading'`
6. Shows installing spinner when status is `'installing'`
7. Shows success message when status is `'scheduled'`
8. Shows error message and retry button when status is `'error'`
9. Calls `onUpdateNow` when "Update Now" is clicked
10. Calls `onUpdateOnExit` when "Update on Exit" is clicked

---

### Task 3.5: Integrate UpdateView into App.tsx
- [ ] **File:** `src/App.tsx`
- **What to do:**

1. Import the hook and component:

```typescript
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { UpdateView } from './components/views/UpdateView';
```

2. Call the hook at the top of the `App` component:

```typescript
const {
  updateInfo,
  status: updateStatus,
  progress: updateProgress,
  error: updateError,
  updateNow,
  updateOnExit,
  dismissError: dismissUpdateError
} = useUpdateCheck();
```

3. Add a `showUpdateView` state to allow auto-dismissal after "Update on Exit":

```typescript
const [showUpdateView, setShowUpdateView] = useState(true);

useEffect(() => {
  if (updateStatus === 'scheduled') {
    const timer = setTimeout(() => setShowUpdateView(false), 3000);
    return () => clearTimeout(timer);
  }
}, [updateStatus]);
```

4. Render the `UpdateView` as an overlay **above** the existing layout, conditionally:

```tsx
return (
  <LayoutProvider>
    {/* Update overlay — shown on top of everything when update is available */}
    {updateInfo && showUpdateView && updateStatus !== 'idle' && updateStatus !== 'checking' && (
      <UpdateView
        updateInfo={updateInfo}
        status={updateStatus}
        progress={updateProgress}
        error={updateError}
        onUpdateNow={updateNow}
        onUpdateOnExit={updateOnExit}
        onDismissError={dismissUpdateError}
      />
    )}
    
    <AppLayout
      activeTab={currentView === "main" ? activeTab : currentView}
      onTabChange={handleSidebarChange}
      dragActive={dragActive}
    >
      {/* ... existing content unchanged ... */}
    </AppLayout>
    <ConfirmDialog />
  </LayoutProvider>
);
```

**Key behavior:**
- The overlay appears immediately on startup if an update is found.
- When user selects "Update on Exit", the overlay transitions to `'scheduled'` state, showing a brief confirmation, then auto-dismisses after 3 seconds.
- The app's main content is visible but **not interactable** behind the overlay (the `bg-black/80` backdrop prevents clicks).
- There is **no skip/close button** — the only options are "Update Now" or "Update on Exit".

---

### Task 3.6: Conductor — User Manual Verification 'Phase 3'
- [ ] **Verification steps:**
  1. Run `npx vitest run` — all frontend tests pass (including new UpdateView + useUpdateCheck tests)
  2. Run `npx tsc --noEmit` — TypeScript compiles without errors
  3. Run `npx tauri dev` — app starts, update check runs in the background
  4. Since no update is published yet, the app should proceed to the main UI normally (update check returns `update_available: false`)

---

## Phase 4: "Update on Exit" & Final Integration

### Task 4.1: Extract Portable Swap Logic into Shared Function
- [ ] **File:** `src-tauri/src/commands/update.rs`
- **What to do:**

Extract the swap logic from the `install_portable_update` command into a public function callable from both the command and the window close event handler:

```rust
/// Shared function: spawn the swap script and exit
/// Called by both the `install_portable_update` command and the on-close event handler
pub fn execute_portable_swap(
    downloaded_path: &str,
    current_exe: &std::path::Path,
) -> Result<(), String> {
    let pid = std::process::id();
    let current_exe_str = current_exe.to_string_lossy();
    
    #[cfg(target_os = "windows")]
    {
        // Write PowerShell script to temp
        let script_path = std::env::temp_dir().join("ai_context_update.ps1");
        let script = format!(
            r#"$ErrorActionPreference = 'Stop'
$pid = {}
$oldExe = '{}'
$newExe = '{}'

# Wait for process to exit
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

# Retry delete old exe
for ($i = 0; $i -lt 10; $i++) {{
    try {{
        Remove-Item $oldExe -Force -ErrorAction Stop
        break
    }} catch {{ Start-Sleep -Seconds 1 }}
}}

# Rename new exe
Move-Item $newExe $oldExe -Force

# Start new version
Start-Process $oldExe

# Self-delete this script
Remove-Item $MyInvocation.MyCommand.Source -Force
"#,
            pid,
            current_exe_str,
            downloaded_path
        );
        
        std::fs::write(&script_path, &script)
            .map_err(|e| format!("Failed to write update script: {}", e))?;
        
        // Spawn detached
        std::process::Command::new("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File"])
            .arg(&script_path)
            .spawn()
            .map_err(|e| format!("Failed to spawn update script: {}", e))?;
    }
    
    Ok(())
}
```

Then wire up the `on_window_event` handler in `lib.rs` (Task 1.5) to call this function:

```rust
if has_pending {
    if let Ok(path) = conn.query_row(
        "SELECT downloaded_path FROM pending_updates WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    ) {
        if let Ok(current_exe) = std::env::current_exe() {
            let _ = commands::update::execute_portable_swap(&path, &current_exe);
        }
    }
}
```

---

### Task 4.2: Handle Standard Updater "Update on Exit" Flow
- [ ] **Details:**

For the standard (non-portable) updater flow, the Tauri plugin has built-in support:

- Calling `update.download()` downloads the update
- Calling `update.install()` **without** `relaunch()` schedules the installation for app close
- The Tauri runtime handles applying the update on the next restart

The frontend `updateOnExit` callback (in `useUpdateCheck.ts`) already handles this in Task 3.3. No additional backend work needed for the standard flow.

**Verification:** Test by calling `download()` → `install()` (no `relaunch()`), close the app, reopen — should be the new version.

---

### Task 4.3: Add Visual Indicator for Scheduled Update
- [ ] **File:** `src/components/Footer.tsx` (or the component that renders the main footer bar)
- **What to do:**

When the user chooses "Update on Exit" and continues working, show a small non-intrusive indicator in the footer:

```tsx
{updateStatus === 'scheduled' && (
  <div
    className="flex items-center gap-1.5 text-xs text-green-400/80"
    data-testid="update-scheduled-badge"
  >
    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
    Update will install on exit
  </div>
)}
```

**How to pass the status:** Pass `updateStatus` as a prop from `App.tsx` down through `FilesView`/`PromptView` to `Footer`. Alternatively, create a lightweight `UpdateStatusContext`. Given the app's size, a prop is simplest.

---

### Task 4.4: Final Integration Tests
- [ ] **What to do:**

Write integration tests that verify the complete flow:

**Frontend tests (vitest):**

1. `App.test.tsx` or new `UpdateIntegration.test.tsx`:
   - Mock `check_for_updates` to return `update_available: true` — verify UpdateView overlay appears
   - Mock `check_for_updates` to return `update_available: false` — verify UpdateView does NOT appear
   - Test "Update on Exit" auto-dismiss: after selecting, verify overlay disappears after timeout
   - Verify the footer badge appears when `updateStatus === 'scheduled'`

**Backend tests (cargo test):**

1. Test `execute_portable_swap`:
   - Verify it creates a PowerShell script at the expected path
   - Verify the script content contains the correct PID and exe paths

2. Test version comparison edge cases:
   - `is_newer("1.0.0", "1.0.0-beta")` — handle/reject pre-release tags gracefully
   - `is_newer("2.0.0", "1.99.99")` — major version bump

---

### Task 4.5: E2E Test Considerations
- [ ] **Details:**

E2E testing of auto-update is inherently difficult (requires real GitHub releases, network access, actual restart). **Do NOT** add automated E2E tests for the update flow.

Instead, rely on:
1. Unit tests for version comparison, DB operations, swap script generation
2. Integration tests with mocked invoke calls for the frontend
3. Manual testing during the first real release

Add a note in `tests/e2e/README.md` explaining that update flow is manually tested.

---

### Task 4.6: Update AGENTS.md and Documentation
- [ ] **File:** `AGENTS.md`
- **What to do:**

Add a section documenting the auto-update architecture:

```markdown
## Auto-Update Architecture

### Standard Flow (MSI/DMG/AppImage)
- Uses `tauri-plugin-updater` with signed bundles
- Checks GitHub Releases for `latest.json` manifest
- Download + install handled by the Tauri runtime
- "Update on Exit": calls `download()` then `install()` (no `relaunch()`)

### Portable Flow (Windows standalone .exe)
- Backend `check_for_updates` calls GitHub Releases API directly
- Downloads new .exe to `{original_name}.update.tmp` in the same directory
- Swap script: PowerShell spawned detached, waits for exit → delete old → rename new → restart
- Pending update tracked in SQLite `pending_updates` table (singleton, id=1)

### Key Files
- Backend commands: `src-tauri/src/commands/update.rs`
- Frontend hook: `src/hooks/useUpdateCheck.ts`
- Frontend view: `src/components/views/UpdateView.tsx`
- DB schema: `src-tauri/src/db/schema.rs` (pending_updates table)
- Tauri config: `src-tauri/tauri.conf.json` (updater endpoints + pubkey)
- Release CI: `.github/workflows/release.yml` (signing + manifest generation)
```

---

### Task 4.7: Conductor — User Manual Verification 'Phase 4'
- [ ] **Verification steps:**
  1. Run `cd src-tauri && cargo test` — all tests pass
  2. Run `npx vitest run` — all tests pass
  3. Run `npx tsc --noEmit` — no errors
  4. Run `npx tauri dev`:
     - App starts successfully
     - Update check completes (should find no update in dev mode)
     - App is fully usable
  5. (Manual) Build a release, create a test tag, verify CI generates `latest.json`
  6. (Manual) Test the full update flow with a real version bump

---

## Appendix A: File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `src-tauri/Cargo.toml` | Modify (add deps) | 1 |
| `src-tauri/src/error.rs` | Modify (add variant) | 1 |
| `src-tauri/src/db/schema.rs` | Modify (add table) | 1 |
| `src-tauri/src/commands/update.rs` | **Create** | 1 |
| `src-tauri/src/commands/mod.rs` | Modify (register module) | 1 |
| `src-tauri/src/lib.rs` | Modify (plugins, commands, event handler) | 1 |
| `src-tauri/tauri.conf.json` | Modify (add updater config) | 1 |
| `src-tauri/capabilities/default.json` | Modify (add permissions) | 1 |
| `.github/workflows/release.yml` | Modify (signing + manifest) | 2 |
| `package.json` | Modify (add frontend deps) | 3 |
| `src/types.ts` | Modify (add types) | 3 |
| `src/hooks/useUpdateCheck.ts` | **Create** | 3 |
| `src/hooks/useUpdateCheck.test.ts` | **Create** | 3 |
| `src/components/views/UpdateView.tsx` | **Create** | 3 |
| `src/components/views/UpdateView.test.tsx` | **Create** | 3 |
| `src/App.tsx` | Modify (integrate overlay) | 3 |
| `src/components/Footer.tsx` | Modify (scheduled badge) | 4 |
| `AGENTS.md` | Modify (add docs) | 4 |

## Appendix B: Test Coverage Matrix

| Component | Test File | Key Scenarios |
|-----------|-----------|---------------|
| Version parsing | `update.rs` (inline `#[cfg(test)]`) | Parse valid/invalid, comparison logic |
| Pending update DB | `update.rs` or `db/mod.rs` tests | Insert, read, check constraint, clear |
| Portable detection | `update.rs` tests | Returns bool, no panic |
| Swap script generation | `update.rs` tests | Script content correctness |
| `useUpdateCheck` hook | `useUpdateCheck.test.ts` | Mount check, status transitions, error handling |
| `UpdateView` component | `UpdateView.test.tsx` | Render states, button clicks, no skip button |
| App integration | `App.test.tsx` | Overlay shown/hidden based on update status |

## Appendix C: GitHub Secrets Required

| Secret Name | Description | Where Used |
|-------------|-------------|-----------|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater signing private key (generated via `tauri signer generate`) | `release.yml` build step |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key (if set) | `release.yml` build step |

## Appendix D: Tauri Updater Endpoint URL Pattern

The endpoint in `tauri.conf.json` should follow this pattern:

```
https://github.com/{OWNER}/{REPO}/releases/latest/download/latest.json
```

The `tauri-action` CI step automatically uploads `latest.json` to each release. GitHub's `/latest/download/` endpoint redirects to the most recent release's assets, so this URL always points to the newest `latest.json`.

## Appendix E: Portable Detection Flowchart

```
App starts
    │
    ├─ is_portable_install()?
    │   │
    │   ├─ YES (portable) ──► Use custom GitHub API + reqwest download + swap script
    │   │
    │   └─ NO (installed) ──► Use tauri-plugin-updater (standard flow)
    │
    ├─ Update available?
    │   │
    │   ├─ YES ──► Show UpdateView overlay
    │   │   │
    │   │   ├─ "Update Now" ──► Download → Install → Restart
    │   │   │
    │   │   └─ "Update on Exit" ──► Download → Store pending → Continue working → Install on close
    │   │
    │   └─ NO ──► Continue to main app
```
