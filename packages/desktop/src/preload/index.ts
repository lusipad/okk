import { contextBridge, ipcRenderer } from "electron";
import {
  FILE_DROP_EVENT_CHANNEL,
  FILE_DROP_INVOKE_CHANNEL,
  IO_CHANNELS,
  SEARCH_FOCUS_MAIN_CHANNEL
} from "../shared/ipc.js";

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
}

type Unsubscribe = () => void;

const desktopBridge = {
  runtime: {
    apiBaseUrl: process.env.OKK_DESKTOP_API_BASE_URL ?? "http://127.0.0.1:3000",
    wsBaseUrl: process.env.OKK_DESKTOP_WS_BASE_URL ?? "ws://127.0.0.1:3000"
  },
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
    focusMainWindow: (query = ""): Promise<boolean> => ipcRenderer.invoke(SEARCH_FOCUS_MAIN_CHANNEL, query)
  }
};

contextBridge.exposeInMainWorld("okkDesktop", desktopBridge);
contextBridge.exposeInMainWorld("okkDesktopRuntime", desktopBridge.runtime);

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
