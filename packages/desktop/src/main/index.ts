import {
  BrowserWindow,
  dialog,
  Menu,
  Tray,
  app,
  globalShortcut,
  ipcMain,
  nativeImage
} from "electron";
import type { Event as ElectronEvent } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDroppedFiles } from "./file-drop.js";
import { startEmbeddedBackend } from "./embedded-backend.js";
import { registerIOProviderHandlers } from "./io-provider.js";
import {
  FILE_DROP_EVENT_CHANNEL,
  FILE_DROP_INVOKE_CHANNEL,
  SEARCH_FOCUS_MAIN_CHANNEL,
  SEARCH_QUERY_EVENT_CHANNEL
} from "../shared/ipc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHORTCUT = "CommandOrControl+Shift+K";
const DEFAULT_DEV_URL = "http://localhost:5173";

let mainWindow: BrowserWindow | null = null;
let searchWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let stopEmbeddedBackend: (() => Promise<void>) | null = null;

function getPreloadPath(): string {
  return path.join(__dirname, "..", "preload", "index.js");
}

function getSearchWindowHtmlPath(): string {
  return path.join(app.getAppPath(), "dist", "renderer", "search.html");
}

function getWebFrontendIndexPath(): string {
  return path.join(app.getAppPath(), "dist", "web-frontend", "index.html");
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

  return window;
}

async function loadMainWindowContent(window: BrowserWindow): Promise<void> {
  const devUrl = process.env.OKCLAW_DESKTOP_DEV_URL?.trim();

  if (devUrl) {
    await window.loadURL(devUrl);
    return;
  }

  const webFrontendIndexPath = getWebFrontendIndexPath();
  if (existsSync(webFrontendIndexPath)) {
    await window.loadFile(webFrontendIndexPath);
    return;
  }

  await window.loadURL(DEFAULT_DEV_URL);
}

function createTray(): Tray | null {
  const trayIcon = nativeImage.createFromPath(process.execPath);
  if (trayIcon.isEmpty()) {
    return null;
  }
  const windowTray = new Tray(trayIcon);

  windowTray.setToolTip("OKClaw Desktop");
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
  try {
    const backendRuntime = await startEmbeddedBackend();
    stopEmbeddedBackend = backendRuntime.close;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("OKClaw Backend 启动失败", message);
    app.quit();
    return;
  }

  registerIOProviderHandlers(ipcMain);
  registerFileDropBridge();
  registerSearchBridge();

  mainWindow = createMainWindow();
  await loadMainWindowContent(mainWindow);

  tray = createTray();
  registerGlobalShortcuts();

  app.on("activate", () => {
    focusMainWindow();
  });
});
