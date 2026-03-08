import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import type { BackendCapabilities, BackendEventInput, BackendRequest } from "../types.js";
import { AsyncEventQueue } from "../utils/async-event-queue.js";
import { generateId } from "../utils/id.js";
import type { IBackend } from "./i-backend.js";

type StreamSource = "stdout" | "stderr";
type FailureStage = "spawn" | "startup" | "execution" | "abort";

interface SpawnTarget {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

interface AttemptFailure {
  code: string;
  stage: FailureStage;
  message: string;
  detail?: string;
  retryable: boolean;
}

interface AttemptResult {
  success: boolean;
  retryable: boolean;
}

export interface CliBackendLogEntry {
  level: "info" | "warn" | "error";
  backend: string;
  sessionId: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface CliBackendOptions {
  name: string;
  command: string;
  buildArgs?: (request: BackendRequest) => string[];
  resolveSpawn?: (input: {
    command: string;
    args: string[];
    env: NodeJS.ProcessEnv;
    request: BackendRequest;
  }) => SpawnTarget;
  capabilities?: Partial<BackendCapabilities>;
  env?: NodeJS.ProcessEnv;
  onLog?: (entry: CliBackendLogEntry) => void;
  stderrTailSize?: number;
  executionTimeoutMs?: number;
  startupTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  cleanupGraceMs?: number;
}

const defaultCapabilities: BackendCapabilities = {
  supportsResume: true,
  supportsThinking: true,
  supportsTools: true
};

const DEFAULT_STDERR_TAIL_SIZE = 30;
const DEFAULT_STARTUP_TIMEOUT_MS = 15000;
const DEFAULT_EXECUTION_TIMEOUT_MS = 120000;
const DEFAULT_MAX_RETRIES = 0;
const DEFAULT_RETRY_DELAY_MS = 750;
const DEFAULT_CLEANUP_GRACE_MS = 2000;
const MAX_JSON_RECOVERY_LINES = 8;
const MAX_JSON_RECOVERY_LENGTH = 16000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const joinNonEmpty = (values: Array<string | null | undefined>, separator = "\n"): string | null => {
  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized.join(separator) : null;
};

const delay = async (ms: number): Promise<void> => {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isDirectExecutableCommand = (command: string): boolean => /\.(exe|cmd|bat)$/i.test(command.trim());

const quoteWindowsShellArg = (value: string): string => {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"&()^|<>]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
};

const resolveSpawnTarget = (command: string, args: string[]): SpawnTarget => {
  const trimmed = command.trim();
  if (process.platform !== "win32" || isDirectExecutableCommand(trimmed)) {
    return { command, args };
  }

  if (/\.ps1$/i.test(trimmed)) {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", trimmed, ...args]
    };
  }

  const commandLine = [command, ...args].map((value) => quoteWindowsShellArg(value)).join(" ");
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", commandLine]
  };
};

const isMeaningfulOutputEvent = (event: BackendEventInput): boolean =>
  event.type === "text_delta" ||
  event.type === "tool_call_start" ||
  event.type === "tool_call_input_delta" ||
  event.type === "tool_call_end" ||
  event.type === "sub_agent_start" ||
  event.type === "sub_agent_end" ||
  event.type === "knowledge_suggestion";

const parseDirectBackendEvent = (parsed: Record<string, unknown>): BackendEventInput | null => {
  if (typeof parsed.type !== "string" || !isObject(parsed.payload)) {
    return null;
  }

  return parsed as BackendEventInput;
};

const parseCodexJsonEvent = (parsed: Record<string, unknown>): BackendEventInput | null => {
  const type = asString(parsed.type);
  if (!type) {
    return null;
  }

  if (type === "thread.started") {
    const sessionId = asString(parsed.thread_id);
    if (!sessionId) {
      return null;
    }

    return {
      type: "session_update",
      payload: { sessionId }
    };
  }

  if (type === "item.completed") {
    const item = isObject(parsed.item) ? parsed.item : null;
    const itemType = item ? asString(item.type) : null;
    const itemText = item ? asString(item.text) : null;

    if (itemType === "agent_message" && itemText) {
      return {
        type: "text_delta",
        payload: { content: itemText }
      };
    }

    if (itemType === "reasoning" && itemText) {
      return {
        type: "thinking_delta",
        payload: { content: itemText }
      };
    }

    if (itemType === "tool_call") {
      const toolCallId = asString(item?.id) ?? asString(item?.call_id) ?? asString(item?.tool_call_id);
      const name = asString(item?.name) ?? asString(item?.tool_name);
      if (toolCallId && name) {
        return {
          type: "tool_call_start",
          payload: { toolCallId, name }
        };
      }
    }

    return null;
  }

  if (type === "item.delta") {
    const item = isObject(parsed.item) ? parsed.item : null;
    const itemType = item ? asString(item.type) : null;
    const toolCallId = item ? asString(item.id) ?? asString(item.call_id) ?? asString(item.tool_call_id) : null;
    const content =
      asString(parsed.delta) ??
      asString(parsed.text_delta) ??
      (isObject(parsed.delta) ? asString(parsed.delta.content) : null);

    if (itemType === "reasoning" && content) {
      return {
        type: "thinking_delta",
        payload: { content }
      };
    }

    if (itemType === "tool_call" && toolCallId && content) {
      return {
        type: "tool_call_input_delta",
        payload: { toolCallId, content }
      };
    }
  }

  if (type === "item.failed") {
    const item = isObject(parsed.item) ? parsed.item : null;
    const toolCallId = item ? asString(item.id) ?? asString(item.call_id) ?? asString(item.tool_call_id) : null;
    if (toolCallId) {
      return {
        type: "tool_call_end",
        payload: {
          toolCallId,
          error: joinNonEmpty([
            asString(parsed.message),
            asString(parsed.error),
            asString(parsed.detail)
          ]) ?? "tool call failed"
        }
      };
    }
  }

  if (type === "turn.completed") {
    return {
      type: "done",
      payload: { reason: "turn_completed" }
    };
  }

  if (type === "error") {
    const message = joinNonEmpty([
      asString(parsed.message),
      asString(parsed.error),
      asString(parsed.detail)
    ]);

    return {
      type: "error",
      payload: {
        code: "cli_error",
        message: message ?? "CLI returned an error event",
        retryable: false,
        details: parsed
      }
    };
  }

  return null;
};

const extractClaudeMessageText = (message: Record<string, unknown>): string | null => {
  const content = message.content;
  if (!Array.isArray(content)) {
    return null;
  }

  const chunks: string[] = [];
  for (const block of content) {
    if (!isObject(block)) {
      continue;
    }

    if (asString(block.type) !== "text") {
      continue;
    }

    const text = asString(block.text);
    if (text && text.trim().length > 0) {
      chunks.push(text);
    }
  }

  return chunks.length > 0 ? chunks.join("\n") : null;
};

const parseClaudeStreamJsonEvent = (parsed: Record<string, unknown>): BackendEventInput | null => {
  const type = asString(parsed.type);
  if (!type) {
    return null;
  }

  if (type === "system") {
    const sessionId = asString(parsed.session_id);
    if (!sessionId) {
      return null;
    }

    return {
      type: "session_update",
      payload: { sessionId }
    };
  }

  if (type === "assistant") {
    const message = isObject(parsed.message) ? parsed.message : null;
    if (!message) {
      return null;
    }

    const text = extractClaudeMessageText(message);
    if (!text) {
      return null;
    }

    return {
      type: "text_delta",
      payload: { content: text },
      sessionId: asString(parsed.session_id) ?? undefined
    };
  }

  if (type === "tool_use") {
    const toolCallId = asString(parsed.id) ?? asString(parsed.tool_use_id);
    const name = asString(parsed.name);
    if (toolCallId && name) {
      return {
        type: "tool_call_start",
        payload: { toolCallId, name },
        sessionId: asString(parsed.session_id) ?? undefined
      };
    }
  }

  if (type === "tool_result") {
    const toolCallId = asString(parsed.tool_use_id) ?? asString(parsed.id);
    if (toolCallId) {
      return {
        type: "tool_call_end",
        payload: {
          toolCallId,
          output: joinNonEmpty([asString(parsed.content), asString(parsed.result)]) ?? undefined,
          error: asString(parsed.error) ?? undefined
        },
        sessionId: asString(parsed.session_id) ?? undefined
      };
    }
  }

  if (type === "result") {
    const isError = parsed.is_error === true;
    if (isError) {
      const message = joinNonEmpty([
        asString(parsed.result),
        asString(parsed.stop_reason),
        asString(parsed.error)
      ]);

      return {
        type: "error",
        payload: {
          code: "cli_result_error",
          message: message ?? "CLI returned error result",
          retryable: false,
          details: parsed
        },
        sessionId: asString(parsed.session_id) ?? undefined
      };
    }

    return {
      type: "done",
      payload: { reason: "result" },
      sessionId: asString(parsed.session_id) ?? undefined
    };
  }

  return null;
};

const tryParseJsonRecord = (input: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(input);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractJsonCandidate = (input: string): string | null => {
  const firstBrace = input.indexOf("{");
  const lastBrace = input.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return input.slice(firstBrace, lastBrace + 1);
};

const looksLikeJsonFragment = (input: string): boolean => {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }

  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.endsWith("}") ||
    trimmed.endsWith("]") ||
    trimmed.includes('"type"')
  );
};

