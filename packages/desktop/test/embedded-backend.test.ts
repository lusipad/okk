import { describe, expect, it, vi } from "vitest";
import { resolveEmbeddedBackendCommand } from "../src/main/embedded-backend.js";

describe("resolveEmbeddedBackendCommand", () => {
  it("在 Electron 环境下优先使用 process.execPath + ELECTRON_RUN_AS_NODE", () => {
    const originalExecPath = process.execPath;
    const originalElectron = process.versions.electron;
    const originalExplicit = process.env.OKK_DESKTOP_NODE_COMMAND;
    const originalNpmNode = process.env.npm_node_execpath;

    vi.stubEnv("OKK_DESKTOP_NODE_COMMAND", "");
    vi.stubEnv("npm_node_execpath", "C:/Program Files/nodejs/node.exe");
    Object.defineProperty(process, "execPath", { value: "C:/OKK/OKK.exe", configurable: true });
    Object.defineProperty(process.versions, "electron", { value: "30.0.0", configurable: true });

    try {
      const resolved = resolveEmbeddedBackendCommand();
      expect(resolved.command).toBe("C:/OKK/OKK.exe");
      expect(resolved.extraEnv?.ELECTRON_RUN_AS_NODE).toBe("1");
    } finally {
      if (originalExplicit === undefined) {
        delete process.env.OKK_DESKTOP_NODE_COMMAND;
      } else {
        process.env.OKK_DESKTOP_NODE_COMMAND = originalExplicit;
      }
      if (originalNpmNode === undefined) {
        delete process.env.npm_node_execpath;
      } else {
        process.env.npm_node_execpath = originalNpmNode;
      }
      Object.defineProperty(process, "execPath", { value: originalExecPath, configurable: true });
      Object.defineProperty(process.versions, "electron", { value: originalElectron, configurable: true });
      vi.unstubAllEnvs();
    }
  });

  it("显式配置 OKK_DESKTOP_NODE_COMMAND 时优先使用显式值", () => {
    vi.stubEnv("OKK_DESKTOP_NODE_COMMAND", "D:/Tools/node.exe");
    try {
      const resolved = resolveEmbeddedBackendCommand();
      expect(resolved.command).toBe("D:/Tools/node.exe");
      expect(resolved.extraEnv).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
