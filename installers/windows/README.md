# Windows Context Menu Integration

This directory contains files for integrating AI Context Collector with Windows Explorer's context menu.

## Files

- **`context-menu.reg`** - Registry file for manual installation of context menu entries
- **`uninstall-context-menu.reg`** - Registry file to remove context menu entries
- **`setup.nsi`** - NSIS installer script for automated installation

## Installation Methods

### Method 1: Manual Registry Installation (Quick)

1. **Install context menu:**
   - Double-click `context-menu.reg`
   - Click "Yes" when prompted by User Account Control
   - Click "Yes" to confirm adding entries to the registry
   - Click "OK" when complete

2. **Uninstall context menu:**
   - Double-click `uninstall-context-menu.reg`
   - Click "Yes" when prompted
   - Click "OK" when complete

**Note:** You must manually copy the application executable to:
```
C:\Program Files\AI Context Collector\ai-context-collector.exe
```

### Method 2: NSIS Installer (Recommended)

1. **Build the installer:**
   - Install [NSIS](https://nsis.sourceforge.io/Download) (3.08 or later)
   - Build the Tauri application in release mode:
     ```bash
     npm run tauri build
     ```
   - Right-click on `setup.nsi` and select "Compile NSIS Script"
   - Or run from command line:
     ```bash
     makensis setup.nsi
     ```
   - The installer will be created as `ai-context-collector-setup.exe`

2. **Run the installer:**
   - Double-click `ai-context-collector-setup.exe`
   - Follow the installation wizard
   - Select desired components (context menu, shortcuts, etc.)

3. **Uninstall:**
   - Use "Add or Remove Programs" in Windows Settings
   - Or run the uninstaller from the Start Menu
   - Or run `C:\Program Files\AI Context Collector\uninstall.exe`

## How It Works

### Registry Entries

The context menu integration adds registry keys under:

- `HKEY_CLASSES_ROOT\*\shell\AIContextCollector` - For files
- `HKEY_CLASSES_ROOT\Directory\shell\AIContextCollector` - For folders
- `HKEY_CLASSES_ROOT\Directory\Background\shell\AIContextCollector` - For folder backgrounds

These keys contain:
- Display name for the menu item
- Icon path (from the application executable)
- Command to execute when selected

### Command Arguments

When a user selects "Send to AI Context Collector" from the context menu:

- **For files:** `%1` passes the full file path
- **For folders:** `%1` passes the full folder path
- **For background:** `%V` passes the current folder path

The application should handle these command-line arguments on startup.

## Windows 11 Note

On Windows 11, this registry-based approach places the menu item under "Show more options" (the legacy context menu). For top-level integration without the submenu, you would need to implement an `IExplorerCommand` COM server with Sparse Package identity, which is more complex.

This simple registry approach works on all Windows versions (7, 8, 10, 11) and is easier to maintain.

## Troubleshooting

### Context menu not appearing
1. Check that the registry entries are present using `regedit.exe`
2. Verify the executable path in the registry matches the actual location
3. Try logging out and back in, or restarting Explorer:
   ```powershell
   Stop-Process -Name explorer -Force
   ```

### Permission denied errors
- Registry modifications require administrator privileges
- Right-click the `.reg` file and select "Run as administrator"

### Application not launching from context menu
1. Check the command path in the registry
2. Test the command manually in PowerShell:
   ```powershell
   & "C:\Program Files\AI Context Collector\ai-context-collector.exe" "C:\test\path"
   ```
3. Check Windows Event Viewer for error messages

## Development Notes

### Testing Changes

1. Modify the `.reg` or `.nsi` files as needed
2. For `.reg` files: Double-click to apply, then test by right-clicking files/folders
3. For `.nsi` files: Recompile with NSIS, reinstall, then test

### Customization

To change the menu text, icon, or executable path:

1. **In `context-menu.reg`:**
   - Edit the `@="Your Menu Text"` lines
   - Edit the `Icon=` paths
   - Edit the command paths in the `command` subkeys

2. **In `setup.nsi`:**
   - Edit the `WriteRegStr` commands in the `SecContextMenu` section
   - Update the file paths in the `SecMain` section

## Security Considerations

- Context menu entries run with user privileges (not elevated)
- The application should validate and sanitize all path arguments
- Registry-based integration is read by Explorer on startup
- Changes may require Explorer restart or logout to take effect

## Further Reading

- [Windows Registry Documentation](https://docs.microsoft.com/en-us/windows/win32/shell/context-menu-handlers)
- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)
- [Shell Extensions Best Practices](https://docs.microsoft.com/en-us/windows/win32/shell/shell-exts)