const fallbackEventForLine = (line: string, source: StreamSource): BackendEventInput =>
  source === "stderr"
    ? { type: "thinking_delta", payload: { content: line } }
    : { type: "text_delta", payload: { content: line } };

const fallbackEventForParsedObject = (line: string): BackendEventInput => ({
  type: "thinking_delta",
  payload: { content: line.trim() }
});

const mapParsedBackendEvent = (parsed: Record<string, unknown>, rawLine: string): BackendEventInput | null => {
  const mapped =
    parseDirectBackendEvent(parsed) ??
    parseCodexJsonEvent(parsed) ??
    parseClaudeStreamJsonEvent(parsed);

  if (mapped) {
    return mapped;
  }

  if (typeof parsed.sessionId === "string") {
    return {
      type: "session_update",
      payload: { sessionId: parsed.sessionId }
    };
  }

  if (typeof parsed.text === "string") {
    return { type: "text_delta", payload: { content: parsed.text } };
  }

  return fallbackEventForParsedObject(rawLine);
};

interface ParsedLineResult {
  event: BackendEventInput | null;
  recoveredFromWrappedJson: boolean;
  needsContinuation: boolean;
}

export interface CliLineParsePreview {
  event: BackendEventInput | null;
  strategy: "json" | "prefixed_json" | "embedded_json" | "plain_text" | "incomplete_json";
}

