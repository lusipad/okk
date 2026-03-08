import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DesktopRuntimeCheck, DesktopRuntimeDiagnostic } from "../shared/runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOST = "127.0.0.1";
const PORT_START = 3230;
const PORT_END = 3290;
const START_TIMEOUT_MS = 30000;

interface EmbeddedBackendLogger {
  write: (event: string, payload?: Record<string, unknown>) => void;
}

export interface EmbeddedBackendOptions {
  logger?: EmbeddedBackendLogger;
}

export interface EmbeddedBackendRuntime {
  apiBaseUrl: string;
  wsBaseUrl: string;
  checks: DesktopRuntimeCheck[];
  diagnostics: DesktopRuntimeDiagnostic[];
  close: () => Promise<void>;
}

interface ReadinessItem {
  id?: string;
  label?: string;
  status?: string;
  summary?: string;
  detail?: string;
}

interface ReadinessPayload {
  status?: string;
  checks?: ReadonlyArray<ReadinessItem>;
  diagnostics?: DesktopRuntimeDiagnostic[];
}

interface EmbeddedBackendCommand {
  command: string;
  extraEnv?: NodeJS.ProcessEnv;
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, HOST, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort(): Promise<number> {
  for (let port = PORT_START; port <= PORT_END; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port in range ${PORT_START}-${PORT_END}`);
}

function resolveBackendServerPath(): string {
  return path.join(__dirname, "..", "backend", "server.js");
}

function resolveBackendWorkingDirectory(backendServerPath: string): string {
  const serverDir = path.dirname(backendServerPath);
  if (serverDir.includes(".asar")) {
    return path.dirname(process.execPath);
  }
  return serverDir;
}

export function resolveEmbeddedBackendCommand(): EmbeddedBackendCommand {
  const explicit = process.env.OKK_DESKTOP_NODE_COMMAND?.trim();
  if (explicit) {
    return { command: explicit };
  }

  if (process.versions.electron) {
    return {
      command: process.execPath,
      extraEnv: {
        ELECTRON_RUN_AS_NODE: "1"
      }
    };
  }

  const npmNode = process.env.npm_node_execpath?.trim();
  if (npmNode) {
    return { command: npmNode };
  }

  return { command: "node" };
}

function toCheckStatus(value: string | undefined): DesktopRuntimeCheck["status"] {
  if (value === "pass" || value === "ready") {
    return "pass";
  }
  if (value === "warn" || value === "warning") {
    return "warn";
  }
  if (value === "fail" || value === "error") {
    return "fail";
  }
  return "pending";
}

function normalizeCheck(input: ReadinessItem): DesktopRuntimeCheck | null {
  const id = typeof input.id === "string" ? input.id : null;
  const label = typeof input.label === "string" ? input.label : null;
  const summary = typeof input.summary === "string" ? input.summary : null;
  if (!id || !label || !summary) {
    return null;
  }

  return {
    id,
    label,
    status: toCheckStatus(input.status),
    summary,
    detail: typeof input.detail === "string" ? input.detail : undefined
  };
}

async function waitForBackendReady(apiBaseUrl: string, timeoutMs: number): Promise<ReadinessPayload> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiBaseUrl}/readyz`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        return (await response.json()) as ReadinessPayload;
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Embedded backend readiness timeout after ${timeoutMs}ms`);
}

async function killChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (!child.pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("powershell.exe", ["-NoProfile", "-Command", `Stop-Process -Id ${child.pid} -Force -ErrorAction SilentlyContinue`], { stdio: "ignore" });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
    return;
  }

  child.kill("SIGTERM");
}

export function normalizeBackendError(error: unknown): DesktopRuntimeDiagnostic {
  const message = error instanceof Error ? error.message : String(error);
  return {
    scope: "backend",
    severity: "error",
    code: "embedded_backend_start_failed",
    message: "Embedded backend 启动失败",
    detail: message,
    actions: [
      { kind: "retry", label: "重试启动" },
      { kind: "open_logs", label: "打开日志" }
    ]
  };
}

export async function startEmbeddedBackend(options: EmbeddedBackendOptions = {}): Promise<EmbeddedBackendRuntime> {
  const port = await pickPort();
  const backendCommand = resolveEmbeddedBackendCommand();
  const backendServerPath = resolveBackendServerPath();
  const backendWorkingDirectory = resolveBackendWorkingDirectory(backendServerPath);
  const apiBaseUrl = `http://${HOST}:${port}`;
  const wsBaseUrl = `ws://${HOST}:${port}`;

  options.logger?.write("embedded_backend_start", {
    host: HOST,
    port,
    nodeCommand: backendCommand.command,
    backendServerPath,
    backendWorkingDirectory
  });

  const child = spawn(backendCommand.command, [backendServerPath], {
    cwd: backendWorkingDirectory,
    env: {
      ...process.env,
      ...(backendCommand.extraEnv ?? {}),
      HOST,
      PORT: String(port),
      OKK_CORE_MODE: "real"
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    options.logger?.write("embedded_backend_stdout", { chunk: chunk.toString().trim() });
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    stderr += text;
    options.logger?.write("embedded_backend_stderr", { chunk: text.trim() });
  });

  child.on("error", (error) => {
    options.logger?.write("embedded_backend_process_error", { message: error.message });
  });

  try {
    const readiness = await waitForBackendReady(apiBaseUrl, START_TIMEOUT_MS);
    const checks = (readiness.checks ?? [])
      .map((item) => normalizeCheck(item))
      .filter((item): item is DesktopRuntimeCheck => item !== null);
    const diagnostics = Array.isArray(readiness.diagnostics) ? readiness.diagnostics : [];

    options.logger?.write("embedded_backend_ready", {
      apiBaseUrl,
      wsBaseUrl,
      checksCount: checks.length,
      diagnosticsCount: diagnostics.length
    });

    return {
      apiBaseUrl,
      wsBaseUrl,
      checks,
      diagnostics,
      close: async () => {
        options.logger?.write("embedded_backend_stop", { apiBaseUrl });
        await killChild(child);
      }
    };
  } catch (error) {
    await killChild(child);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(stderr.trim().length > 0 ? `${message}\n${stderr.trim()}` : message);
  }
}


