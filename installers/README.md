# Platform Installers for AI Context Collector

This directory contains platform-specific shell integration installers that add context menu support for Windows, macOS, and Linux.

## Overview

These installers enable users to right-click on files and folders in their file manager and select "Send to AI Context Collector" to quickly open them in the application.

## Platform Support

### ✅ Windows
- **Method:** Registry-based context menu entries
- **Supports:** Windows 7, 8, 10, 11
- **Location:** [`windows/`](windows/)
- **Status:** Complete with NSIS installer

### ✅ macOS
- **Method:** Finder Sync Extension
- **Supports:** macOS 10.14.5+
- **Location:** [`macos/`](macos/)
- **Status:** Complete with code signing and notarization scripts

### ✅ Linux
- **Method:** File manager extensions
- **Supports:** GNOME (Nautilus), KDE (Dolphin), Cinnamon (Nemo)
- **Location:** [`linux/`](linux/)
- **Status:** Complete with auto-detection installer

## Quick Start

### Windows

```powershell
# Manual installation (Quick)
cd installers\windows
# Double-click context-menu.reg

# Or build NSIS installer (Recommended)
# 1. Install NSIS from https://nsis.sourceforge.io/
# 2. Build Tauri app: npm run tauri build
# 3. Right-click setup.nsi and select "Compile NSIS Script"
# 4. Run the generated ai-context-collector-setup.exe
```

See [windows/README.md](windows/README.md) for detailed instructions.

### macOS

```bash
# Build Finder Sync Extension in Xcode (required first time)
cd installers/macos

# Sign the application
./sign.sh ../../src-tauri/target/release/bundle/macos/AI\ Context\ Collector.app

# Create DMG
./create-dmg.sh ../../src-tauri/target/release/bundle/macos/AI\ Context\ Collector.app 0.1.0

# Notarize (requires Apple Developer account)
export APPLE_ID="your-email@example.com"
export TEAM_ID="YOUR_TEAM_ID"
export APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
./notarize.sh AI-Context-Collector-0.1.0.dmg
```

See [macos/README.md](macos/README.md) for detailed instructions.

### Linux

```bash
# Auto-install for your desktop environment
cd installers/linux
./install.sh

# Or install for specific file manager
./install.sh nautilus  # GNOME
./install.sh dolphin   # KDE
./install.sh nemo      # Cinnamon
./install.sh all       # All supported

# Uninstall
./install.sh uninstall
```

See [linux/README.md](linux/README.md) for detailed instructions.

## Installation Methods Comparison

| Platform | Method | Complexity | User Experience | Distribution |
|----------|--------|------------|-----------------|--------------|
| **Windows** | Registry entries | Low | Good (works on all versions) | Simple .reg file or NSIS installer |
| **macOS** | Finder Sync Extension | High | Excellent (native integration) | Requires code signing + notarization |
| **Linux** | File manager extensions | Medium | Good (varies by DE) | Per-user installation |

## Directory Structure

```
installers/
├── README.md                          # This file
│
├── windows/                           # Windows integration
│   ├── README.md                      # Windows-specific docs
│   ├── context-menu.reg               # Registry entries (install)
│   ├── uninstall-context-menu.reg     # Registry entries (uninstall)
│   └── setup.nsi                      # NSIS installer script
│
├── macos/                             # macOS integration
│   ├── README.md                      # macOS-specific docs
│   ├── FinderSync.m                   # Finder Sync Extension code
│   ├── Info.plist                     # Extension metadata
│   ├── entitlements.plist             # Security entitlements
│   ├── sign.sh                        # Code signing script
│   ├── notarize.sh                    # Notarization script
│   └── create-dmg.sh                  # DMG creation script
│
└── linux/                             # Linux integration
    ├── README.md                      # Linux-specific docs
    ├── nautilus-extension.py          # GNOME Nautilus extension
    ├── dolphin.desktop                # KDE Dolphin service menu
    ├── nemo.nemo_action               # Cinnamon Nemo action
    └── install.sh                     # Automated installer
```

## How It Works

### User Workflow

1. **User Action:** Right-click on file(s) or folder(s) in file manager
2. **Context Menu:** "Send to AI Context Collector" appears in menu
3. **Application Launch:** Main app launches with selected paths as arguments
4. **Processing:** App receives paths and processes them

### Implementation Details

#### Windows
- Registers shell extension via Windows Registry
- Adds entries to `HKEY_CLASSES_ROOT\*\shell\` (files), `Directory\shell\` (folders), and `Directory\Background\shell\` (background)
- Passes file paths via `%1` or `%V` parameters

#### macOS
- Uses Finder Sync Extension (separate app extension)
- Communicates via NSWorkspace API
- Requires code signing and notarization for distribution
- Extension runs in separate process/sandbox

#### Linux
- Uses file-manager-specific extension APIs
- Nautilus: Python extension implementing MenuProvider
- Dolphin: Desktop service menu file
- Nemo: Action file with execution command
- Each passes file paths differently (`file://` URIs or direct paths)

## Application Integration

### Handling Command-Line Arguments

Your Tauri application needs to handle file/folder paths passed as arguments:

**Rust (main.rs):**

```rust
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Get command-line arguments
            let args: Vec<String> = std::env::args().collect();
            
            // Skip the first argument (binary path)
            let file_paths: Vec<String> = args.into_iter().skip(1).collect();
            
            if !file_paths.is_empty() {
                // Process the paths
                println!("Received paths: {:?}", file_paths);
                
                // Option 1: Emit event to frontend
                app.emit_all("paths-received", file_paths.clone()).ok();
                
                // Option 2: Call indexing command directly
                // index_paths(file_paths)?;
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**TypeScript (frontend):**

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for paths received from context menu
listen<string[]>('paths-received', (event) => {
    console.log('Received paths:', event.payload);
    // Process paths in your UI
    processFiles(event.payload);
});
```

