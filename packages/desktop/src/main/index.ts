import {
  BrowserWindow,
  dialog,
  Menu,
  Tray,
  app,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell
} from "electron";
import type { Event as ElectronEvent } from "electron";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDroppedFiles } from "./file-drop.js";
import { normalizeBackendError, startEmbeddedBackend } from "./embedded-backend.js";
import { registerIOProviderHandlers } from "./io-provider.js";
import { createDesktopRuntimeLogWriter, type DesktopRuntimeLogWriter } from "./runtime-log.js";
import {
  FILE_DROP_EVENT_CHANNEL,
  FILE_DROP_INVOKE_CHANNEL,
  FILE_PICK_INVOKE_CHANNEL,
  SEARCH_FOCUS_MAIN_CHANNEL,
  SEARCH_QUERY_EVENT_CHANNEL,
  DESKTOP_RUNTIME_GET_STATE_CHANNEL,
  DESKTOP_RUNTIME_OPEN_LOGS_CHANNEL,
  DESKTOP_RUNTIME_RESTART_CHANNEL,
  DESKTOP_RUNTIME_STATE_EVENT_CHANNEL
} from "../shared/ipc.js";
import {
  createDesktopRuntimeState,
  type DesktopRuntimeCheck,
  type DesktopRuntimeContentSource,
  type DesktopRuntimeDiagnostic,
  type DesktopRuntimeState
} from "../shared/runtime.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHORTCUT = "CommandOrControl+Shift+K";
const DEFAULT_DEV_PORTS = [5173, 5174, 5175, 5176, 5177];

let mainWindow: BrowserWindow | null = null;
let searchWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let stopEmbeddedBackend: (() => Promise<void>) | null = null;
let runtimeLog: DesktopRuntimeLogWriter | null = null;
let desktopRuntimeState = createDesktopRuntimeState({
  status: "starting"
});

function getPreloadPath(): string {
  return path.join(__dirname, "..", "preload", "index.js");
}

function getSearchWindowHtmlPath(): string {
  return path.join(__dirname, "..", "renderer", "search.html");
}

function getWebFrontendIndexPath(): string {
  return path.join(__dirname, "..", "web-frontend", "index.html");
}

