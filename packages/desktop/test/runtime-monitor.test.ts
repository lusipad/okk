import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopRuntimeMonitor } from "../src/main/runtime-monitor.js";
import type { DesktopRuntimeState } from "../src/shared/runtime.js";

const tempDirs: string[] = [];

function createTempPaths(): { logPath: string; statePath: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-desktop-runtime-"));
  tempDirs.push(tempDir);
  return {
    logPath: path.join(tempDir, "desktop.log"),
    statePath: path.join(tempDir, "desktop-state.json")
  };
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("DesktopRuntimeMonitor", () => {
  it("写入状态文件并广播更新", () => {
    const { logPath, statePath } = createTempPaths();
    const onStatus = vi.fn();
    const initial: DesktopRuntimeState = {
      status: "starting",
      checks: [],
      diagnostics: [],
      updatedAt: new Date().toISOString(),
      logFilePath: logPath,
      contentSource: "bootstrap",
      apiBaseUrl: null,
      wsBaseUrl: null
    };

    const monitor = new DesktopRuntimeMonitor({ logPath, statePath, onStatus }, initial);
    const next = monitor.update({
      status: "ready",
      checks: [
        {
          id: "renderer",
          label: "Renderer",
          status: "pass",
          summary: "桌面已就绪"
        }
      ],
      diagnostics: [],
      updatedAt: initial.updatedAt,
      logFilePath: logPath,
      contentSource: "packaged-file",
      apiBaseUrl: "http://127.0.0.1:3230",
      wsBaseUrl: "ws://127.0.0.1:3230"
    });

    expect(next.status).toBe("ready");
    expect(onStatus).toHaveBeenCalled();
    expect(fs.existsSync(statePath)).toBe(true);

    const stored = JSON.parse(fs.readFileSync(statePath, "utf8")) as DesktopRuntimeState;
    expect(stored.status).toBe("ready");
    expect(stored.apiBaseUrl).toBe("http://127.0.0.1:3230");
    expect(fs.readFileSync(logPath, "utf8")).toContain("ready");
  });
});
