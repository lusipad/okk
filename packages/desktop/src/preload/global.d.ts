import type { DesktopRuntimeState } from "../shared/runtime.js";

type IOProviderName = "qa" | "knowledge" | "repos" | "agents" | "skills";

interface IOProviderRequest {
  action?: string;
  payload?: unknown;
}

interface IOProviderResponse {
  provider: IOProviderName;
  ok: boolean;
  action: string;
  payload: unknown;
  timestamp: string;
  mode?: "stub" | "live";
}

type Unsubscribe = () => void;
type SearchQueryListener = (query: string) => void;
type DesktopRuntimeListener = (state: DesktopRuntimeState) => void;

interface OkkDesktopRuntimeBridge extends DesktopRuntimeState {
  getState: () => Promise<DesktopRuntimeState>;
  restartBackend: () => Promise<DesktopRuntimeState>;
  openLogs: () => Promise<boolean>;
  onStateChange: (listener: DesktopRuntimeListener) => Unsubscribe;
}

interface OkkDesktopBridge {
  runtime: OkkDesktopRuntimeBridge;
  io: {
    qa: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
    knowledge: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
    repos: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
    agents: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
    skills: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
  };
  files: {
    pick: () => Promise<string[]>;
    onDropped: (listener: (paths: string[]) => void) => Unsubscribe;
  };
  search: {
    focusMainWindow: (query?: string) => Promise<boolean>;
    onQuery: (listener: SearchQueryListener) => Unsubscribe;
  };
}

declare global {
  interface Window {
    okkDesktop: OkkDesktopBridge;
    okkDesktopRuntime: OkkDesktopRuntimeBridge;
  }
}

export {};
