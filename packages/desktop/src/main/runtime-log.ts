import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

export interface DesktopRuntimeLogWriter {
  logFilePath: string;
  write: (event: string, payload?: Record<string, unknown>) => void;
}

function resolveLogDirectory(): string {
  const configured = process.env.OKK_DESKTOP_LOG_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(app.getPath("userData"), "logs");
}

export function createDesktopRuntimeLogWriter(): DesktopRuntimeLogWriter {
  const logDir = resolveLogDirectory();
  fs.mkdirSync(logDir, { recursive: true });
  const logFilePath = path.join(logDir, "desktop-runtime.log");

  return {
    logFilePath,
    write(event, payload = {}) {
      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
        ...payload
      });
      fs.appendFileSync(logFilePath, `${line}\n`, "utf8");
    }
  };
}
