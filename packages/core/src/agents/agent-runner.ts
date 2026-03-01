import type {
  AgentResult,
  AgentRunnerRequest,
  BackendEvent,
  BackendRequest,
  TokenUsage
} from "../types.js";
import { generateId } from "../utils/id.js";

const DEFAULT_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0
};

const SKILL_TOOL_NAME = "Skill";

const normalizeToolName = (name: string): string => name.trim().toLowerCase();

const mergeAllowedTools = (tools: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of [...tools, SKILL_TOOL_NAME]) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeToolName(trimmed);
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
};

const mergeUsage = (current: TokenUsage, patch?: Partial<TokenUsage>): TokenUsage => {
  if (!patch) {
    return current;
  }

  const inputTokens =
    typeof patch.inputTokens === "number" ? patch.inputTokens : current.inputTokens;
  const outputTokens =
    typeof patch.outputTokens === "number" ? patch.outputTokens : current.outputTokens;
  const totalTokens =
    typeof patch.totalTokens === "number" ? patch.totalTokens : inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
};

const buildBackendRequest = (
  request: AgentRunnerRequest,
  sessionId: string,
  allowedTools: string[]
): BackendRequest => ({
  backend: request.backend,
  prompt: request.prompt,
  sessionId,
  workingDirectory: request.workingDirectory,
  additionalDirectories: request.additionalDirectories,
  systemPrompt: request.agent.systemPrompt,
  clientMessageId: request.clientMessageId,
  metadata: {
    ...request.metadata,
    agentName: request.agent.name,
    allowedTools
  }
});

export interface AgentRunnerBackend {
  execute(request: BackendRequest): AsyncGenerator<BackendEvent>;
  abort(sessionId: string): void;
}

export class AgentRunner {
  constructor(private readonly backend: AgentRunnerBackend) {}

  async run(request: AgentRunnerRequest): Promise<AgentResult> {
    const sessionId = request.sessionId?.trim() || generateId();
    const allowedTools = mergeAllowedTools(request.agent.allowedTools);
    const allowedSet = new Set(allowedTools.map((tool) => normalizeToolName(tool)));

    const toolCallHits: Record<string, number> = {};
    let blockedToolCallCount = 0;
    let toolCallCount = 0;
    let iterations = 0;
    let output = "";
    let usage = { ...DEFAULT_USAGE };
    let success = true;
    let error: string | undefined;
    let activeSessionId = sessionId;

    try {
      for await (const event of this.backend.execute(
        buildBackendRequest(request, sessionId, allowedTools)
      )) {
        activeSessionId = this.trackSessionId(activeSessionId, event);

        if (event.type === "text_delta") {
          output += event.payload.content;
          continue;
        }

        if (event.type === "tool_call_start") {
          const toolName = event.payload.name.trim();
          const normalized = normalizeToolName(toolName);
          if (!allowedSet.has(normalized)) {
            blockedToolCallCount += 1;
            success = false;
            error = `Tool ${toolName} is not allowed for agent ${request.agent.name}`;
            this.backend.abort(activeSessionId);
            break;
          }

          toolCallCount += 1;
          toolCallHits[toolName] = (toolCallHits[toolName] ?? 0) + 1;
          continue;
        }

        if (event.type === "done") {
          iterations += 1;
          usage = mergeUsage(usage, event.payload.usage);
          continue;
        }

        if (event.type === "error") {
          success = false;
          error = event.payload.message;
          break;
        }
      }
    } catch (runnerError) {
      success = false;
      error = runnerError instanceof Error ? runnerError.message : String(runnerError);
    }

    if (usage.totalTokens === 0 && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
      usage.totalTokens = usage.inputTokens + usage.outputTokens;
    }

    return {
      success,
      output,
      toolCallCount,
      iterations,
      usage,
      stats: {
        toolCallHits,
        blockedToolCallCount
      },
      ...(error ? { error } : {})
    };
  }

  private trackSessionId(current: string, event: BackendEvent): string {
    if (event.type === "session_update") {
      return event.payload.sessionId;
    }

    return event.sessionId || current;
  }
}