const parseBackendLine = (line: string, source: StreamSource): ParsedLineResult => {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      event: null,
      recoveredFromWrappedJson: false,
      needsContinuation: false
    };
  }

  const directRecord = tryParseJsonRecord(trimmed);
  if (directRecord) {
    return {
      event: mapParsedBackendEvent(directRecord, trimmed),
      recoveredFromWrappedJson: false,
      needsContinuation: false
    };
  }

  const candidate = extractJsonCandidate(trimmed);
  if (candidate && candidate !== trimmed) {
    const candidateRecord = tryParseJsonRecord(candidate);
    if (candidateRecord) {
      return {
        event: mapParsedBackendEvent(candidateRecord, trimmed),
        recoveredFromWrappedJson: true,
        needsContinuation: false
      };
    }
  }

  if (looksLikeJsonFragment(trimmed)) {
    return {
      event: null,
      recoveredFromWrappedJson: false,
      needsContinuation: true
    };
  }

  return {
    event: fallbackEventForLine(line, source),
    recoveredFromWrappedJson: false,
    needsContinuation: false
  };
};

export const parseCliEventLine = (line: string): CliLineParsePreview => {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      event: null,
      strategy: "plain_text"
    };
  }

  const directRecord = tryParseJsonRecord(trimmed);
  if (directRecord) {
    return {
      event: mapParsedBackendEvent(directRecord, trimmed),
      strategy: "json"
    };
  }

  if (trimmed.startsWith("data:")) {
    const prefixedRecord = tryParseJsonRecord(trimmed.slice(5).trim());
    if (prefixedRecord) {
      return {
        event: mapParsedBackendEvent(prefixedRecord, trimmed),
        strategy: "prefixed_json"
      };
    }
  }

  const candidate = extractJsonCandidate(trimmed);
  if (candidate && candidate !== trimmed) {
    const candidateRecord = tryParseJsonRecord(candidate);
    if (candidateRecord) {
      return {
        event: mapParsedBackendEvent(candidateRecord, trimmed),
        strategy: "embedded_json"
      };
    }
  }

  if (looksLikeJsonFragment(trimmed)) {
    return {
      event: null,
      strategy: "incomplete_json"
    };
  }

  return {
    event: fallbackEventForLine(line, "stdout"),
    strategy: "plain_text"
  };
};