function focusMainWindow(): void {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function positionSearchWindow(): void {
  if (!mainWindow || !searchWindow) {
    return;
  }

  const [mainX, mainY] = mainWindow.getPosition();
  const [mainWidth] = mainWindow.getSize();
  const [searchWidth] = searchWindow.getSize();

  searchWindow.setPosition(mainX + Math.round((mainWidth - searchWidth) / 2), mainY + 96, false);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function syncDesktopRuntimeEnv(): void {
  process.env.OKK_DESKTOP_RUNTIME_STATE_JSON = JSON.stringify(desktopRuntimeState);
  process.env.OKK_DESKTOP_API_BASE_URL = desktopRuntimeState.apiBaseUrl ?? "";
  process.env.OKK_DESKTOP_WS_BASE_URL = desktopRuntimeState.wsBaseUrl ?? "";
}

function logRuntimeEvent(event: string, payload: Record<string, unknown> = {}): void {
  runtimeLog?.write(event, payload);
}

function broadcastRuntimeState(): void {
  syncDesktopRuntimeEnv();

  const statePath = process.env.OKK_DESKTOP_RUNTIME_STATUS_PATH?.trim();
  if (statePath) {
    const resolvedStatePath = path.resolve(statePath);
    mkdirSync(path.dirname(resolvedStatePath), { recursive: true });
    writeFileSync(resolvedStatePath, JSON.stringify(desktopRuntimeState, null, 2), "utf8");
  }

  for (const window of [mainWindow, searchWindow]) {
    if (!window || window.isDestroyed()) {
      continue;
    }
    window.webContents.send(DESKTOP_RUNTIME_STATE_EVENT_CHANNEL, desktopRuntimeState);
  }
}

function setDesktopRuntimeState(next: Partial<DesktopRuntimeState> & Pick<DesktopRuntimeState, "status">): void {
  desktopRuntimeState = createDesktopRuntimeState({
    ...desktopRuntimeState,
    ...next,
    updatedAt: new Date().toISOString()
  });

  broadcastRuntimeState();
  logRuntimeEvent("desktop_runtime_state", {
    status: desktopRuntimeState.status,
    contentSource: desktopRuntimeState.contentSource,
    diagnosticsCount: desktopRuntimeState.diagnostics.length,
    checksCount: desktopRuntimeState.checks.length
  });
}

function createSearchWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 520,
    height: 96,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    movable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.on("closed", () => {
    searchWindow = null;
  });

  window.on("blur", () => {
    window.hide();
  });

  void window.loadFile(getSearchWindowHtmlPath());

  return window;
}

function showSearchWindow(): void {
  if (!searchWindow || searchWindow.isDestroyed()) {
    searchWindow = createSearchWindow();
  }

  positionSearchWindow();
  searchWindow.show();
  searchWindow.focus();
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.on("ready-to-show", () => {
    window.show();
  });

  window.on("close", (event: ElectronEvent) => {
    if (isQuitting || !tray) {
      return;
    }

    event.preventDefault();
    window.hide();
  });

  window.on("unresponsive", () => {
    const diagnostics: DesktopRuntimeDiagnostic[] = [
      {
        scope: "renderer",
        severity: "error",
        code: "renderer_unresponsive",
        message: "Renderer 无响应",
        detail: "桌面窗口已停止响应，请尝试重新加载窗口或重试启动后端。",
        actions: [
          { kind: "reload", label: "重新加载窗口" },
          { kind: "retry", label: "重试启动" },
          { kind: "open_logs", label: "打开日志" }
        ]
      }
    ];
    setDesktopRuntimeState({
      status: "error",
      contentSource: "diagnostic",
      diagnostics
    });
    void showRuntimeFallbackPage(window);
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    const diagnostics: DesktopRuntimeDiagnostic[] = [
      {
        scope: "renderer",
        severity: "error",
        code: `renderer_${details.reason}`,
        message: "Renderer 进程异常退出",
        detail: `reason=${details.reason}${typeof details.exitCode === "number" ? ` | exitCode=${details.exitCode}` : ""}`,
        actions: [
          { kind: "reload", label: "重新加载窗口" },
          { kind: "retry", label: "重试启动" },
          { kind: "open_logs", label: "打开日志" }
        ]
      }
    ];
    setDesktopRuntimeState({
      status: "error",
      contentSource: "diagnostic",
      diagnostics
    });
    void showRuntimeFallbackPage(window);
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) {
      return;
    }

    const diagnostics: DesktopRuntimeDiagnostic[] = [
      {
        scope: "renderer",
        severity: "error",
        code: `did_fail_load_${errorCode}`,
        message: "Renderer 主入口加载失败",
        detail: `url=${validatedURL || "unknown"} | ${errorDescription}`,
        actions: [
          { kind: "reload", label: "重新加载窗口" },
          { kind: "retry", label: "重试启动" },
          { kind: "open_logs", label: "打开日志" }
        ]
      }
    ];
    setDesktopRuntimeState({
      status: "error",
      contentSource: "diagnostic",
      diagnostics
    });
    void showRuntimeFallbackPage(window);
  });

  return window;
}

