import { contextBridge, ipcRenderer } from "electron";
import {
  DESKTOP_RUNTIME_GET_STATE_CHANNEL,
  DESKTOP_RUNTIME_OPEN_LOGS_CHANNEL,
  DESKTOP_RUNTIME_RESTART_CHANNEL,
  DESKTOP_RUNTIME_STATE_EVENT_CHANNEL,
  FILE_DROP_EVENT_CHANNEL,
  FILE_DROP_INVOKE_CHANNEL,
  FILE_PICK_INVOKE_CHANNEL,
  IO_CHANNELS,
  SEARCH_QUERY_EVENT_CHANNEL,
  SEARCH_FOCUS_MAIN_CHANNEL
} from "../shared/ipc.js";
import { createDesktopRuntimeState, type DesktopRuntimeState } from "../shared/runtime.js";

export interface IOProviderRequest {
  action?: string;
  payload?: unknown;
}

export interface IOProviderResponse {
  provider: keyof typeof IO_CHANNELS;
  ok: boolean;
  action: string;
  payload: unknown;
  timestamp: string;
  mode?: "stub" | "live";
}

type Unsubscribe = () => void;
type SearchQueryListener = (query: string) => void;
type DesktopRuntimeListener = (state: DesktopRuntimeState) => void;

function readInitialRuntimeState(): DesktopRuntimeState {
  const raw = process.env.OKK_DESKTOP_RUNTIME_STATE_JSON?.trim();
  if (!raw) {
    return createDesktopRuntimeState({
      status: "starting",
      apiBaseUrl: process.env.OKK_DESKTOP_API_BASE_URL ?? null,
      wsBaseUrl: process.env.OKK_DESKTOP_WS_BASE_URL ?? null
    });
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DesktopRuntimeState> & { status?: DesktopRuntimeState["status"] };
    if (parsed.status === "starting" || parsed.status === "ready" || parsed.status === "error") {
      return createDesktopRuntimeState(parsed as Partial<DesktopRuntimeState> & Pick<DesktopRuntimeState, "status">);
    }
  } catch {
    return createDesktopRuntimeState({
      status: "starting",
      apiBaseUrl: process.env.OKK_DESKTOP_API_BASE_URL ?? null,
      wsBaseUrl: process.env.OKK_DESKTOP_WS_BASE_URL ?? null
    });
  }

  return createDesktopRuntimeState({
    status: "starting",
    apiBaseUrl: process.env.OKK_DESKTOP_API_BASE_URL ?? null,
    wsBaseUrl: process.env.OKK_DESKTOP_WS_BASE_URL ?? null
  });
}

function normalizeCheckStatus(status: DesktopRuntimeState["checks"][number]["status"]): "pending" | "ready" | "warning" | "error" {
  if (status === "pass") {
    return "ready";
  }
  if (status === "warn") {
    return "warning";
  }
  if (status === "fail") {
    return "error";
  }
  return "pending";
}

function toRuntimeStatus(state: DesktopRuntimeState) {
  return {
    phase: state.status,
    summary:
      state.diagnostics[0]?.message ||
      state.checks.find((item) => item.status === "fail")?.summary ||
      state.checks.find((item) => item.status === "warn")?.summary ||
      (state.status === "ready" ? "桌面工作台已就绪" : state.status === "error" ? "桌面运行时异常" : "桌面运行时启动中"),
    detail: state.diagnostics[0]?.detail,
    checks: state.checks.map((item) => ({
      id: item.id,
      label: item.label,
      status: normalizeCheckStatus(item.status),
      summary: item.summary,
      detail: item.detail
    })),
    apiBaseUrl: state.apiBaseUrl ?? undefined,
    wsBaseUrl: state.wsBaseUrl ?? undefined,
    logPath: state.logFilePath ?? undefined,
    updatedAt: state.updatedAt
  };
}

const initialRuntimeState = readInitialRuntimeState();

