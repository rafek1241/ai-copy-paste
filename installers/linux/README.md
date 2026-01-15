# Linux Context Menu Integration

This directory contains files for integrating AI Context Collector with various Linux file managers' context menus.

## Supported File Managers

- **Nautilus** (GNOME Files) - GNOME desktop
- **Dolphin** - KDE Plasma desktop
- **Nemo** - Cinnamon desktop

## Files

- **`nautilus-extension.py`** - Python extension for Nautilus
- **`dolphin.desktop`** - Service menu file for Dolphin
- **`nemo.nemo_action`** - Action file for Nemo
- **`install.sh`** - Automated installation script

## Quick Installation

### Automated Installation (Recommended)

```bash
# Auto-detect desktop environment and install
cd installers/linux
chmod +x install.sh
./install.sh

# Or install for specific file manager
./install.sh nautilus  # For GNOME
./install.sh dolphin   # For KDE
./install.sh nemo      # For Cinnamon
./install.sh all       # For all file managers
```

### Uninstall

```bash
./install.sh uninstall
```

## Manual Installation

### Nautilus (GNOME Files)

#### Prerequisites

Install python-nautilus:

```bash
# Debian/Ubuntu
sudo apt install python3-nautilus gir1.2-nautilus-4.0

# Fedora
sudo dnf install nautilus-python

# Arch Linux
sudo pacman -S python-nautilus
```

#### Install Extension

```bash
# Create extension directory
mkdir -p ~/.local/share/nautilus-python/extensions

# Copy extension
cp nautilus-extension.py ~/.local/share/nautilus-python/extensions/ai-context-collector.py

# Make executable
chmod +x ~/.local/share/nautilus-python/extensions/ai-context-collector.py

# Restart Nautilus
nautilus -q && nautilus &
```

#### Verify Installation

Check if extension is loaded:

```bash
nautilus -q
journalctl -f | grep -i nautilus
# Then open Nautilus and check logs
```

### Dolphin (KDE)

#### Install Service Menu

```bash
# Create service menu directory (KDE 5)
mkdir -p ~/.local/share/kservices5/ServiceMenus

# Or for KDE 6
mkdir -p ~/.local/share/kio/servicemenus

# Copy service menu file
cp dolphin.desktop ~/.local/share/kservices5/ServiceMenus/ai-context-collector.desktop
# Or for KDE 6
cp dolphin.desktop ~/.local/share/kio/servicemenus/ai-context-collector.desktop

# Restart Dolphin
killall dolphin
dolphin &
```

#### Verify Installation

1. Open Dolphin
2. Right-click any file or folder
3. Look for "AI Context Collector" menu item

### Nemo (Cinnamon)

#### Install Action

```bash
# Create action directory
mkdir -p ~/.local/share/nemo/actions

# Copy action file
cp nemo.nemo_action ~/.local/share/nemo/actions/ai-context-collector.nemo_action

# Restart Nemo
nemo -q && nemo &
```

#### Verify Installation

1. Open Nemo
2. Right-click any file or folder
3. Look for "Send to AI Context Collector" menu item

## How It Works

### Nautilus Extension

Nautilus extensions are Python scripts that implement the `Nautilus.MenuProvider` interface:

1. **Discovery:** Nautilus loads Python scripts from `~/.local/share/nautilus-python/extensions/`
2. **Menu Items:** Extension provides menu items via `get_file_items()` and `get_background_items()`
3. **Activation:** When user clicks menu item, extension launches the app with selected file paths

### Dolphin Service Menu

Dolphin service menus are `.desktop` files in the service menu directory:

1. **Discovery:** Dolphin scans `~/.local/share/kservices5/ServiceMenus/`
2. **Display:** Menu item appears in context menu
3. **Execution:** `Exec` line is run with `%U` replaced by selected file URLs

### Nemo Action

Nemo actions are `.nemo_action` files:

1. **Discovery:** Nemo scans `~/.local/share/nemo/actions/`
2. **Display:** Action appears in context menu based on selection criteria
3. **Execution:** `Exec` line is run with `%F` replaced by selected file paths

## Configuration

### Customize Menu Text

**Nautilus:** Edit `nautilus-extension.py`:
```python
label='Your Custom Text Here'
```

**Dolphin:** Edit `dolphin.desktop`:
```ini
Name=Your Custom Text Here
```

**Nemo:** Edit `nemo.nemo_action`:
```ini
Name=Your Custom Text Here
```

### Customize Icon

**Nautilus:** Edit `nautilus-extension.py`:
```python
icon='your-icon-name'
```

**Dolphin:** Edit `dolphin.desktop`:
```ini
Icon=your-icon-name
```

**Nemo:** Edit `nemo.nemo_action`:
```ini
Icon-Name=your-icon-name
```

Common icon names: `document-send`, `folder-open`, `applications-utilities`

### Change Application Path

If your app is not in PATH, edit the files to use full path:

