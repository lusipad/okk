import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

function parseArgs(argv) {
  const options = {
    mode: "source",
    entry: "packages/desktop/dist/main/index.js",
    outputDir: "output/desktop-smoke",
    timeoutMs: 120000,
    cwd: process.cwd()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === "--mode" && next) {
      options.mode = next;
      index += 1;
    } else if (current === "--entry" && next) {
      options.entry = next;
      index += 1;
    } else if (current === "--outputDir" && next) {
      options.outputDir = next;
      index += 1;
    } else if (current === "--timeoutMs" && next) {
      options.timeoutMs = Number(next);
      index += 1;
    } else if (current === "--cwd" && next) {
      options.cwd = next;
      index += 1;
    }
  }

  return options;
}

async function waitForState(statePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const raw = await fsp.readFile(statePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed?.status === "ready" || parsed?.status === "error") {
        return parsed;
      }
    } catch {
      // continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`desktop runtime state timeout after ${timeoutMs}ms`);
}

async function fetchJsonWithRetry(url, init = undefined, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function killProcessTree(child) {
  if (!child?.pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("powershell.exe", ["-NoProfile", "-Command", `Stop-Process -Id ${child.pid} -Force -ErrorAction SilentlyContinue`], { stdio: "ignore" });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
    return;
  }

  child.kill("SIGTERM");
}

function createLaunch(options, resolvedEntry, resolvedCwd) {
  if (options.mode === "packaged") {
    return {
      command: resolvedEntry,
      args: [],
      cwd: path.dirname(resolvedEntry),
      shell: false
    };
  }

  const electronExe = path.resolve(resolvedCwd, "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron");
  if (fs.existsSync(electronExe)) {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-Command", `& \"${electronExe}\" \"${resolvedEntry}\"`],
      cwd: resolvedCwd,
      shell: false
    };
  }

  return {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["electron", resolvedEntry],
    cwd: resolvedCwd,
    shell: process.platform === "win32"
  };
}

const options = parseArgs(process.argv.slice(2));
const resolvedEntry = path.resolve(options.entry);
const resolvedCwd = path.resolve(options.cwd);
const outputDir = path.resolve(options.outputDir);
const statePath = path.join(outputDir, "desktop-runtime-state.json");
const logsDir = path.join(outputDir, "logs");
const stdoutPath = path.join(outputDir, "desktop-smoke-stdout.log");
const stderrPath = path.join(outputDir, "desktop-smoke-stderr.log");
const reportPath = path.join(outputDir, "desktop-smoke-report.json");
await fsp.mkdir(outputDir, { recursive: true });
await fsp.mkdir(logsDir, { recursive: true });
await fsp.writeFile(stdoutPath, "", "utf8");
await fsp.writeFile(stderrPath, "", "utf8");

const env = {
  ...process.env,
  OKK_DESKTOP_RUNTIME_STATUS_PATH: statePath,
  OKK_DESKTOP_LOG_DIR: logsDir,
  OKK_DESKTOP_NODE_COMMAND: process.execPath
};
const launch = createLaunch(options, resolvedEntry, resolvedCwd);

let child;
try {
  child = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    shell: launch.shell
  });

  child.stdout?.on("data", (chunk) => {
    fs.appendFileSync(stdoutPath, chunk.toString());
  });
  child.stderr?.on("data", (chunk) => {
    fs.appendFileSync(stderrPath, chunk.toString());
  });

  const state = await waitForState(statePath, options.timeoutMs);
  if (state.status !== "ready") {
    throw new Error(`desktop runtime failed: ${JSON.stringify(state)}`);
  }

  if (!state.apiBaseUrl) {
    throw new Error("desktop runtime missing apiBaseUrl");
  }

  const health = await fetchJsonWithRetry(`${state.apiBaseUrl}/healthz`);
  const ready = await fetchJsonWithRetry(`${state.apiBaseUrl}/readyz`);
  const login = await fetchJsonWithRetry(`${state.apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin" })
  });

  const report = {
    ok: true,
    mode: options.mode,
    entry: resolvedEntry,
    state,
    health,
    ready,
    login: {
      tokenPresent: typeof login.token === "string" && login.token.length > 0
    },
    stdoutPath,
    stderrPath,
    statePath,
    logsDir
  };
  await fsp.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log("desktop_smoke_ok=true");
  console.log(`desktop_smoke_report=${reportPath}`);
  console.log(`desktop_runtime_state=${statePath}`);
  console.log(`desktop_runtime_logs=${logsDir}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const report = {
    ok: false,
    mode: options.mode,
    entry: resolvedEntry,
    error: message,
    stdoutPath,
    stderrPath,
    statePath,
    logsDir
  };
  await fsp.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.error("desktop_smoke_ok=false");
  console.error(message);
  console.error(`desktop_smoke_report=${reportPath}`);
  process.exitCode = 1;
} finally {
  await killProcessTree(child);
}


