import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCore } from "../src/create-core.js";

const tempDirectories: string[] = [];

afterEach(() => {
  while (tempDirectories.length > 0) {
    const dir = tempDirectories.pop();
    if (!dir) {
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("createCore runtime health", () => {
  it("为不可用 CLI 返回结构化诊断和恢复动作", async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "okk-core-health-"));
    tempDirectories.push(workspaceRoot);

    const core = await createCore({
      workspaceRoot,
      dbPath: ":memory:",
      codexCommand: "missing-codex-cli-for-okk",
      claudeCommand: "missing-claude-cli-for-okk"
    });

    const health = await core.runtime.listBackendHealth();
    expect(health).toHaveLength(2);

    for (const item of health) {
      expect(item.available).toBe(false);
      expect(item.runtimeStatus).toBe("unavailable");
      expect(item.sourceType).toBe("backend");
      expect(item.diagnostics).toMatchObject({
        retryable: true,
        severity: "error"
      });
      expect(item.diagnostics?.code).toBeTruthy();
      expect(item.actions?.map((action) => action.kind)).toEqual(["refresh", "copy_diagnostic"]);
    }
  });
});

