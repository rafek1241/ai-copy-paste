# Conductor Context

Can be found in ./conductor/index.html with Project Context, tracks directory, and product guidelines.

## E2E Testing Environment (Local)

When running E2E tests on Windows, you must ensure `tauri-driver` is running and has access to `msedgedriver.exe`.

- **Msedgedriver Path**: `bin/msedgedriver.exe` (relative to project root).
- **Starting the Driver**: The driver must be started on port 4444. You can use the npm script `npm run driver`.
- **Requirements**: WebView2 must be installed on the system.

To run tests manually: `npm run e2e-session`. This will start the dev server, driver, and run the e2e tests.

To run all tests: `npm run test:all`. This will run unit tests, rust (backend) tests, and e2e tests.