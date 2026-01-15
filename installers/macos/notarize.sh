#!/bin/bash

# AI Context Collector - Notarization Script for macOS
# This script submits the DMG to Apple for notarization

set -e

echo "======================================"
echo "AI Context Collector Notarization"
echo "======================================"

# Configuration
DMG_PATH="$1"
APPLE_ID="${APPLE_ID:-}"
TEAM_ID="${TEAM_ID:-}"
APP_SPECIFIC_PASSWORD="${APP_SPECIFIC_PASSWORD:-}"

if [ -z "$DMG_PATH" ]; then
    echo "Usage: $0 <path-to-dmg>"
    echo "Example: $0 ./AI-Context-Collector-0.1.0.dmg"
    echo ""
    echo "Required environment variables:"
    echo "  APPLE_ID - Your Apple ID email"
    echo "  TEAM_ID - Your Team ID (from developer account)"
    echo "  APP_SPECIFIC_PASSWORD - App-specific password (from appleid.apple.com)"
    exit 1
fi

if [ ! -f "$DMG_PATH" ]; then
    echo "Error: DMG not found: $DMG_PATH"
    exit 1
fi

if [ -z "$APPLE_ID" ] || [ -z "$TEAM_ID" ] || [ -z "$APP_SPECIFIC_PASSWORD" ]; then
    echo "Error: Required environment variables not set"
    echo ""
    echo "Please set:"
    echo "  export APPLE_ID='your-email@example.com'"
    echo "  export TEAM_ID='XXXXXXXXXX'"
    echo "  export APP_SPECIFIC_PASSWORD='xxxx-xxxx-xxxx-xxxx'"
    echo ""
    echo "Get your Team ID from: https://developer.apple.com/account"
    echo "Generate app-specific password: https://appleid.apple.com/account/manage"
    exit 1
fi

echo "DMG: $DMG_PATH"
echo "Apple ID: $APPLE_ID"
echo "Team ID: $TEAM_ID"
echo ""

# Step 1: Submit for notarization
echo "Step 1: Submitting to Apple for notarization..."
echo "This may take several minutes..."

SUBMISSION_OUTPUT=$(xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --team-id "$TEAM_ID" \
    --password "$APP_SPECIFIC_PASSWORD" \
    --wait)

echo "$SUBMISSION_OUTPUT"

# Extract submission ID
SUBMISSION_ID=$(echo "$SUBMISSION_OUTPUT" | grep "id:" | head -1 | awk '{print $2}')

if [ -z "$SUBMISSION_ID" ]; then
    echo "Error: Could not extract submission ID"
    exit 1
fi

echo ""
echo "Submission ID: $SUBMISSION_ID"

# Step 2: Check status
echo ""
echo "Step 2: Checking notarization status..."
xcrun notarytool info "$SUBMISSION_ID" \
    --apple-id "$APPLE_ID" \
    --team-id "$TEAM_ID" \
    --password "$APP_SPECIFIC_PASSWORD"

# Step 3: Get log if there were issues
echo ""
echo "Step 3: Fetching notarization log..."
xcrun notarytool log "$SUBMISSION_ID" \
    --apple-id "$APPLE_ID" \
    --team-id "$TEAM_ID" \
    --password "$APP_SPECIFIC_PASSWORD" \
    notarization-log.json

echo "Log saved to: notarization-log.json"

# Step 4: Staple the notarization ticket
echo ""
echo "Step 4: Stapling notarization ticket to DMG..."
xcrun stapler staple "$DMG_PATH"

echo ""
echo "Step 5: Verifying staple..."
xcrun stapler validate "$DMG_PATH"

echo ""
echo "======================================"
echo "✓ Notarization complete!"
echo "======================================"
echo ""
echo "The DMG is now notarized and ready for distribution."
echo "Users on macOS 10.14.5+ will be able to open it without warnings."