**Nautilus:** Edit `nautilus-extension.py`:
```python
self.app_path = '/path/to/ai-context-collector'
```

**Dolphin:** Edit `dolphin.desktop`:
```ini
Exec=/path/to/ai-context-collector %U
```

**Nemo:** Edit `nemo.nemo_action`:
```ini
Exec=/path/to/ai-context-collector %F
```

## Troubleshooting

### Nautilus: Extension not loading

1. **Check if python-nautilus is installed:**
   ```bash
   python3 -c "import gi; gi.require_version('Nautilus', '4.0'); from gi.repository import Nautilus"
   ```

2. **Check Nautilus version:**
   ```bash
   nautilus --version
   ```
   For Nautilus 3.x, change `require_version('Nautilus', '4.0')` to `'3.0'`

3. **Check extension file permissions:**
   ```bash
   ls -l ~/.local/share/nautilus-python/extensions/
   ```

4. **View Nautilus logs:**
   ```bash
   nautilus -q
   G_MESSAGES_DEBUG=all nautilus 2>&1 | grep -i python
   ```

### Dolphin: Menu item not appearing

1. **Check service menu directory:**
   ```bash
   ls -la ~/.local/share/kservices5/ServiceMenus/
   ls -la ~/.local/share/kio/servicemenus/
   ```

2. **Check desktop file syntax:**
   ```bash
   desktop-file-validate ~/.local/share/kservices5/ServiceMenus/ai-context-collector.desktop
   ```

3. **Clear Dolphin cache:**
   ```bash
   rm -rf ~/.cache/dolphin
   kbuildsycoca5  # For KDE 5
   kbuildsycoca6  # For KDE 6
   ```

### Nemo: Action not visible

1. **Check action file location:**
   ```bash
   ls -la ~/.local/share/nemo/actions/
   ```

2. **Check action file syntax:**
   Open `nemo.nemo_action` and verify all required fields are present

3. **View Nemo debug output:**
   ```bash
   nemo -q
   NEMO_DEBUG=Actions nemo
   ```

### App not launching

1. **Check if app is in PATH:**
   ```bash
   which ai-context-collector
   ```

2. **Test manual launch:**
   ```bash
   ai-context-collector /path/to/test/file
   ```

3. **Check file manager logs:**
   ```bash
   journalctl -f | grep -i nautilus
   journalctl -f | grep -i dolphin
   journalctl -f | grep -i nemo
   ```

## Desktop Environment Detection

The install script auto-detects your desktop environment using:

1. `$XDG_CURRENT_DESKTOP` environment variable
2. `$DESKTOP_SESSION` environment variable
3. Presence of DE-specific binaries

Manual override:
```bash
./install.sh nautilus  # Force Nautilus installation
```

## Security Considerations

### File Manager Extensions

- Extensions run with user privileges (not elevated)
- Extensions can only access files selected by user
- Python extensions are sandboxed by the file manager
- All file operations are logged by the system

### Input Validation

The application should validate and sanitize all path arguments:
- Check for path traversal attempts
- Verify file/directory existence
- Handle special characters properly
- Limit file size for processing

## Development Tips

### Testing Changes

After modifying extension files:

```bash
# Nautilus
nautilus -q && nautilus &

# Dolphin
killall dolphin && dolphin &

# Nemo
nemo -q && nemo &
```

### Debugging Nautilus Extension

Add debug prints:
```python
import sys
print("Debug message", file=sys.stderr)
```

Then view output:
```bash
nautilus -q
nautilus 2>&1 | grep "Debug message"
```

### File Manager Compatibility

Different file managers use different URL schemes:
- Nautilus: `file:///path/to/file`
- Dolphin: `file:///path/to/file`
- Nemo: File paths directly

The extensions handle this automatically.

## Alternative Approaches

### Desktop Entry

Create a `.desktop` file in `~/.local/share/applications/`:

```ini
[Desktop Entry]
Name=AI Context Collector
Exec=ai-context-collector %F
Type=Application
MimeType=inode/directory;
```

Then right-click → "Open With" → Select app

### Thunar (Xfce)

For Thunar file manager, create custom actions:
1. Open Thunar
2. Edit → Configure custom actions
3. Add new action with command: `ai-context-collector %F`

## Further Reading

- [Nautilus Python Extensions](https://wiki.gnome.org/Projects/NautilusPython)
- [Dolphin Service Menus](https://develop.kde.org/docs/apps/dolphin/service-menus/)
- [Nemo Actions](https://github.com/linuxmint/nemo/blob/master/files/usr/share/nemo/actions/sample.nemo_action)
- [Desktop Entry Specification](https://specifications.freedesktop.org/desktop-entry-spec/latest/)

## Notes

- **Permissions:** No root/sudo required for installation
- **Multi-user:** Each user must install separately (user-level installation)
- **Updates:** Rerun `install.sh` to update extensions after application updates
- **Portability:** Extensions are tied to the current user's home directory
