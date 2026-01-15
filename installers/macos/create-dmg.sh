#!/bin/bash

# AI Context Collector - DMG Creator Script for macOS
# Creates a distributable DMG with a nice background and layout

set -e

echo "=================================="
echo "Creating AI Context Collector DMG"
echo "=================================="

# Configuration
APP_BUNDLE="$1"
VERSION="${2:-0.1.0}"
DMG_NAME="AI-Context-Collector-${VERSION}.dmg"
VOLUME_NAME="AI Context Collector"
TEMP_DMG="temp-${DMG_NAME}"

if [ -z "$APP_BUNDLE" ]; then
    echo "Usage: $0 <path-to-app-bundle> [version]"
    echo "Example: $0 ./target/release/bundle/macos/AI\ Context\ Collector.app 0.1.0"
    exit 1
fi

if [ ! -d "$APP_BUNDLE" ]; then
    echo "Error: App bundle not found: $APP_BUNDLE"
    exit 1
fi

# Clean up any existing DMG
rm -f "$DMG_NAME" "$TEMP_DMG"

echo "Creating temporary DMG..."
hdiutil create -size 200m -fs HFS+ -volname "$VOLUME_NAME" "$TEMP_DMG"

echo "Mounting temporary DMG..."
hdiutil attach "$TEMP_DMG" -mountpoint /Volumes/"$VOLUME_NAME"

echo "Copying application bundle..."
cp -R "$APP_BUNDLE" /Volumes/"$VOLUME_NAME"/

echo "Creating Applications symlink..."
ln -s /Applications /Volumes/"$VOLUME_NAME"/Applications

# Optional: Add a README or license
if [ -f "../../LICENSE" ]; then
    cp ../../LICENSE /Volumes/"$VOLUME_NAME"/License.txt
fi

# Set custom icon positions and window size (requires applescript)
echo "Setting Finder window layout..."
osascript <<EOD
tell application "Finder"
    tell disk "$VOLUME_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {100, 100, 700, 450}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 128
        set position of item "AI Context Collector.app" of container window to {150, 150}
        set position of item "Applications" of container window to {450, 150}
        update without registering applications
        delay 2
        close
    end tell
end tell
EOD

echo "Unmounting temporary DMG..."
hdiutil detach /Volumes/"$VOLUME_NAME"

echo "Converting to final compressed DMG..."
hdiutil convert "$TEMP_DMG" -format UDZO -o "$DMG_NAME"

echo "Cleaning up..."
rm "$TEMP_DMG"

echo ""
echo "=================================="
echo "✓ DMG created: $DMG_NAME"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Test the DMG by mounting it"
echo "2. Sign and notarize: ./notarize.sh $DMG_NAME"