### Testing Context Menu Integration

1. **Build the application:**
   ```bash
   npm run tauri build
   ```

2. **Install context menu integration** (follow platform-specific instructions above)

3. **Test:**
   - Right-click on a file → Select "Send to AI Context Collector"
   - Right-click on a folder → Select "Send to AI Context Collector"
   - Right-click in empty space in folder (Windows/Linux) → Select menu item

4. **Verify:**
   - Application launches
   - File/folder paths are received correctly
   - Application processes the files

### Debugging

**Windows:**
```powershell
# Check registry entries
regedit.exe
# Navigate to: HKEY_CLASSES_ROOT\*\shell\AIContextCollector

# Test command manually
& "C:\Program Files\AI Context Collector\ai-context-collector.exe" "C:\test\file.txt"

# View logs
# Check Event Viewer → Application logs
```

**macOS:**
```bash
# Check if extension is loaded
pluginkit -m -v | grep AIContextCollector

# View extension logs
log stream --predicate 'subsystem == "com.apple.FinderKit"' --level debug

# Test app launch
open -a "AI Context Collector" --args "/path/to/file"
```

**Linux:**
```bash
# Test Nautilus extension
nautilus -q
G_MESSAGES_DEBUG=all nautilus 2>&1 | grep -i python

# Test command manually
ai-context-collector /path/to/file

# View system logs
journalctl -f | grep -i nautilus
```

## Distribution Checklist

Before distributing your application with context menu integration:

### All Platforms
- [ ] Test on clean system without development tools
- [ ] Verify application launches correctly from context menu
- [ ] Test with multiple files selected
- [ ] Test with folders
- [ ] Test with files containing special characters in path
- [ ] Add error handling for missing/invalid paths
- [ ] Document installation process in user guide

### Windows Specific
- [ ] Test on Windows 10 and 11
- [ ] Test with admin and non-admin users
- [ ] Include uninstaller in NSIS script
- [ ] Add application to Windows Firewall exceptions (if needed)
- [ ] Test "Show more options" submenu on Windows 11

### macOS Specific
- [ ] Code sign with valid Developer ID certificate
- [ ] Notarize the DMG
- [ ] Test on macOS 10.14.5+
- [ ] Verify Finder Sync Extension appears in System Settings
- [ ] Test with Gatekeeper enabled
- [ ] Document user permission requirements

### Linux Specific
- [ ] Test on Ubuntu/GNOME
- [ ] Test on KDE Plasma
- [ ] Test on Linux Mint/Cinnamon
- [ ] Provide .deb or .rpm packages
- [ ] Test with different installation paths
- [ ] Document required dependencies (python-nautilus, etc.)

## Security Considerations

### Windows
- Registry modifications require administrator privileges
- Application runs with user privileges (not elevated)
- Validate all file paths before processing
- Be aware of Windows Defender scanning

### macOS
- Finder Sync Extension runs in restricted sandbox
- Requires user approval in System Settings
- Must be code signed for distribution
- Notarization required for non-App Store distribution
- User must grant file access permissions

### Linux
- Extensions run with user privileges
- No special permissions required
- File manager extensions can only access user-selected files
- Python extensions are sandboxed by file manager

### General Security Best Practices
- **Validate input:** Check all file paths for validity
- **Sanitize paths:** Prevent path traversal attacks
- **Limit file size:** Don't process excessively large files
- **Handle errors:** Gracefully handle permission denied, file not found, etc.
- **No shell injection:** Use proper argument passing, not shell commands
- **Log actions:** Keep audit trail of processed files

## Troubleshooting

### Context menu not appearing

**Windows:**
- Check registry entries exist
- Try logging out and back in
- Restart Explorer: `taskkill /f /im explorer.exe && explorer.exe`

**macOS:**
- Enable extension in System Settings → Extensions → Finder
- Restart Finder: `killall Finder`
- Check Console.app for error messages

**Linux:**
- Restart file manager
- Check if extension files are in correct location
- Verify application is in PATH

### Application not launching

**All Platforms:**
- Verify application path in context menu configuration
- Test launching application manually from terminal
- Check application logs for startup errors
- Ensure application has execute permissions

## Contributing

When contributing installer improvements:

1. Test on target platform
2. Update relevant README.md
3. Add troubleshooting section if needed
4. Test uninstall process
5. Update this main README if adding new platforms

## License

These installer scripts are part of the AI Context Collector project. See [LICENSE](../LICENSE) for details.

## Support

For issues with context menu integration:

1. Check platform-specific README.md
2. Review troubleshooting sections
3. Check application logs
4. File an issue with:
   - Platform and version
   - File manager and version
   - Error messages/logs
   - Steps to reproduce

## References

### Windows
- [Shell Extension Documentation](https://docs.microsoft.com/en-us/windows/win32/shell/context-menu-handlers)
- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)

### macOS
- [Finder Sync Extensions](https://developer.apple.com/documentation/findersync)
- [Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

### Linux
- [Nautilus Python Extensions](https://wiki.gnome.org/Projects/NautilusPython)
- [KDE Service Menus](https://develop.kde.org/docs/apps/dolphin/service-menus/)
- [Nemo Actions](https://github.com/linuxmint/nemo/blob/master/files/usr/share/nemo/actions/sample.nemo_action)
