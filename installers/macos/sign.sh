#!/bin/bash

# AI Context Collector - Code Signing Script for macOS
# This script signs the application bundle and Finder Sync Extension

set -e

echo "=================================="
echo "AI Context Collector Code Signing"
echo "=================================="

# Configuration
APP_BUNDLE="$1"
IDENTITY="${2:-Developer ID Application}"
ENTITLEMENTS="entitlements.plist"

if [ -z "$APP_BUNDLE" ]; then
    echo "Usage: $0 <path-to-app-bundle> [signing-identity]"
    echo "Example: $0 ./target/release/bundle/macos/AI Context Collector.app"
    exit 1
fi

if [ ! -d "$APP_BUNDLE" ]; then
    echo "Error: App bundle not found: $APP_BUNDLE"
    exit 1
fi

echo "App Bundle: $APP_BUNDLE"
echo "Signing Identity: $IDENTITY"

# Check if the signing identity exists
if ! security find-identity -v -p codesigning | grep -q "$IDENTITY"; then
    echo "Warning: Signing identity '$IDENTITY' not found"
    echo "Available identities:"
    security find-identity -v -p codesigning
    echo ""
    echo "For development, you can use '-' to sign ad-hoc (no identity)"
    echo "For distribution, you need a valid Developer ID certificate"
    exit 1
fi

echo ""
echo "Step 1: Signing Finder Sync Extension..."
EXTENSION_PATH="$APP_BUNDLE/Contents/PlugIns/FinderSync.appex"

if [ -d "$EXTENSION_PATH" ]; then
    codesign --force --sign "$IDENTITY" \
             --entitlements "$ENTITLEMENTS" \
             --timestamp \
             --options runtime \
             "$EXTENSION_PATH"
    echo "✓ Finder Sync Extension signed"
else
    echo "Warning: Finder Sync Extension not found at $EXTENSION_PATH"
fi

echo ""
echo "Step 2: Signing main application bundle..."
codesign --force --sign "$IDENTITY" \
         --entitlements "$ENTITLEMENTS" \
         --timestamp \
         --options runtime \
         --deep \
         "$APP_BUNDLE"
echo "✓ Main application signed"

echo ""
echo "Step 3: Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

echo ""
echo "Step 4: Displaying signature info..."
codesign --display --verbose=4 "$APP_BUNDLE"

echo ""
echo "=================================="
echo "✓ Code signing complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Test the application locally"
echo "2. Create a DMG for distribution: ./create-dmg.sh"
echo "3. Notarize the DMG: ./notarize.sh"
