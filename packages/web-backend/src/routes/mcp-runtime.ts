import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type McpRuntimeErrorCode =
  | "MCP_NOT_RUNNING"
  | "MCP_TIMEOUT"
  | "MCP_PROTOCOL_ERROR"
  | "MCP_TOOL_ERROR"
  | "MCP_RESOURCE_ERROR";

export class McpRuntimeError extends Error {
  constructor(
    readonly code: McpRuntimeErrorCode,
    message: string,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = "McpRuntimeError";
  }
}

export interface McpRuntimeServerConfig {
  id: string;
  command: string;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
}

export interface McpResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string | null;
}

export interface McpReadContent {
  uri: string;
  mimeType: string | null;
  text: string;
}

type RuntimeExitHandler = (serverId: string, reason: string | null) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const DEFAULT_RPC_TIMEOUT_MS = 15000;
const EXIT_KILL_TIMEOUT_MS = 1800;

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function asString(input: unknown, fallback = ""): string {
  return typeof input === "string" ? input : fallback;
}

function summarizeToolCallResult(raw: Record<string, unknown>): string {
  const content = raw.content;
  if (Array.isArray(content)) {
    const chunks = content
      .map((item) => {
        const record = asRecord(item);
        const text = asString(record.text);
        return text.trim();
      })
      .filter(Boolean);
    if (chunks.length > 0) {
      return chunks.join("\n");
    }
  }

  const output = asString(raw.output);
  if (output.trim().length > 0) {
    return output;
  }

  return JSON.stringify(raw);
}

function parseReadContents(raw: unknown): McpReadContent[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => asRecord(item))
    .map((item) => ({
      uri: asString(item.uri),
      mimeType: asString(item.mimeType).trim() || null,
      text: asString(item.text)
    }))
    .filter((item) => item.uri.trim().length > 0 || item.text.trim().length > 0);
}

class JsonRpcStdioClient {
  private readonly pending = new Map<number, PendingRequest>();

  private nextRequestId = 1;

  private stdoutBuffer = Buffer.alloc(0);

  private closed = false;
  private closedByUser = false;

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly serverId: string,
    private readonly onExit: RuntimeExitHandler
  ) {
    child.stdout.on("data", (chunk: Buffer) => {
      this.handleStdoutChunk(chunk);
    });
    child.stderr.on("data", () => undefined);
    child.on("exit", (code, signal) => {
      const reason =
        this.closedByUser || code === 0
          ? null
          : `MCP 进程退出(code=${code ?? "null"}, signal=${signal ?? "none"})`;
      this.closed = true;
      this.rejectAllPending(
        new McpRuntimeError("MCP_NOT_RUNNING", reason ?? "MCP 进程已停止", {
          code,
          signal
        })
      );
      this.onExit(this.serverId, reason);
    });
    child.on("error", (error) => {
      this.closed = true;
      this.rejectAllPending(new McpRuntimeError("MCP_NOT_RUNNING", error.message, error));
      this.onExit(this.serverId, error.message);
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "okk",
        version: "0.1.0"
      }
    });
    this.notify("initialized", {});
    this.notify("notifications/initialized", {});
  }

  async request(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.closed) {
      throw new McpRuntimeError("MCP_NOT_RUNNING", "MCP 连接已关闭");
    }

    const requestId = this.nextRequestId;
    this.nextRequestId += 1;

    const response = await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new McpRuntimeError("MCP_TIMEOUT", `MCP 请求超时: ${method}`, {
            serverId: this.serverId,
            method
          })
        );
      }, DEFAULT_RPC_TIMEOUT_MS);
      timer.unref?.();

      this.pending.set(requestId, {
        resolve,
        reject: (error) => reject(error),
        timer
      });

      try {
        this.writeFrame({
          jsonrpc: "2.0",
          id: requestId,
          method,
          params
        });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(
          new McpRuntimeError(
            "MCP_NOT_RUNNING",
            error instanceof Error ? error.message : "发送 MCP 请求失败",
            error
          )
        );
      }
    });

    return asRecord(response);
  }

  notify(method: string, params: Record<string, unknown>): void {
    if (this.closed) {
      return;
    }
    this.writeFrame({
      jsonrpc: "2.0",
      method,
      params
    });
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closedByUser = true;
    this.closed = true;
    this.rejectAllPending(new McpRuntimeError("MCP_NOT_RUNNING", "MCP 连接已关闭"));

    this.child.kill("SIGTERM");
    const killTimer = setTimeout(() => {
      if (this.child.exitCode === null) {
        this.child.kill("SIGKILL");
      }
    }, EXIT_KILL_TIMEOUT_MS);
    killTimer.unref?.();
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private writeFrame(payload: Record<string, unknown>): void {
    const body = JSON.stringify(payload);
    const frame = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
    this.child.stdin.write(frame);
  }

  private handleStdoutChunk(chunk: Buffer): void {
    if (this.closed) {
      return;
    }
    this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, chunk]);

    while (true) {
      const headerEnd = this.stdoutBuffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        return;
      }

      const headerRaw = this.stdoutBuffer.slice(0, headerEnd).toString("utf8");
      const lengthMatch = /content-length:\s*(\d+)/i.exec(headerRaw);
      if (!lengthMatch) {
        this.stdoutBuffer = this.stdoutBuffer.slice(headerEnd + 4);
        continue;
      }

      const bodyLength = Number.parseInt(lengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + bodyLength;
      if (this.stdoutBuffer.length < bodyEnd) {
        return;
      }

      const bodyRaw = this.stdoutBuffer.slice(bodyStart, bodyEnd).toString("utf8");
      this.stdoutBuffer = this.stdoutBuffer.slice(bodyEnd);

      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyRaw);
      } catch {
        continue;
      }
      this.onIncomingMessage(asRecord(parsed));
    }
  }

  private onIncomingMessage(message: Record<string, unknown>): void {
    const id = message.id;
    if (typeof id !== "number") {
      return;
    }
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }

    this.pending.delete(id);
    clearTimeout(pending.timer);

    if (message.error) {
      const errorRecord = asRecord(message.error);
      pending.reject(
        new McpRuntimeError("MCP_PROTOCOL_ERROR", asString(errorRecord.message, "MCP 调用失败"), errorRecord)
      );
      return;
    }

    pending.resolve(message.result);
  }
}

