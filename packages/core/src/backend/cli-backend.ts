import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import type { BackendCapabilities, BackendEventInput, BackendRequest } from "../types.js";
import { AsyncEventQueue } from "../utils/async-event-queue.js";
import { generateId } from "../utils/id.js";
import type { IBackend } from "./i-backend.js";

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
  capabilities?: Partial<BackendCapabilities>;
  env?: NodeJS.ProcessEnv;
  onLog?: (entry: CliBackendLogEntry) => void;
  stderrTailSize?: number;
}

const defaultCapabilities: BackendCapabilities = {
  supportsResume: true,
  supportsThinking: true,
  supportsTools: true
};

const DEFAULT_STDERR_TAIL_SIZE = 30;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const joinNonEmpty = (values: Array<string | null | undefined>, separator = "\n"): string | null => {
  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized.join(separator) : null;
};

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

    return null;
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

const asBackendEvent = (line: string): BackendEventInput | null => {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { type: "text_delta", payload: { content: line } };
  }

  if (!isObject(parsed)) {
    return null;
  }

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

  return { type: "thinking_delta", payload: { content: trimmed } };
};

export class CliBackend implements IBackend {
  readonly name: string;
  readonly capabilities: BackendCapabilities;

  private readonly command: string;
  private readonly buildArgs: (request: BackendRequest) => string[];
  private readonly env: NodeJS.ProcessEnv;
  private readonly onLog?: (entry: CliBackendLogEntry) => void;
  private readonly stderrTailSize: number;
  private readonly running = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(options: CliBackendOptions) {
    this.name = options.name;
    this.command = options.command;
    this.capabilities = { ...defaultCapabilities, ...options.capabilities };
    this.buildArgs = options.buildArgs ?? ((request) => this.defaultBuildArgs(request));
    this.env = { ...process.env, ...options.env };
    this.onLog = options.onLog;
    this.stderrTailSize = options.stderrTailSize ?? DEFAULT_STDERR_TAIL_SIZE;
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

    const args = this.buildArgs(request);
    const spawnCommand =
      process.platform === "win32" ? "cmd.exe" : this.command;
    const spawnArgs =
      process.platform === "win32"
        ? ["/d", "/s", "/c", this.command, ...args]
        : args;
    const child = spawn(spawnCommand, spawnArgs, {
      cwd: request.workingDirectory,
      env: this.env,
      stdio: "pipe",
      windowsHide: true
    });
    this.trackSession(sessionId, child);
    this.emitLog("info", sessionId, "backend_spawned", {
      command: this.command,
      args,
      spawnCommand,
      spawnArgs,
      pid: child.pid ?? null,
      workingDirectory: request.workingDirectory ?? null
    });

    const queue = new AsyncEventQueue<BackendEventInput>();
    let doneEmitted = false;
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

      let normalizedEvent: BackendEventInput;
      if (event.type === "session_update") {
        normalizedEvent = event;
        this.trackSession(event.payload.sessionId, child);
      } else if (event.sessionId) {
        normalizedEvent = event;
      } else {
        normalizedEvent = { ...event, sessionId };
      }

      queue.push(normalizedEvent);
    };

    const stdoutReader = readline.createInterface({ input: child.stdout });
    const stderrReader = readline.createInterface({ input: child.stderr });

    stdoutReader.on("line", (line) => {
      const event = asBackendEvent(line);
      if (event) {
        pushEvent(event);
      }
    });

    stderrReader.on("line", (line) => {
      rememberStderr(line);
      this.emitLog("warn", sessionId, "backend_stderr", { line });
      pushEvent({
        type: "thinking_delta",
        payload: { content: line }
      });
    });

    child.once("error", (error) => {
        this.emitLog("error", sessionId, "backend_spawn_failed", {
          message: error.message,
          command: this.command,
          args,
          spawnCommand,
          spawnArgs
        });
        pushEvent({
          type: "error",
          payload: {
            code: "spawn_failed",
          message: error.message,
            details: {
              command: this.command,
              args,
              spawnCommand,
              spawnArgs,
              sessionId
            }
          }
        });
      });

    child.once("close", (code, signal) => {
      const success = code === 0;
      if (!success) {
        this.emitLog("error", sessionId, "backend_exit_nonzero", {
          command: this.command,
          args,
          spawnCommand,
          spawnArgs,
          exitCode: code,
          signal,
          stderrTail
        });
        pushEvent({
          type: "error",
          payload: {
            code: "backend_exit_nonzero",
            message: `${this.name} exited with code ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}`,
            details: {
              command: this.command,
              args,
              spawnCommand,
              spawnArgs,
              exitCode: code,
              signal,
              stderrTail,
              sessionId
            }
          }
        });
      } else {
        this.emitLog("info", sessionId, "backend_exit", {
          command: this.command,
          args,
          spawnCommand,
          spawnArgs,
          exitCode: code,
          signal
        });
      }

      if (!doneEmitted) {
        pushEvent({
          type: "done",
          payload: {
            reason: success ? "completed" : "backend_exit_nonzero"
          }
        });
      }

      stdoutReader.close();
      stderrReader.close();
      queue.end();
      this.untrackChild(child);
    });

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
    }, 2000);
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
