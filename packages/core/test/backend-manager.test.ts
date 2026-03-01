import { describe, expect, it } from "vitest";
import { BackendManager } from "../src/backend/backend-manager.js";
import type { IBackend } from "../src/backend/i-backend.js";
import type { BackendCapabilities, BackendEventInput, BackendRequest } from "../src/types.js";

const capabilities: BackendCapabilities = {
  supportsResume: true,
  supportsThinking: true,
  supportsTools: true
};

class FakeBackend implements IBackend {
  readonly name = "fake";
  readonly capabilities = capabilities;

  async *execute(_request: BackendRequest): AsyncGenerator<BackendEventInput> {
    yield { type: "text_delta", payload: { content: "A" } };
    yield { type: "text_delta", payload: { content: "B" } };
    yield { type: "done", payload: { reason: "completed" } };
  }

  abort(): void {}
}

const collect = async <T>(generator: AsyncGenerator<T>): Promise<T[]> => {
  const result: T[] = [];
  for await (const item of generator) {
    result.push(item);
  }
  return result;
};

describe("BackendManager", () => {
  it("为同一 session 分配单调递增 event_id，并支持 resume_from_event_id 重放", async () => {
    const manager = new BackendManager({ maxConcurrent: 1, bufferSize: 10 });
    manager.registerBackend(new FakeBackend());

    const sessionId = "session-a";
    const firstRun = await collect(
      manager.execute({
        backend: "fake",
        prompt: "hello",
        sessionId
      })
    );

    expect(firstRun.map((event) => event.event_id)).toEqual([1, 2, 3]);

    const resumed = await collect(
      manager.execute({
        backend: "fake",
        sessionId,
        resumeFromEventId: 1
      })
    );

    expect(resumed.map((event) => event.event_id)).toEqual([2, 3]);
    expect(resumed.map((event) => event.type)).toEqual(["text_delta", "done"]);
  });

  it("当恢复点早于缓冲窗口时返回 resume_failed", async () => {
    const manager = new BackendManager({ maxConcurrent: 1, bufferSize: 2 });
    manager.registerBackend(new FakeBackend());

    const sessionId = "session-b";
    await collect(
      manager.execute({
        backend: "fake",
        prompt: "hello",
        sessionId
      })
    );

    const resumed = await collect(
      manager.execute({
        backend: "fake",
        sessionId,
        resumeFromEventId: 0
      })
    );

    expect(resumed).toHaveLength(1);
    expect(resumed[0].type).toBe("error");
    if (resumed[0].type === "error") {
      expect(resumed[0].payload.code).toBe("resume_failed");
    }
  });
});