class CliLineParser {
  private readonly bufferedLines: string[] = [];

  constructor(
    private readonly source: StreamSource,
    private readonly emitLog: (message: string, data?: Record<string, unknown>) => void,
    private readonly pushEvent: (event: BackendEventInput) => void
  ) {}

  handleLine(line: string): void {
    if (this.bufferedLines.length > 0) {
      this.bufferedLines.push(line);
      const combined = this.bufferedLines.join("\n");
      const combinedResult = parseBackendLine(combined, this.source);
      if (combinedResult.event) {
        if (combinedResult.recoveredFromWrappedJson || this.bufferedLines.length > 1) {
          this.emitLog("backend_protocol_recovered", {
            source: this.source,
            bufferedLineCount: this.bufferedLines.length
          });
        }
        this.bufferedLines.length = 0;
        this.pushEvent(combinedResult.event);
        return;
      }

      if (
        combinedResult.needsContinuation &&
        this.bufferedLines.length < MAX_JSON_RECOVERY_LINES &&
        combined.length < MAX_JSON_RECOVERY_LENGTH
      ) {
        return;
      }

      this.emitLog("backend_protocol_drift_fallback", {
        source: this.source,
        bufferedLineCount: this.bufferedLines.length,
        contentPreview: combined.slice(0, 240)
      });
      this.bufferedLines.length = 0;
      this.pushEvent(fallbackEventForLine(combined, this.source));
      return;
    }

    const result = parseBackendLine(line, this.source);
    if (result.event) {
      if (result.recoveredFromWrappedJson) {
        this.emitLog("backend_protocol_recovered", {
          source: this.source,
          contentPreview: line.slice(0, 240)
        });
      }
      this.pushEvent(result.event);
      return;
    }

    if (result.needsContinuation) {
      this.bufferedLines.push(line);
    }
  }

  flush(): void {
    if (this.bufferedLines.length === 0) {
      return;
    }

    const combined = this.bufferedLines.join("\n");
    this.emitLog("backend_protocol_incomplete_json", {
      source: this.source,
      bufferedLineCount: this.bufferedLines.length,
      contentPreview: combined.slice(0, 240)
    });
    this.bufferedLines.length = 0;
    this.pushEvent(fallbackEventForLine(combined, this.source));
  }
}

export class CliBackend implements IBackend {
  readonly name: string;
  readonly capabilities: BackendCapabilities;

