# Specification: Auto-Update Mechanism

## Overview
Implement a mandatory update system that checks for new versions on GitHub, displays release notes, and performs a seamless update/restart process. The system ensures all users move to the newest version by checking for updates on every startup and removing the "Skip" option.

## Functional Requirements

### 1. Update Check Logic (Backend)
- **Source**: Fetch latest release information from GitHub Releases API.
- **Frequency**: Triggered automatically on **every** application startup.
- **Version Comparison**: Compare the current application version with the latest release tag on GitHub.

### 2. Update UI (Frontend)
- **Dedicated Update View**: If an update is found, show a view containing:
    - New version number.
    - **Release Notes**: Rendered Markdown content from the GitHub Release body.
    - **"Update Now" Button**: Triggers immediate download, installation, and restart.
    - **"Update on Exit" Button**: Allows the user to continue their current session, but flags the application to perform the update process automatically once it is closed.
- **Status Feedback**: Show progress during download and installation.

### 3. Automated Update Process
- **Mandatory Nature**: There is no "Skip" or "Remind me later" button. The user must either update now or acknowledge that the update will happen upon closing.
- **Standard Flow**: Utilize Tauri's built-in updater for platform-specific bundles if applicable.
- **Portable Executable Flow**:
    - Download the new executable to a temporary file in the same directory as the current running application.
    - On installation:
        1. Spawn a separate script or process to handle the swap.
        2. Close the current application.
        3. Delete the old executable.
        4. Rename the temporary file to the original executable name.
        5. Restart the application.

### 4. Persistence
- Use the existing SQLite database to track whether an "Update on Exit" is pending.

## Non-Functional Requirements
- **Security**: Verify download signatures if using the standard Tauri updater.
- **Resilience**: Ensure the application doesn't get "stuck" if the update process fails; fallback to the current version if the new one cannot be launched.

## Acceptance Criteria
- [ ] App checks GitHub for updates on every startup.
- [ ] A dedicated UI appears when an update is available, showing the changelog.
- [ ] **No skip option**: Users must choose between "Update Now" or "Update on Exit".
- [ ] Clicking "Update Now" triggers a download, installation, and immediate restart.
- [ ] Choosing "Update on Exit" allows the session to continue but ensures the update runs when the app closes.
- [ ] The app successfully restarts into the new version.
- [ ] Portable mode replacement logic works (temp file -> rename -> restart).

## Out of Scope
- Support for updating from sources other than GitHub.
- Manual "Skip Version" functionality.
