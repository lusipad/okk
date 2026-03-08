export type DesktopRuntimeStatus = "starting" | "ready" | "error";
export type DesktopRuntimeCheckStatus = "pending" | "pass" | "warn" | "fail";
export type DesktopRuntimeContentSource = "bootstrap" | "dev-url" | "packaged-file" | "fallback-dev-url" | "diagnostic";
export type DesktopRuntimeActionKind = "reload" | "retry" | "open_logs";

export interface DesktopRuntimeAction {
  kind: DesktopRuntimeActionKind;
  label: string;
}

export interface DesktopRuntimeCheck {
  id: string;
  label: string;
  status: DesktopRuntimeCheckStatus;
  summary: string;
  detail?: string;
}

export interface DesktopRuntimeDiagnostic {
  scope?: "backend" | "renderer" | "preload" | "window" | "cli";
  severity?: "info" | "warning" | "error";
  code?: string;
  message: string;
  detail?: string;
  actions?: DesktopRuntimeAction[];
}

export interface DesktopRuntimeState {
  status: DesktopRuntimeStatus;
  checks: DesktopRuntimeCheck[];
  diagnostics: DesktopRuntimeDiagnostic[];
  apiBaseUrl: string | null;
  wsBaseUrl: string | null;
  contentSource: DesktopRuntimeContentSource;
  logFilePath: string | null;
  updatedAt: string;
}

export function createDesktopRuntimeState(
  input: Partial<DesktopRuntimeState> & Pick<DesktopRuntimeState, "status">
): DesktopRuntimeState {
  return {
    status: input.status,
    checks: input.checks ?? [],
    diagnostics: input.diagnostics ?? [],
    apiBaseUrl: input.apiBaseUrl ?? null,
    wsBaseUrl: input.wsBaseUrl ?? null,
    contentSource: input.contentSource ?? "bootstrap",
    logFilePath: input.logFilePath ?? null,
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}