  private readonly command: string;
  private readonly buildArgs: (request: BackendRequest) => string[];
  private readonly resolveSpawn?: (input: {
    command: string;
    args: string[];
    env: NodeJS.ProcessEnv;
    request: BackendRequest;
  }) => SpawnTarget;
  private readonly env: NodeJS.ProcessEnv;
  private readonly onLog?: (entry: CliBackendLogEntry) => void;
  private readonly stderrTailSize: number;
  private readonly executionTimeoutMs: number;
  private readonly startupTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly cleanupGraceMs: number;
  private readonly running = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(options: CliBackendOptions) {
    this.name = options.name;
    this.command = options.command;
    this.capabilities = { ...defaultCapabilities, ...options.capabilities };
    this.buildArgs = options.buildArgs ?? ((request) => this.defaultBuildArgs(request));
    this.resolveSpawn = options.resolveSpawn;
    this.env = { ...process.env, ...options.env };
    this.onLog = options.onLog;
    this.stderrTailSize = options.stderrTailSize ?? DEFAULT_STDERR_TAIL_SIZE;
    this.executionTimeoutMs = options.executionTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.cleanupGraceMs = options.cleanupGraceMs ?? DEFAULT_CLEANUP_GRACE_MS;
  }

  async *execute(request: BackendRequest): AsyncGenerator<BackendEventInput> {
    const sessionId = request.sessionId ?? generateId();
    if (!request.prompt || request.prompt.trim().length === 0) {
      yield {
        type: "done",
        payload: { reason: "no_prompt" },
        sessionId
      };
      return;
    }

    const queue = new AsyncEventQueue<BackendEventInput>();
    void this.runWithRetries(request, sessionId, queue);

    for await (const event of queue) {
      yield event;
    }
  }

  abort(sessionId: string): void {
    const child = this.running.get(sessionId);
    if (!child) {
      return;
    }

    this.emitLog("warn", sessionId, "backend_abort_requested", {
      pid: child.pid ?? null
    });

    if (process.platform === "win32") {
      this.terminateWindowsProcessTree(child.pid, false);
    } else {
      child.kill("SIGTERM");
    }

    const timer = setTimeout(() => {
      if (child.exitCode !== null) {
        return;
      }
      if (process.platform === "win32") {
        this.terminateWindowsProcessTree(child.pid, true);
      } else {
        child.kill("SIGKILL");
      }
    }, this.cleanupGraceMs);
    timer.unref?.();
  }

  protected defaultBuildArgs(request: BackendRequest): string[] {
    const args: string[] = [];
    if (request.sessionId) {
      args.push("--resume", request.sessionId);
    }
    if (request.systemPrompt) {
      args.push("--system-prompt", request.systemPrompt);
    }
    args.push(request.prompt ?? "");
    return args;
  }