function renderRuntimeFallbackHtml(state: DesktopRuntimeState): string {
  const diagnostics = state.diagnostics.length > 0 ? state.diagnostics : [{ message: "未知桌面启动错误", detail: "请查看日志定位问题。" }];
  const checksHtml = state.checks.length
    ? `<ul>${state.checks
        .map(
          (check) => `<li><strong>${escapeHtml(check.label)}</strong> · ${escapeHtml(check.status)} · ${escapeHtml(check.summary)}${
            check.detail ? `<div>${escapeHtml(check.detail)}</div>` : ""
          }</li>`
        )
        .join("")}</ul>`
    : "<p>暂无启动检查项。</p>";
  const diagnosticsHtml = diagnostics
    .map(
      (item) => `
        <section class="diag-card">
          <h2>${escapeHtml(item.message)}</h2>
          ${item.code ? `<p><strong>Code:</strong> ${escapeHtml(item.code)}</p>` : ""}
          ${item.detail ? `<pre>${escapeHtml(item.detail)}</pre>` : ""}
        </section>
      `
    )
    .join("");

  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>OKK Desktop Diagnostics</title>
      <style>
        :root { color-scheme: dark; }
        body { margin: 0; font-family: "Segoe UI", sans-serif; background: #12131a; color: #f3f4f7; }
        .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px; }
        .card { width: min(760px, 100%); background: #1a1d27; border: 1px solid #2c3347; border-radius: 24px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
        h1 { margin: 0 0 12px; font-size: 28px; }
        p { line-height: 1.6; color: #c8cfdd; }
        .actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0 28px; }
        button { border: 0; border-radius: 999px; padding: 10px 18px; cursor: pointer; font-weight: 600; }
        .primary { background: #5a7fff; color: #fff; }
        .ghost { background: #232839; color: #eef2ff; border: 1px solid #39415a; }
        .diag-card { background: #161926; border: 1px solid #30374b; border-radius: 18px; padding: 16px; margin-top: 14px; }
        pre { white-space: pre-wrap; word-break: break-word; background: #0f1118; padding: 12px; border-radius: 12px; color: #d6def6; }
        ul { padding-left: 18px; color: #c8cfdd; }
        .meta { font-size: 13px; color: #95a0b8; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="card">
          <p class="meta">OKK Desktop Runtime</p>
          <h1>桌面启动未完成</h1>
          <p>应用没有进入可用工作台，当前已切换到诊断页。你可以直接重试启动、重新加载窗口或打开运行日志。</p>
          <div class="actions">
            <button class="primary" onclick="window.okkDesktop?.runtime?.restartBackend?.()">重试启动</button>
            <button class="ghost" onclick="window.location.reload()">重新加载窗口</button>
            <button class="ghost" onclick="window.okkDesktop?.runtime?.openLogs?.()">打开日志</button>
          </div>
          <h2>启动检查</h2>
          ${checksHtml}
          <h2>诊断信息</h2>
          ${diagnosticsHtml}
          <p class="meta">日志路径：${escapeHtml(state.logFilePath || "未记录")}</p>
        </div>
      </div>
    </body>
  </html>`;
}

async function showRuntimeFallbackPage(window: BrowserWindow): Promise<void> {
  const html = renderRuntimeFallbackHtml(desktopRuntimeState);
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function canReachUrl(target: string): Promise<boolean> {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function pickReachableDevUrl(): Promise<string | null> {
  for (const port of DEFAULT_DEV_PORTS) {
    const candidate = `http://127.0.0.1:${port}`;
    if (await canReachUrl(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function resolveRendererSource(): Promise<
  | { kind: "url"; source: DesktopRuntimeContentSource; target: string }
  | { kind: "file"; source: DesktopRuntimeContentSource; target: string }
> {
  const configuredDevUrl = process.env.OKK_DESKTOP_DEV_URL?.trim();
  if (configuredDevUrl) {
    return {
      kind: "url",
      source: "dev-url",
      target: configuredDevUrl
    };
  }

  const webFrontendIndexPath = getWebFrontendIndexPath();
  if (existsSync(webFrontendIndexPath)) {
    return {
      kind: "file",
      source: "packaged-file",
      target: webFrontendIndexPath
    };
  }

  const fallbackDevUrl = await pickReachableDevUrl();
  if (fallbackDevUrl) {
    return {
      kind: "url",
      source: "fallback-dev-url",
      target: fallbackDevUrl
    };
  }

  throw new Error("No renderer source available. Provide OKK_DESKTOP_DEV_URL or build web-frontend assets.");
}

async function loadMainWindowContent(window: BrowserWindow): Promise<DesktopRuntimeContentSource> {
  const source = await resolveRendererSource();
  logRuntimeEvent("renderer_source_resolved", source);

  if (source.kind === "url") {
    await window.loadURL(source.target);
  } else {
    await window.loadFile(source.target);
  }

  return source.source;
}

function createTray(): Tray | null {
  const trayIcon = nativeImage.createFromPath(process.execPath);
  if (trayIcon.isEmpty()) {
    return null;
  }
  const windowTray = new Tray(trayIcon);

  windowTray.setToolTip("OKK Desktop");
  windowTray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示主窗口", click: () => focusMainWindow() },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );

  windowTray.on("click", () => {
    focusMainWindow();
  });

  return windowTray;
}

function registerGlobalShortcuts(): void {
  globalShortcut.register(SHORTCUT, () => {
    if (mainWindow?.isFocused()) {
      showSearchWindow();
      return;
    }

    focusMainWindow();
  });
}

function registerFileDropBridge(): void {
  ipcMain.handle(FILE_DROP_INVOKE_CHANNEL, (event, filePaths: string[] = []) => {
    const normalizedPaths = normalizeDroppedFiles(filePaths);
    event.sender.send(FILE_DROP_EVENT_CHANNEL, normalizedPaths);
    return normalizedPaths;
  });

  ipcMain.handle(FILE_PICK_INVOKE_CHANNEL, async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, {
          properties: ["openFile", "openDirectory", "multiSelections"]
        })
      : await dialog.showOpenDialog({
          properties: ["openFile", "openDirectory", "multiSelections"]
        });
    if (result.canceled) {
      return [];
    }

    const normalizedPaths = normalizeDroppedFiles(result.filePaths);
    event.sender.send(FILE_DROP_EVENT_CHANNEL, normalizedPaths);
    return normalizedPaths;
  });
}

function registerSearchBridge(): void {
  ipcMain.handle(SEARCH_FOCUS_MAIN_CHANNEL, (_event, query: string = "") => {
    focusMainWindow();

    const normalizedQuery = query.trim();
    if (normalizedQuery) {
      mainWindow?.webContents.send(SEARCH_QUERY_EVENT_CHANNEL, normalizedQuery);
    }

    return true;
  });
}

function registerRuntimeBridge(): void {
  ipcMain.handle(DESKTOP_RUNTIME_GET_STATE_CHANNEL, () => desktopRuntimeState);
  ipcMain.handle(DESKTOP_RUNTIME_OPEN_LOGS_CHANNEL, async () => {
    if (!desktopRuntimeState.logFilePath) {
      return false;
    }
    shell.showItemInFolder(desktopRuntimeState.logFilePath);
    return true;
  });
  ipcMain.handle(DESKTOP_RUNTIME_RESTART_CHANNEL, async () => {
    await restartEmbeddedBackend("renderer-retry");
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (desktopRuntimeState.status === "ready") {
        try {
          const source = await loadMainWindowContent(mainWindow);
          setDesktopRuntimeState({
            status: "ready",
            contentSource: source,
            checks: [
              ...desktopRuntimeState.checks.filter((item) => item.id !== "renderer-entry"),
              {
                id: "renderer-entry",
                label: "renderer",
                status: "pass",
                summary: `Renderer 已从 ${source} 加载`
              }
            ]
          });
        } catch (error) {
          const diagnostics: DesktopRuntimeDiagnostic[] = [
            {
              scope: "renderer",
              severity: "error",
              code: "renderer_reload_failed",
              message: "Renderer 重新加载失败",
              detail: error instanceof Error ? error.message : String(error),
              actions: [
                { kind: "reload", label: "重新加载窗口" },
                { kind: "retry", label: "重试启动" },
                { kind: "open_logs", label: "打开日志" }
              ]
            }
          ];
          setDesktopRuntimeState({
            status: "error",
            contentSource: "diagnostic",
            diagnostics
          });
          await showRuntimeFallbackPage(mainWindow);
        }
      } else {
        await showRuntimeFallbackPage(mainWindow);
      }
    }
    return desktopRuntimeState;
  });
}

async function restartEmbeddedBackend(reason: string): Promise<void> {
  if (stopEmbeddedBackend) {
    await stopEmbeddedBackend();
    stopEmbeddedBackend = null;
  }

  setDesktopRuntimeState({
    status: "starting",
    diagnostics: [],
    checks: [
      {
        id: "embedded-backend",
        label: "embedded backend",
        status: "pending",
        summary: `桌面运行时正在启动 (${reason})`
      }
    ],
    contentSource: desktopRuntimeState.contentSource,
    logFilePath: runtimeLog?.logFilePath ?? null
  });

  try {
    const backendRuntime = await startEmbeddedBackend({ logger: runtimeLog ?? undefined });
    stopEmbeddedBackend = backendRuntime.close;
    setDesktopRuntimeState({
      status: "ready",
      apiBaseUrl: backendRuntime.apiBaseUrl,
      wsBaseUrl: backendRuntime.wsBaseUrl,
      checks: [
        {
          id: "embedded-backend",
          label: "embedded backend",
          status: "pass",
          summary: `Embedded backend 已监听 ${backendRuntime.apiBaseUrl}`
        },
        ...backendRuntime.checks
      ],
      diagnostics: backendRuntime.diagnostics,
      logFilePath: runtimeLog?.logFilePath ?? null
    });
  } catch (error) {
    const diagnostics = [normalizeBackendError(error)];
    setDesktopRuntimeState({
      status: "error",
      apiBaseUrl: null,
      wsBaseUrl: null,
      checks: [
        {
          id: "embedded-backend",
          label: "embedded backend",
          status: "fail",
          summary: "Embedded backend 启动失败",
          detail: diagnostics[0]?.detail
        }
      ],
      diagnostics,
      logFilePath: runtimeLog?.logFilePath ?? null,
      contentSource: "diagnostic"
    });
  }
}

app.on("before-quit", () => {
  isQuitting = true;
  if (stopEmbeddedBackend) {
    void stopEmbeddedBackend();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(async () => {
  runtimeLog = createDesktopRuntimeLogWriter();
  setDesktopRuntimeState({
    status: "starting",
    logFilePath: runtimeLog.logFilePath,
    checks: [
      {
        id: "embedded-backend",
        label: "embedded backend",
        status: "pending",
        summary: "桌面运行时启动中"
      }
    ]
  });

  registerIOProviderHandlers(ipcMain);
  registerFileDropBridge();
  registerSearchBridge();
  registerRuntimeBridge();

  await restartEmbeddedBackend("initial");

  mainWindow = createMainWindow();

  if (desktopRuntimeState.status === "ready") {
    try {
      const source = await loadMainWindowContent(mainWindow);
      setDesktopRuntimeState({
        status: "ready",
        contentSource: source,
        checks: [
          ...desktopRuntimeState.checks.filter((item) => item.id !== "renderer-entry"),
          {
            id: "renderer-entry",
            label: "renderer",
            status: "pass",
            summary: `Renderer 已从 ${source} 加载`
          }
        ]
      });
    } catch (error) {
      const diagnostics: DesktopRuntimeDiagnostic[] = [
        {
          scope: "renderer",
          severity: "error",
          code: "renderer_load_failed",
          message: "Renderer 主入口加载失败",
          detail: error instanceof Error ? error.message : String(error),
          actions: [
            { kind: "reload", label: "重新加载窗口" },
            { kind: "retry", label: "重试启动" },
            { kind: "open_logs", label: "打开日志" }
          ]
        }
      ];
      setDesktopRuntimeState({
        status: "error",
        contentSource: "diagnostic",
        diagnostics,
        checks: [
          ...desktopRuntimeState.checks.filter((item) => item.id !== "renderer-entry"),
          {
            id: "renderer-entry",
            label: "renderer",
            status: "fail",
            summary: "Renderer 主入口加载失败",
            detail: diagnostics[0]?.detail
          }
        ]
      });
      await showRuntimeFallbackPage(mainWindow);
    }
  } else {
    await showRuntimeFallbackPage(mainWindow);
  }

  tray = createTray();
  registerGlobalShortcuts();

  app.on("activate", () => {
    focusMainWindow();
  });
});



