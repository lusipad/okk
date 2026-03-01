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
}

interface OkclawDesktopBridge {
  io: {
    qa: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
    knowledge: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
    repos: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
    agents: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
    skills: (request?: IOProviderRequest) => Promise<IOProviderResponse>;
  };
  files: {
    onDropped: (listener: (paths: string[]) => void) => () => void;
  };
  search: {
    focusMainWindow: (query?: string) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    okclawDesktop: OkclawDesktopBridge;
  }
}

export {};