const runtimeBridge = {
  ...initialRuntimeState,
  getState: (): Promise<DesktopRuntimeState> => ipcRenderer.invoke(DESKTOP_RUNTIME_GET_STATE_CHANNEL),
  getStatus: async () => toRuntimeStatus(await ipcRenderer.invoke(DESKTOP_RUNTIME_GET_STATE_CHANNEL)),
  restartBackend: (): Promise<DesktopRuntimeState> => ipcRenderer.invoke(DESKTOP_RUNTIME_RESTART_CHANNEL),
  reload: async () => toRuntimeStatus(await ipcRenderer.invoke(DESKTOP_RUNTIME_RESTART_CHANNEL)),
  openLogs: (): Promise<boolean> => ipcRenderer.invoke(DESKTOP_RUNTIME_OPEN_LOGS_CHANNEL),
  onStateChange: (listener: DesktopRuntimeListener): Unsubscribe => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: DesktopRuntimeState) => {
      listener(state);
    };

    ipcRenderer.on(DESKTOP_RUNTIME_STATE_EVENT_CHANNEL, wrappedListener);

    return () => {
      ipcRenderer.off(DESKTOP_RUNTIME_STATE_EVENT_CHANNEL, wrappedListener);
    };
  },
  onStatus: (listener: (status: ReturnType<typeof toRuntimeStatus>) => void): Unsubscribe => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: DesktopRuntimeState) => {
      listener(toRuntimeStatus(state));
    };

    ipcRenderer.on(DESKTOP_RUNTIME_STATE_EVENT_CHANNEL, wrappedListener);

    return () => {
      ipcRenderer.off(DESKTOP_RUNTIME_STATE_EVENT_CHANNEL, wrappedListener);
    };
  }
};

const desktopBridge = {
  runtime: runtimeBridge,
  io: {
    qa: (request?: IOProviderRequest): Promise<IOProviderResponse> =>
      ipcRenderer.invoke(IO_CHANNELS.qa, request),
    knowledge: (request?: IOProviderRequest): Promise<IOProviderResponse> =>
      ipcRenderer.invoke(IO_CHANNELS.knowledge, request),
    repos: (request?: IOProviderRequest): Promise<IOProviderResponse> =>
      ipcRenderer.invoke(IO_CHANNELS.repos, request),
    agents: (request?: IOProviderRequest): Promise<IOProviderResponse> =>
      ipcRenderer.invoke(IO_CHANNELS.agents, request),
    skills: (request?: IOProviderRequest): Promise<IOProviderResponse> =>
      ipcRenderer.invoke(IO_CHANNELS.skills, request)
  },
  files: {
    pick: (): Promise<string[]> => ipcRenderer.invoke(FILE_PICK_INVOKE_CHANNEL),
    onDropped: (listener: (paths: string[]) => void): Unsubscribe => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, paths: string[]) => {
        listener(paths);
      };

      ipcRenderer.on(FILE_DROP_EVENT_CHANNEL, wrappedListener);

      return () => {
        ipcRenderer.off(FILE_DROP_EVENT_CHANNEL, wrappedListener);
      };
    }
  },
  search: {
    focusMainWindow: (query = ""): Promise<boolean> => ipcRenderer.invoke(SEARCH_FOCUS_MAIN_CHANNEL, query),
    onQuery: (listener: SearchQueryListener): Unsubscribe => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, query: string | undefined) => {
        listener(typeof query === "string" ? query : "");
      };

      ipcRenderer.on(SEARCH_QUERY_EVENT_CHANNEL, wrappedListener);

      return () => {
        ipcRenderer.off(SEARCH_QUERY_EVENT_CHANNEL, wrappedListener);
      };
    }
  }
};

contextBridge.exposeInMainWorld("okkDesktop", desktopBridge);
contextBridge.exposeInMainWorld("okkDesktopRuntime", runtimeBridge);

window.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  window.addEventListener("drop", (event) => {
    event.preventDefault();

    const paths = Array.from(event.dataTransfer?.files ?? [])
      .map((file) => (file as File & { path?: string }).path)
      .filter((value): value is string => Boolean(value));

    void ipcRenderer.invoke(FILE_DROP_INVOKE_CHANNEL, paths);
  });
});
