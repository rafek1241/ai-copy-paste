# macOS Finder Integration

This directory contains files for integrating AI Context Collector with macOS Finder's context menu using a Finder Sync Extension.

## Files

- **`FinderSync.m`** - Objective-C implementation of the Finder Sync Extension
- **`Info.plist`** - Extension metadata and configuration
- **`entitlements.plist`** - Security entitlements for the extension
- **`sign.sh`** - Code signing script
- **`notarize.sh`** - Notarization script for distribution
- **`create-dmg.sh`** - DMG creation script

## Overview

macOS Finder extensions require:
1. A separate extension bundle embedded in the main application
2. Code signing with a valid Developer ID certificate
3. Notarization by Apple for distribution
4. User permission to enable the extension

## Building the Finder Sync Extension

### Prerequisites

1. **Xcode** (14.0 or later)
2. **Apple Developer Account** (for code signing and notarization)
3. **Developer ID Certificate** installed in Keychain

### Step 1: Create Xcode Project

Since Tauri doesn't natively support Finder Sync Extensions, you need to:

1. Open Xcode
2. Create a new project: **File → New → Project**
3. Select **macOS → App Extension → Finder Sync Extension**
4. Name it `FinderSync`
5. Set the bundle identifier to `com.aicontextcollector.FinderSync`
6. Replace the generated `FinderSync.m` with the provided file
7. Add the `Info.plist` and `entitlements.plist` files

### Step 2: Integrate with Tauri

In your Tauri `tauri.conf.json`, add:

```json
{
  "bundle": {
    "macOS": {
      "files": {
        "Contents/PlugIns/FinderSync.appex": "./installers/macos/FinderSync.appex"
      }
    }
  }
}
```

### Step 3: Build and Sign

```bash
# Build the Tauri application
npm run tauri build

# Sign the bundle
cd installers/macos
chmod +x sign.sh
./sign.sh ../../src-tauri/target/release/bundle/macos/AI\ Context\ Collector.app

# Create DMG for distribution
chmod +x create-dmg.sh
./create-dmg.sh ../../src-tauri/target/release/bundle/macos/AI\ Context\ Collector.app 0.1.0

# Notarize (requires Apple Developer account)
export APPLE_ID="your-email@example.com"
export TEAM_ID="YOUR_TEAM_ID"
export APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
chmod +x notarize.sh
./notarize.sh AI-Context-Collector-0.1.0.dmg
```

## Installation

### For Users

1. **Download and install** the AI Context Collector DMG
2. **Open System Settings → Privacy & Security → Extensions → Finder**
3. **Enable** "AI Context Collector Finder Extension"
4. **Right-click** any file or folder in Finder
5. **Select** "Send to AI Context Collector"

### For Development

```bash
# Copy the app to Applications
cp -R "target/release/bundle/macos/AI Context Collector.app" /Applications/

# Enable the extension via System Settings
# Or use pluginkit (may require disabling SIP):
pluginkit -e use -i com.aicontextcollector.FinderSync
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│         macOS Finder                     │
│  (User right-clicks file/folder)         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     FinderSync.appex                     │
│  (Finder Sync Extension)                 │
│  - Provides context menu items          │
│  - Handles menu item selection           │
└──────────────┬──────────────────────────┘
               │
               ▼ (NSWorkspace API)
┌─────────────────────────────────────────┐
│  AI Context Collector.app                │
│  (Main Tauri Application)                │
│  - Receives file paths as arguments      │
│  - Processes the files                   │
└─────────────────────────────────────────┘
```

### Communication

1. **User Action:** User right-clicks a file/folder in Finder
2. **Extension Menu:** Finder Sync Extension adds "Send to AI Context Collector" menu item
3. **Launch App:** When selected, extension uses `NSWorkspace` to launch the main app
4. **Pass Paths:** Selected file/folder paths are passed as arguments or via App Groups
5. **Process:** Main app receives paths and processes them

### Alternative: Distributed Notifications

For more complex communication, you can use App Groups:

```objective-c
// In FinderSync.m
NSString *sharedPath = [[NSFileManager defaultManager] 
    containerURLForSecurityApplicationGroupIdentifier:@"group.com.aicontextcollector"].path;
NSString *filePath = [sharedPath stringByAppendingPathComponent:@"selected-paths.json"];
// Write selected paths to file
```

Then in your Tauri app, monitor this shared file.

## Code Signing

### Development Signing

For local testing:

```bash
./sign.sh "AI Context Collector.app" "-"
```

The `-` means ad-hoc signing (no certificate required).

### Distribution Signing

For distribution:

```bash
./sign.sh "AI Context Collector.app" "Developer ID Application: Your Name (TEAM_ID)"
```

### Verifying Signature

```bash
codesign --verify --deep --strict --verbose=2 "AI Context Collector.app"
spctl --assess --type execute --verbose=4 "AI Context Collector.app"
```

## Notarization

Apple requires notarization for apps distributed outside the Mac App Store:

1. **Get credentials:**
   - Apple ID: Your developer account email
   - Team ID: From developer.apple.com/account
   - App-Specific Password: Generate at appleid.apple.com

2. **Notarize:**
   ```bash
   export APPLE_ID="your-email@example.com"
   export TEAM_ID="ABCDE12345"
   export APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   ./notarize.sh AI-Context-Collector-0.1.0.dmg
   ```

3. **Wait:** Notarization takes 5-15 minutes

4. **Staple:** The script automatically staples the ticket to the DMG

## Troubleshooting

### Extension not appearing

1. Check if the extension is enabled:
   ```bash
   pluginkit -m -v
   ```

2. Enable manually:
   ```bash
   pluginkit -e use -i com.aicontextcollector.FinderSync
   ```

3. Restart Finder:
   ```bash
   killall Finder
   ```

### "This extension cannot be loaded"

- Check code signature: `codesign --verify --verbose=4 FinderSync.appex`
- Check entitlements: `codesign -d --entitlements - FinderSync.appex`
- Check console logs: `log stream --predicate 'subsystem == "com.apple.FinderKit"'`

### App not launching from context menu

1. Check bundle identifier matches in `FinderSync.m`
2. Check app is in `/Applications/`
3. Check app signature: `codesign --verify "AI Context Collector.app"`
4. Check logs: `log show --predicate 'subsystem == "com.apple.launchservices"' --last 5m`

### Notarization failed

1. Check the log: `cat notarization-log.json`
2. Common issues:
   - Missing hardened runtime flag
   - Invalid entitlements
   - Unsigned binaries in the bundle
   - Missing Info.plist entries

## Security Considerations

### Sandboxing

Finder Sync Extensions run in a restricted sandbox:
- Limited file system access
- Cannot directly communicate with main app (requires XPC or App Groups)
- Must declare entitlements for file access

### Permissions

The extension requires:
- `com.apple.security.files.user-selected.read-write` - Access to selected files
- App Groups - Share data with main app
- Hardened Runtime - Required for notarization

### Privacy

- Extension only accesses files user explicitly selects
- No background scanning or monitoring
- All file operations logged by macOS

## Development Tips

### Testing Without Notarization

For development, disable Gatekeeper temporarily:

```bash
sudo spctl --master-disable
```

⚠️ **Warning:** Re-enable after testing: `sudo spctl --master-enable`

### Debugging

1. **Console.app:** View system logs filtered by "FinderSync"
2. **Xcode Debugger:** Attach to FinderSync process
3. **NSLog:** Statements appear in Console.app

### Hot Reload

After rebuilding:

```bash
killall Finder
pluginkit -r /Applications/AI\ Context\ Collector.app/Contents/PlugIns/FinderSync.appex
```

## Further Reading

- [Finder Sync Extensions](https://developer.apple.com/documentation/findersync)
- [Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [App Sandbox](https://developer.apple.com/documentation/security/app_sandbox)

## Notes

- **Tauri Limitation:** Tauri doesn't have built-in support for Finder Sync Extensions, so you need to build it separately in Xcode and copy it into the bundle.
- **Alternative Approach:** For a simpler (but less integrated) solution, use AppleScript or Automator Quick Actions instead of a Finder Sync Extension.
- **Windows Comparison:** This is more complex than Windows registry-based context menus due to macOS's security model.
