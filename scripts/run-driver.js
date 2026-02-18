import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "visible";
const isBackground = mode === "background";

const isWindows = process.platform === "win32";
const command = "tauri-driver";
const args = [
  "--port",
  "4445",
  "--native-port",
  "9515",
  "--native-driver",
  "bin/msedgedriver.exe",
];

const env = {
  ...process.env,
  E2E_BACKGROUND: isBackground ? "1" : "0",
  E2E_VISIBLE: isBackground ? "0" : "1",
};

let child = spawn(command, args, {
  env,
  stdio: "inherit",
  shell: isWindows,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  const errorCode = typeof error === "object" && error && "code" in error ? error.code : undefined;
  if (isWindows && errorCode === "EINVAL") {
    child = spawn("npm.cmd", ["exec", "tauri-driver", "--", ...args], {
      env,
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    });
    child.on("error", (fallbackError) => {
      console.error("Failed to start tauri-driver (fallback):", fallbackError);
      process.exit(1);
    });
    return;
  }

  console.error("Failed to start tauri-driver:", error);
  process.exit(1);
});