export class McpRuntimeManager {
  private readonly connections = new Map<string, JsonRpcStdioClient>();

  constructor(private readonly onExit?: RuntimeExitHandler) {}

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  async connect(server: McpRuntimeServerConfig): Promise<void> {
    if (this.connections.has(server.id)) {
      return;
    }

    const spawnCommand = process.platform === "win32" ? "cmd.exe" : server.command;
    const spawnArgs =
      process.platform === "win32"
        ? ["/d", "/s", "/c", server.command, ...server.args]
        : server.args;
    const child = spawn(spawnCommand, spawnArgs, {
      cwd: server.cwd ?? undefined,
      env: {
        ...process.env,
        ...server.env
      },
      stdio: "pipe",
      windowsHide: true
    });
    const client = new JsonRpcStdioClient(child, server.id, (serverId, reason) => {
      this.connections.delete(serverId);
      this.onExit?.(serverId, reason);
    });

    try {
      await client.initialize();
      this.connections.set(server.id, client);
    } catch (error) {
      await client.close();
      throw error;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }
    this.connections.delete(serverId);
    await connection.close();
  }

  async stopAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys());
    for (const serverId of serverIds) {
      await this.disconnect(serverId);
    }
  }

  async listTools(server: McpRuntimeServerConfig): Promise<McpToolDescriptor[]> {
    const connection = await this.ensureConnected(server);
    const result = await connection.request("tools/list", {});
    const tools = Array.isArray(result.tools) ? result.tools : [];
    return tools
      .map((item) => asRecord(item))
      .map((item) => ({
        name: asString(item.name),
        description: asString(item.description),
        inputSchema: asRecord(item.inputSchema)
      }))
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        ...item,
        inputSchema: Object.keys(item.inputSchema).length > 0 ? item.inputSchema : null
      }));
  }

  async callTool(
    server: McpRuntimeServerConfig,
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: string; raw: Record<string, unknown> }> {
    const connection = await this.ensureConnected(server);
    const raw = await connection.request("tools/call", {
      name,
      arguments: args
    });
    return {
      content: summarizeToolCallResult(raw),
      raw
    };
  }

  async listResources(server: McpRuntimeServerConfig): Promise<McpResourceDescriptor[]> {
    const connection = await this.ensureConnected(server);
    const result = await connection.request("resources/list", {});
    const resources = Array.isArray(result.resources) ? result.resources : [];
    return resources
      .map((item) => asRecord(item))
      .map((item) => ({
        uri: asString(item.uri),
        name: asString(item.name),
        description: asString(item.description),
        mimeType: asString(item.mimeType).trim() || null
      }))
      .filter((item) => item.uri.trim().length > 0);
  }

  async readResource(server: McpRuntimeServerConfig, uri: string): Promise<McpReadContent[]> {
    const connection = await this.ensureConnected(server);
    const result = await connection.request("resources/read", { uri });
    return parseReadContents(result.contents);
  }

  private async ensureConnected(server: McpRuntimeServerConfig): Promise<JsonRpcStdioClient> {
    if (!this.connections.has(server.id)) {
      await this.connect(server);
    }
    const connection = this.connections.get(server.id);
    if (!connection) {
      throw new McpRuntimeError("MCP_NOT_RUNNING", `MCP server 未连接: ${server.id}`);
    }
    return connection;
  }
}
