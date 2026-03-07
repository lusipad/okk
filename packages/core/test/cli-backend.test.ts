import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CliBackend } from "../src/backend/cli-backend.js";
import type { BackendEventInput } from "../src/types.js";

const tempDirectories: string[] = [];

const collect = async <T>(generator: AsyncGenerator<T>): Promise<T[]> => {
  const result: T[] = [];
  for await (const item of generator) {
    result.push(item);
  }
  return result;
};

afterEach(() => {
  while (tempDirectories.length > 0) {
    const dir = tempDirectories.pop();
    if (!dir) {
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("CliBackend", () => {
  it("能恢复分段 JSON 与包裹在噪音中的事件", async () => {
    const script = [
      `process.stdout.write('{\\"type\\":\\"thread.started\\",\\n');`,
      `process.stdout.write('\\"thread_id\\":\\"thread-1\\"}\\n');`,
      `process.stdout.write('TRACE {\\"type\\":\\"item.completed\\",\\"item\\":{\\"type\\":\\"agent_message\\",\\"text\\":\\"hello\\"}} TRACE\\n');`,
      `process.stdout.write('{\\"type\\":\\"turn.completed\\"}\\n');`
    ].join("");

    const backend = new CliBackend({
      name: "test-cli",
      command: process.execPath,
      buildArgs: () => ["-e", script]
    });

    const events = await collect(
      backend.execute({
        backend: "codex",
        prompt: "hello",
        sessionId: "session-1"
      })
    );

    expect(events.map((event) => event.type)).toEqual(["session_update", "text_delta", "done"]);
    expect(events[0]).toMatchObject({
      type: "session_update",
      payload: { sessionId: "thread-1" }
    });
    expect(events[1]).toMatchObject({
      type: "text_delta",
      payload: { content: "hello" }
    });
  });

  it("在启动超时后会自动重试一次并成功恢复", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-cli-backend-"));
    tempDirectories.push(tempDir);
    const markerPath = path.join(tempDir, "attempt.txt");
    const scriptPath = path.join(tempDir, "retry-script.js");
    fs.writeFileSync(
      scriptPath,
      [
        `const fs = require("node:fs");`,
        `const markerPath = process.argv[2];`,
        `const count = fs.existsSync(markerPath) ? Number(fs.readFileSync(markerPath, "utf8")) : 0;`,
        `fs.writeFileSync(markerPath, String(count + 1));`,
        `if (count === 0) {`,
        `  setTimeout(() => {`,
        `    process.stdout.write('{"type":"thread.started","thread_id":"late"}\\n');`,
        `    process.stdout.write('{"type":"turn.completed"}\\n');`,
        `  }, 800);`,
        `} else {`,
        `  process.stdout.write('{"type":"thread.started","thread_id":"ok"}\\n');`,
        `  process.stdout.write('{"type":"turn.completed"}\\n');`,
        `}`
      ].join("\n"),
      "utf8"
    );

    const backend = new CliBackend({
      name: "test-cli",
      command: process.execPath,
      buildArgs: () => [scriptPath, markerPath],
      startupTimeoutMs: 300,
      executionTimeoutMs: 2000,
      maxRetries: 1,
      retryDelayMs: 0,
      cleanupGraceMs: 20
    });

    const events = await collect(
      backend.execute({
        backend: "codex",
        prompt: "retry",
        sessionId: "session-retry"
      })
    );

    expect(fs.readFileSync(markerPath, "utf8")).toBe("2");
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(events.map((event) => event.type)).toEqual(["session_update", "done"]);
    expect(events[0]).toMatchObject({
      type: "session_update",
      payload: { sessionId: "ok" }
    });
  });

  it("最终失败时会输出结构化诊断", async () => {
    const backend = new CliBackend({
      name: "test-cli",
      command: process.execPath,
      buildArgs: () => ["-e", `setTimeout(() => {}, 500);`],
      startupTimeoutMs: 30,
      executionTimeoutMs: 200,
      maxRetries: 0,
      cleanupGraceMs: 20
    });

    const events = await collect(
      backend.execute({
        backend: "codex",
        prompt: "timeout",
        sessionId: "session-timeout"
      })
    );

    const errorEvent = events.find((event): event is Extract<BackendEventInput, { type: "error" }> => event.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.payload.code).toBe("backend_startup_timeout");
    expect(errorEvent?.payload.retryable).toBe(true);
    expect(errorEvent?.payload.details).toMatchObject({
      stage: "startup",
      diagnostics: {
        code: "backend_startup_timeout"
      }
    });
  });
});







