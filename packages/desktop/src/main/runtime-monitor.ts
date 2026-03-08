import fs from "node:fs";
import path from "node:path";
import type { DesktopRuntimeState } from "../shared/runtime.js";

export interface DesktopRuntimeMonitorOptions {
  logPath: string;
  statePath?: string;
  onStatus?: (status: DesktopRuntimeState) => void;
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function appendRuntimeLog(logPath: string, message: string): void {
  ensureParentDir(logPath);
  fs.appendFileSync(logPath, `${message}\n`, "utf8");
}

function writeRuntimeState(statePath: string, status: DesktopRuntimeState): void {
  ensureParentDir(statePath);
  fs.writeFileSync(statePath, JSON.stringify(status, null, 2), "utf8");
}

export class DesktopRuntimeMonitor {
  private status: DesktopRuntimeState;

  constructor(private readonly options: DesktopRuntimeMonitorOptions, initialStatus: DesktopRuntimeState) {
    this.status = initialStatus;
    this.persist(initialStatus.status === "error" ? "error" : "info", initialStatus.status);
  }

  getStatus(): DesktopRuntimeState {
    return this.status;
  }

  update(next: DesktopRuntimeState): DesktopRuntimeState {
    this.status = {
      ...next,
      updatedAt: new Date().toISOString()
    };
    this.persist(this.status.status === "error" ? "error" : "info", this.status.status);
    return this.status;
  }

  log(level: "info" | "warning" | "error", message: string, detail?: string): void {
    const entry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${detail ? ` :: ${detail}` : ""}`;
    appendRuntimeLog(this.options.logPath, entry);
  }

  private persist(level: "info" | "warning" | "error", message: string): void {
    this.log(level, message, this.status.diagnostics?.[0]?.detail);
    if (this.options.statePath) {
      writeRuntimeState(this.options.statePath, this.status);
    }
    this.options.onStatus?.(this.status);
  }
}