  private async runWithRetries(
    request: BackendRequest,
    sessionId: string,
    queue: AsyncEventQueue<BackendEventInput>
  ): Promise<void> {
    const attempts = this.maxRetries + 1;

    try {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const isFinalAttempt = attempt === attempts;
        const result = await this.executeAttempt({
          request,
          sessionId,
          queue,
          attempt,
          isFinalAttempt
        });

        if (result.success || !result.retryable || isFinalAttempt) {
          return;
        }

        this.emitLog("warn", sessionId, "backend_retry_scheduled", {
          attempt,
          nextAttempt: attempt + 1,
          retryDelayMs: this.retryDelayMs
        });
        await delay(this.retryDelayMs * attempt);
      }
    } finally {
      queue.end();
    }
  }

  private async executeAttempt(options: {
    request: BackendRequest;
    sessionId: string;
    queue: AsyncEventQueue<BackendEventInput>;
    attempt: number;
    isFinalAttempt: boolean;
  }): Promise<AttemptResult> {
    const { request, sessionId, queue, attempt, isFinalAttempt } = options;
    const args = this.buildArgs(request);
    const baseEnv = { ...this.env };
    const spawnTarget = this.resolveSpawn?.({
      command: this.command,
      args,
      env: baseEnv,
      request
    }) ?? resolveSpawnTarget(this.command, args);
    const child = spawn(spawnTarget.command, spawnTarget.args, {
      cwd: request.workingDirectory,
      env: spawnTarget.env ?? baseEnv,
      stdio: "pipe",
      windowsHide: true
    });
    this.trackSession(sessionId, child);

    this.emitLog("info", sessionId, "backend_spawned", {
      command: this.command,
      args,
      spawnCommand: spawnTarget.command,
      spawnArgs: spawnTarget.args,
      pid: child.pid ?? null,
      attempt,
      workingDirectory: request.workingDirectory ?? null
    });

    let doneEmitted = false;
    let firstSignalSeen = false;
    let meaningfulOutputSeen = false;
    let acceptOutput = true;
    let activeSessionId = sessionId;
    let terminalFailure: AttemptFailure | null = null;
    const stderrTail: string[] = [];

    const rememberStderr = (line: string): void => {
      stderrTail.push(line);
      while (stderrTail.length > this.stderrTailSize) {
        stderrTail.shift();
      }
    };

    const pushEvent = (event: BackendEventInput): void => {
      if (event.type === "done") {
        doneEmitted = true;
      }
      if (isMeaningfulOutputEvent(event)) {
        meaningfulOutputSeen = true;
      }

      const normalizedEvent =
        event.type === "session_update"
          ? { ...event, sessionId: event.payload.sessionId }
          : event.sessionId
            ? event
            : { ...event, sessionId: activeSessionId };

      if (normalizedEvent.type === "session_update") {
        activeSessionId = normalizedEvent.payload.sessionId;
        this.trackSession(normalizedEvent.payload.sessionId, child);
      }

      queue.push(normalizedEvent);
    };

    const emitParserLog = (message: string, data?: Record<string, unknown>): void => {
      this.emitLog("warn", sessionId, message, {
        attempt,
        ...(data ?? {})
      });
    };

    const stdoutParser = new CliLineParser("stdout", emitParserLog, pushEvent);
    const stderrParser = new CliLineParser("stderr", emitParserLog, pushEvent);
    const stdoutReader = readline.createInterface({ input: child.stdout });
    const stderrReader = readline.createInterface({ input: child.stderr });

    return await new Promise<AttemptResult>((resolve) => {
      const startupTimer = setTimeout(() => {
        if (firstSignalSeen || terminalFailure) {
          return;
        }

        acceptOutput = false;
        terminalFailure = {
          code: "backend_startup_timeout",
          stage: "startup",
          message: `${this.name} startup timeout after ${this.startupTimeoutMs}ms`,
          detail: "CLI 已启动但在启动窗口内没有产生任何 stdout/stderr 输出。",
          retryable: true
        };
        this.emitLog("error", sessionId, "backend_startup_timeout", {
          attempt,
          command: this.command,
          args,
          timeoutMs: this.startupTimeoutMs
        });
        this.abort(sessionId);
      }, this.startupTimeoutMs);
      startupTimer.unref?.();

      const executionTimer = setTimeout(() => {
        if (terminalFailure) {
          return;
        }

        acceptOutput = false;
        terminalFailure = {
          code: "backend_execution_timeout",
          stage: "execution",
          message: `${this.name} execution timeout after ${this.executionTimeoutMs}ms`,
          detail: "CLI 在执行窗口内未正常结束。",
          retryable: !meaningfulOutputSeen
        };
        this.emitLog("error", sessionId, "backend_execution_timeout", {
          attempt,
          command: this.command,
          args,
          timeoutMs: this.executionTimeoutMs
        });
        this.abort(sessionId);
      }, this.executionTimeoutMs);
      executionTimer.unref?.();

      const markSignalSeen = (): void => {
        firstSignalSeen = true;
        clearTimeout(startupTimer);
      };

      const finalize = (result: AttemptResult): void => {
        clearTimeout(startupTimer);
        clearTimeout(executionTimer);
        if (terminalFailure === null || terminalFailure.code === "backend_exit_nonzero") {
          stdoutParser.flush();
          stderrParser.flush();
        }
        stdoutReader.close();
        stderrReader.close();
        this.untrackChild(child);
        resolve(result);
      };

      const emitFailure = (failure: AttemptFailure, code: number | null, signal: NodeJS.Signals | null): void => {
        if (!isFinalAttempt) {
          return;
        }

        pushEvent({
          type: "error",
          payload: {
            code: failure.code,
            message: failure.message,
            retryable: failure.retryable,
            details: {
              stage: failure.stage,
              detail: failure.detail,
              attempt,
              command: this.command,
              args,
              spawnCommand: spawnTarget.command,
              spawnArgs: spawnTarget.args,
              exitCode: code,
              signal,
              stderrTail,
              sessionId,
              diagnostics: {
                code: failure.code,
                message: failure.message,
                detail: failure.detail,
                retryable: failure.retryable,
                severity: "error"
              },
              suggestedActions: [
                failure.retryable ? "retry" : "check_runtime_configuration",
                "copy_diagnostic"
              ]
            }
          }
        });
      };

      child.stdout.on("data", () => {
        markSignalSeen();
      });

      child.stderr.on("data", () => {
        markSignalSeen();
      });

      stdoutReader.on("line", (line) => {
        markSignalSeen();
        if (!acceptOutput) {
          return;
        }
        stdoutParser.handleLine(line);
      });

      stderrReader.on("line", (line) => {
        markSignalSeen();
        if (!acceptOutput) {
          return;
        }
        rememberStderr(line);
        this.emitLog("warn", sessionId, "backend_stderr", { attempt, line });
        stderrParser.handleLine(line);
      });

      child.once("error", (error) => {
        if (!terminalFailure) {
          acceptOutput = false;
          terminalFailure = {
          code: "spawn_failed",
          stage: "spawn",
          message: error.message,
          detail: "CLI 进程未能成功启动，请检查命令路径、权限或安装状态。",
          retryable: true
        };
        }
        this.emitLog("error", sessionId, "backend_spawn_failed", {
          attempt,
          message: error.message,
          command: this.command,
          args,
          spawnCommand: spawnTarget.command,
          spawnArgs: spawnTarget.args
        });
      });

      child.once("close", (code, signal) => {
        markSignalSeen();

        if (!terminalFailure && code !== 0) {
          terminalFailure = {
            code: signal ? "backend_aborted" : "backend_exit_nonzero",
            stage: signal ? "abort" : "execution",
            message: signal
              ? `${this.name} terminated by signal ${signal}`
              : `${this.name} exited with code ${code ?? "null"}`,
            detail: stderrTail.length > 0 ? stderrTail.join("\n") : undefined,
            retryable: signal !== null && !meaningfulOutputSeen
          };
        }

        const success = terminalFailure === null;
        if (success) {
          this.emitLog("info", sessionId, "backend_exit", {
            attempt,
            command: this.command,
            args,
            spawnCommand: spawnTarget.command,
            spawnArgs: spawnTarget.args,
            exitCode: code,
            signal
          });
        } else {
          const failure = terminalFailure!;
          this.emitLog("error", sessionId, failure.code, {
            attempt,
            command: this.command,
            args,
            spawnCommand: spawnTarget.command,
            spawnArgs: spawnTarget.args,
            exitCode: code,
            signal,
            stderrTail,
            stage: failure.stage
          });
          emitFailure(failure, code, signal);
        }

        if ((success || isFinalAttempt) && !doneEmitted) {
          pushEvent({
            type: "done",
            payload: {
              reason: success ? "completed" : terminalFailure?.code ?? "backend_failed"
            }
          });
        }

        finalize({
          success,
          retryable: terminalFailure?.retryable ?? false
        });
      });
    });
  }

  private trackSession(sessionId: string, child: ChildProcessWithoutNullStreams): void {
    this.running.set(sessionId, child);
  }

  private untrackChild(child: ChildProcessWithoutNullStreams): void {
    for (const [trackedSessionId, trackedChild] of this.running.entries()) {
      if (trackedChild === child) {
        this.running.delete(trackedSessionId);
      }
    }
  }

  private emitLog(
    level: "info" | "warn" | "error",
    sessionId: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.onLog?.({
      level,
      backend: this.name,
      sessionId,
      message,
      data
    });
  }

  private terminateWindowsProcessTree(pid: number | undefined, force: boolean): void {
    if (!pid) {
      return;
    }

    const args = ["/pid", String(pid), "/T"];
    if (force) {
      args.push("/F");
    }

    const killer = spawn("taskkill", args, {
      stdio: "ignore",
      windowsHide: true
    });
    killer.on("error", () => undefined);
  }
}





