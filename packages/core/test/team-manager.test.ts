import { describe, expect, it } from "vitest";
import { TeamManager } from "../src/team/team-manager.js";
import type { AgentDefinition, AgentResult, AgentRunnerRequest } from "../src/types.js";

class FakeExecutor {
  readonly requests: AgentRunnerRequest[] = [];
  readonly startMarks: Array<{ backend: string; at: number }> = [];

  constructor(private readonly handlers: Record<string, () => Promise<AgentResult>>) {}

  async run(request: AgentRunnerRequest): Promise<AgentResult> {
    this.requests.push(request);
    this.startMarks.push({ backend: request.backend, at: Date.now() });
    const handler = this.handlers[request.agent.name];
    if (!handler) {
      throw new Error(`missing handler for ${request.agent.name}`);
    }
    return handler();
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const createResult = (overrides: Partial<AgentResult> = {}): AgentResult => ({
  success: true,
  output: "ok",
  toolCallCount: 0,
  iterations: 1,
  usage: {
    inputTokens: 1,
    outputTokens: 1,
    totalTokens: 2
  },
  stats: {
    toolCallHits: {},
    blockedToolCallCount: 0
  },
  ...overrides
});

const baseAgent = (name: string): AgentDefinition => ({
  name,
  description: `${name} description`,
  allowedTools: ["Read"],
  systemPrompt: `${name} system prompt`
});

describe("TeamManager", () => {
  it("并行执行多个成员并汇总结果", async () => {
    const executor = new FakeExecutor({
      "agent-a": async () => {
        await sleep(80);
        return createResult({ output: "A" });
      },
      "agent-b": async () => {
        await sleep(90);
        return createResult({ output: "B" });
      }
    });
    const manager = new TeamManager(executor);

    const start = Date.now();
    const result = await manager.run({
      teamName: "parallel-team",
      members: [
        {
          backend: "codex",
          agent: baseAgent("agent-a"),
          prompt: "task-a",
          taskTitle: "task-a"
        },
        {
          backend: "claude-code",
          agent: baseAgent("agent-b"),
          prompt: "task-b",
          taskTitle: "task-b"
        }
      ]
    });
    const elapsed = Date.now() - start;

    expect(result.status).toBe("done");
    expect(result.members).toHaveLength(2);
    expect(result.members.every((item) => item.status === "done")).toBe(true);
    expect(executor.requests).toHaveLength(2);
    expect(elapsed).toBeLessThan(160);
  });

  it("成员失败时标记 team 为 error 并发出关键事件", async () => {
    const executor = new FakeExecutor({
      success: async () => createResult(),
      failed: async () => {
        throw new Error("boom");
      }
    });
    const manager = new TeamManager(executor);
    const events: string[] = [];
    manager.subscribe((event) => {
      events.push(event.type);
    });

    const result = await manager.run({
      teamName: "mixed-team",
      members: [
        {
          backend: "codex",
          agent: baseAgent("success"),
          prompt: "ok",
          taskTitle: "ok"
        },
        {
          backend: "codex",
          agent: baseAgent("failed"),
          prompt: "bad",
          taskTitle: "bad"
        }
      ]
    });

    expect(result.status).toBe("error");
    expect(result.members.some((item) => item.status === "error")).toBe(true);
    expect(events[0]).toBe("team_start");
    expect(events).toContain("team_member_add");
    expect(events).toContain("team_member_update");
    expect(events[events.length - 1]).toBe("team_end");
  });
});

