import { describe, expect, it } from "vitest";
import { AgentRunner, type AgentRunnerBackend } from "../src/agents/agent-runner.js";
import type {
  AgentDefinition,
  AgentRunnerRequest,
  BackendEvent,
  BackendEventPayloadMap,
  BackendRequest
} from "../src/types.js";

class FakeRunnerBackend implements AgentRunnerBackend {
  readonly requests: BackendRequest[] = [];
  readonly abortCalls: string[] = [];

  constructor(private readonly events: BackendEvent[]) {}

  async *execute(request: BackendRequest): AsyncGenerator<BackendEvent> {
    this.requests.push(request);
    for (const event of this.events) {
      yield event;
    }
  }

  abort(sessionId: string): void {
    this.abortCalls.push(sessionId);
  }
}

const event = <T extends BackendEvent["type"]>(
  sessionId: string,
  eventId: number,
  type: T,
  payload: BackendEventPayloadMap[T]
): BackendEvent => ({
  type,
  payload,
  sessionId,
  event_id: eventId,
  timestamp: "2026-01-01T00:00:00.000Z"
}) as BackendEvent;

const definition: AgentDefinition = {
  name: "repo-explorer",
  description: "Explore repository",
  allowedTools: ["Read"],
  systemPrompt: "You are repo explorer"
};

const buildRequest = (overrides: Partial<AgentRunnerRequest> = {}): AgentRunnerRequest => ({
  backend: "fake",
  agent: definition,
  prompt: "inspect repo",
  sessionId: "session-1",
  ...overrides
});

describe("AgentRunner", () => {
  it("使用 Agent 的 systemPrompt/allowedTools 执行，并统计工具命中", async () => {
    const backend = new FakeRunnerBackend([
      event("session-1", 1, "tool_call_start", { toolCallId: "t1", name: "Read" }),
      event("session-1", 2, "tool_call_start", { toolCallId: "t2", name: "Skill" }),
      event("session-1", 3, "text_delta", { content: "done" }),
      event("session-1", 4, "done", {
        reason: "completed",
        usage: { inputTokens: 12, outputTokens: 8 }
      })
    ]);

    const runner = new AgentRunner(backend);
    const result = await runner.run(buildRequest());

    expect(result.success).toBe(true);
    expect(result.output).toBe("done");
    expect(result.toolCallCount).toBe(2);
    expect(result.iterations).toBe(1);
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 8, totalTokens: 20 });
    expect(result.stats.blockedToolCallCount).toBe(0);
    expect(result.stats.toolCallHits).toEqual({ Read: 1, Skill: 1 });

    expect(backend.requests).toHaveLength(1);
    expect(backend.requests[0].systemPrompt).toBe(definition.systemPrompt);
    expect(backend.requests[0].metadata).toMatchObject({
      agentName: definition.name,
      allowedTools: ["Read", "Skill"]
    });
  });

  it("遇到未授权工具时拒绝并中止后端会话", async () => {
    const backend = new FakeRunnerBackend([
      event("session-1", 1, "session_update", { sessionId: "session-remote" }),
      event("session-remote", 2, "tool_call_start", { toolCallId: "t1", name: "Bash" }),
      event("session-remote", 3, "done", { reason: "completed" })
    ]);

    const runner = new AgentRunner(backend);
    const result = await runner.run(buildRequest());

    expect(result.success).toBe(false);
    expect(result.error).toContain("Bash");
    expect(result.toolCallCount).toBe(0);
    expect(result.stats.blockedToolCallCount).toBe(1);
    expect(backend.abortCalls).toEqual(["session-remote"]);
  });
});
