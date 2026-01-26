# Conductor Context

... (existing content) ...

## E2E Testing Environment (Local)

When running E2E tests on Windows, you must ensure `tauri-driver` is running and has access to `msedgedriver.exe`.

- **Msedgedriver Path**: `bin/msedgedriver.exe` (relative to project root).
- **Starting the Driver**: The driver must be started on port 4444. You can use the npm script `npm run driver`.
- **Requirements**: WebView2 must be installed on the system.

To run tests manually:
1. Start driver: `tauri-driver --native-driver bin/msedgedriver.exe`
2. Run tests: `npm run test:e2e`

