import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { McpRuntimeError, McpRuntimeManager, type McpRuntimeServerConfig } from "./mcp-runtime.js";

type McpServerStatus = "running" | "stopped" | "error";

interface McpServerRecord {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
  enabled: boolean;
  status: McpServerStatus;
  createdAt: string;
  updatedAt: string;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastError: string | null;
}

interface CreateMcpServerBody {
  id?: string;
  name?: string;
  description?: string;
  command?: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  enabled?: boolean;
}

interface UpdateMcpServerBody {
  name?: string;
  description?: string;
  command?: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  enabled?: boolean;
}

interface McpToolCallBody {
  name?: string;
  arguments?: Record<string, unknown>;
}

interface McpReadResourceBody {
  uri?: string;
}

interface McpStoreFilePayload {
  items: McpServerRecord[];
}

let storeLoadPromise: Promise<McpServerRecord[]> | null = null;

function toServerId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function pickWorkspaceRoot(): string {
  let current = process.cwd();

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

function resolveStoreFilePath(): string {
  const configured = process.env.OKCLAW_MCP_CONFIG_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  return path.join(pickWorkspaceRoot(), ".okclaw", "mcp-servers.json");
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeString(input: unknown, fallback = ""): string {
  return typeof input === "string" ? input.trim() || fallback : fallback;
}

function normalizeArgs(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeEnv(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key.trim() || typeof value !== "string") {
      continue;
    }

    result[key.trim()] = value;
  }

  return result;
}

function normalizeStatus(input: unknown): McpServerStatus {
  return input === "running" || input === "error" || input === "stopped" ? input : "stopped";
}

function toRuntimeConfig(server: McpServerRecord): McpRuntimeServerConfig {
  return {
    id: server.id,
    command: server.command,
    args: server.args,
    cwd: server.cwd,
    env: server.env
  };
}

function mapRuntimeError(error: unknown): { code: string; message: string; detail?: unknown } {
  if (error instanceof McpRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      detail: error.detail
    };
  }

  return {
    code: "MCP_PROTOCOL_ERROR",
    message: error instanceof Error ? error.message : "MCP 操作失败"
  };
}

function createDefaultServers(): McpServerRecord[] {
  const timestamp = nowIso();

  return [
    {
      id: "sqlite",
      name: "SQLite MCP",
      description: "查询知识库 SQLite",
      command: "sqlite-mcp",
      args: [],
      cwd: null,
      env: {},
      enabled: true,
      status: "stopped",
      createdAt: timestamp,
      updatedAt: timestamp,
      lastStartedAt: null,
      lastStoppedAt: timestamp,
      lastError: null
    },
    {
      id: "git",
      name: "Git MCP",
      description: "仓库历史与差异分析",
      command: "git-mcp",
      args: [],
      cwd: null,
      env: {},
      enabled: true,
      status: "stopped",
      createdAt: timestamp,
      updatedAt: timestamp,
      lastStartedAt: null,
      lastStoppedAt: timestamp,
      lastError: null
    },
    {
      id: "web-search",
      name: "Web Search MCP",
      description: "外部文档检索",
      command: "web-search-mcp",
      args: [],
      cwd: null,
      env: {},
      enabled: false,
      status: "stopped",
      createdAt: timestamp,
      updatedAt: timestamp,
      lastStartedAt: null,
      lastStoppedAt: timestamp,
      lastError: null
    }
  ];
}

function normalizeServer(raw: Partial<McpServerRecord>): McpServerRecord {
  const timestamp = nowIso();
  const name = normalizeString(raw.name, "Unnamed MCP");
  const id = normalizeString(raw.id, toServerId(name) || "mcp-server");

  return {
    id,
    name,
    description: normalizeString(raw.description),
    command: normalizeString(raw.command, "mcp-server"),
    args: normalizeArgs(raw.args),
    cwd: typeof raw.cwd === "string" && raw.cwd.trim() ? raw.cwd.trim() : null,
    env: normalizeEnv(raw.env),
    enabled: Boolean(raw.enabled),
    status: normalizeStatus(raw.status),
    createdAt: normalizeString(raw.createdAt, timestamp),
    updatedAt: normalizeString(raw.updatedAt, timestamp),
    lastStartedAt: typeof raw.lastStartedAt === "string" && raw.lastStartedAt ? raw.lastStartedAt : null,
    lastStoppedAt: typeof raw.lastStoppedAt === "string" && raw.lastStoppedAt ? raw.lastStoppedAt : null,
    lastError: typeof raw.lastError === "string" && raw.lastError ? raw.lastError : null
  };
}

async function persistServers(items: McpServerRecord[]): Promise<void> {
  const filePath = resolveStoreFilePath();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const payload: McpStoreFilePayload = { items };
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

async function loadServers(): Promise<McpServerRecord[]> {
  if (storeLoadPromise) {
    return storeLoadPromise;
  }

  storeLoadPromise = (async () => {
    const filePath = resolveStoreFilePath();

    try {
      const raw = await fsp.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<McpStoreFilePayload>;
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        const normalized = parsed.items.map((item) => normalizeServer(item));
        await persistServers(normalized);
        return normalized;
      }
    } catch {
      // ignore and fallback to default
    }

    const defaults = createDefaultServers();
    await persistServers(defaults);
    return defaults;
  })();

  return storeLoadPromise;
}

function ensureUniqueServerId(idBase: string, existing: McpServerRecord[]): string {
  const normalizedBase = idBase || "mcp-server";
  if (!existing.some((item) => item.id === normalizedBase)) {
    return normalizedBase;
  }

  let counter = 2;
  while (existing.some((item) => item.id === `${normalizedBase}-${counter}`)) {
    counter += 1;
  }

  return `${normalizedBase}-${counter}`;
}

function applyServerPatch(target: McpServerRecord, patch: UpdateMcpServerBody): McpServerRecord {
  const next = { ...target };

  if (typeof patch.name === "string" && patch.name.trim()) {
    next.name = patch.name.trim();
  }

  if (typeof patch.description === "string") {
    next.description = patch.description.trim();
  }

  if (typeof patch.command === "string" && patch.command.trim()) {
    next.command = patch.command.trim();
  }

  if (Array.isArray(patch.args)) {
    next.args = normalizeArgs(patch.args);
  }

  if (patch.cwd === null) {
    next.cwd = null;
  } else if (typeof patch.cwd === "string" && patch.cwd.trim()) {
    next.cwd = patch.cwd.trim();
  }

  if (patch.env && typeof patch.env === "object") {
    next.env = normalizeEnv(patch.env);
  }

  if (typeof patch.enabled === "boolean") {
    next.enabled = patch.enabled;

    if (!patch.enabled) {
      next.status = "stopped";
      next.lastStoppedAt = nowIso();
    }
  }

  next.updatedAt = nowIso();
  return next;
}

export const mcpRoutes: FastifyPluginAsync = async (app) => {
  const runtime = new McpRuntimeManager((serverId, reason) => {
    void (async () => {
      const servers = await loadServers();
      const target = servers.find((item) => item.id === serverId);
      if (!target) {
        return;
      }
      target.status = reason ? "error" : "stopped";
      target.lastError = reason;
      target.lastStoppedAt = nowIso();
      target.updatedAt = nowIso();
      await persistServers(servers);
    })();
  });

  app.addHook("onClose", async () => {
    await runtime.stopAll();
  });

  const findServer = async (serverId: string): Promise<{ servers: McpServerRecord[]; target: McpServerRecord | null }> => {
    const servers = await loadServers();
    const target = servers.find((server) => server.id === serverId) ?? null;
    return { servers, target };
  };

  const persistRuntimeState = async (
    servers: McpServerRecord[],
    target: McpServerRecord,
    input: { status: McpServerStatus; lastError?: string | null; started?: boolean; stopped?: boolean }
  ): Promise<void> => {
    target.status = input.status;
    target.lastError = input.lastError ?? null;
    if (input.started) {
      target.lastStartedAt = nowIso();
    }
    if (input.stopped) {
      target.lastStoppedAt = nowIso();
    }
    target.updatedAt = nowIso();
    await persistServers(servers);
  };

  const connectServer = async (servers: McpServerRecord[], target: McpServerRecord): Promise<McpServerRecord> => {
    target.enabled = true;
    await runtime.connect(toRuntimeConfig(target));
    await persistRuntimeState(servers, target, {
      status: "running",
      lastError: null,
      started: true
    });
    return target;
  };

  const disconnectServer = async (servers: McpServerRecord[], target: McpServerRecord): Promise<McpServerRecord> => {
    await runtime.disconnect(target.id);
    await persistRuntimeState(servers, target, {
      status: "stopped",
      stopped: true
    });
    return target;
  };

  const replyRuntimeError = async (
    reply: FastifyReply,
    servers: McpServerRecord[],
    target: McpServerRecord,
    error: unknown
  ) => {
    const mapped = mapRuntimeError(error);
    await persistRuntimeState(servers, target, {
      status: "error",
      lastError: mapped.message
    });
    return reply.code(502).send({
      error: mapped
    });
  };

  app.get("/servers", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const items = await loadServers();
    return reply.send({ items });
  });

  app.post<{ Body: CreateMcpServerBody }>(
    "/servers",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const servers = await loadServers();
      const name = normalizeString(request.body?.name, "Unnamed MCP");
      const idInput = normalizeString(request.body?.id, toServerId(name));
      const id = ensureUniqueServerId(idInput || "mcp-server", servers);
      const timestamp = nowIso();

      const created = normalizeServer({
        id,
        name,
        description: request.body?.description,
        command: request.body?.command,
        args: request.body?.args,
        cwd: request.body?.cwd,
        env: request.body?.env,
        enabled: request.body?.enabled ?? false,
        status: "stopped",
        createdAt: timestamp,
        updatedAt: timestamp,
        lastStartedAt: null,
        lastStoppedAt: timestamp,
        lastError: null
      });

      servers.push(created);
      await persistServers(servers);
      if (created.enabled) {
        try {
          await connectServer(servers, created);
        } catch (error) {
          await persistRuntimeState(servers, created, {
            status: "error",
            lastError: mapRuntimeError(error).message
          });
        }
      }
      return reply.code(201).send(created);
    }
  );

  app.patch<{ Params: { serverId: string }; Body: UpdateMcpServerBody }>(
    "/servers/:serverId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const servers = await loadServers();
      const targetIndex = servers.findIndex((server) => server.id === request.params.serverId);
      if (targetIndex < 0) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }

      const updated = applyServerPatch(servers[targetIndex], request.body ?? {});
      servers[targetIndex] = updated;
      if (updated.enabled) {
        try {
          await runtime.connect(toRuntimeConfig(updated));
          await persistRuntimeState(servers, updated, {
            status: "running",
            lastError: null,
            started: true
          });
        } catch (error) {
          return replyRuntimeError(reply, servers, updated, error);
        }
      } else {
        await runtime.disconnect(updated.id);
        await persistRuntimeState(servers, updated, {
          status: "stopped",
          stopped: true
        });
      }
      await persistServers(servers);
      return reply.send(updated);
    }
  );

  app.delete<{ Params: { serverId: string } }>(
    "/servers/:serverId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const servers = await loadServers();
      const targetIndex = servers.findIndex((server) => server.id === request.params.serverId);
      if (targetIndex < 0) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }

      await runtime.disconnect(servers[targetIndex].id);
      servers.splice(targetIndex, 1);
      await persistServers(servers);
      return reply.code(204).send();
    }
  );

  app.post<{ Params: { serverId: string } }>(
    "/servers/:serverId/start",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { servers, target } = await findServer(request.params.serverId);
      if (!target) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }

      try {
        await connectServer(servers, target);
      } catch (error) {
        return replyRuntimeError(reply, servers, target, error);
      }
      return reply.send(target);
    }
  );

  app.post<{ Params: { serverId: string } }>(
    "/servers/:serverId/stop",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { servers, target } = await findServer(request.params.serverId);
      if (!target) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }

      await disconnectServer(servers, target);
      return reply.send(target);
    }
  );

  app.post<{ Params: { serverId: string } }>(
    "/servers/:serverId/connect",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { servers, target } = await findServer(request.params.serverId);
      if (!target) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }
      try {
        await connectServer(servers, target);
      } catch (error) {
        return replyRuntimeError(reply, servers, target, error);
      }
      return reply.send(target);
    }
  );

  app.post<{ Params: { serverId: string } }>(
    "/servers/:serverId/disconnect",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { servers, target } = await findServer(request.params.serverId);
      if (!target) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }
      await disconnectServer(servers, target);
      return reply.send(target);
    }
  );

  app.get<{ Params: { serverId: string } }>(
    "/servers/:serverId/tools",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { servers, target } = await findServer(request.params.serverId);
      if (!target) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }
      if (!target.enabled) {
        return reply.code(409).send({ message: "MCP Server 未启用，请先启用后再访问运行能力。" });
      }
      try {
        const items = await runtime.listTools(toRuntimeConfig(target));
        await persistRuntimeState(servers, target, {
          status: "running",
          lastError: null
        });
        return reply.send({ items });
      } catch (error) {
        return replyRuntimeError(reply, servers, target, error);
      }
    }
  );

  app.post<{ Params: { serverId: string }; Body: McpToolCallBody }>(
    "/servers/:serverId/tools/call",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { servers, target } = await findServer(request.params.serverId);
      if (!target) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }
      if (!target.enabled) {
        return reply.code(409).send({ message: "MCP Server 未启用，请先启用后再访问运行能力。" });
      }
      const name = normalizeString(request.body?.name);
      if (!name) {
        return reply.code(400).send({ message: "name 必填" });
      }
      const args =
        request.body?.arguments && typeof request.body.arguments === "object" ? request.body.arguments : {};

      try {
        const result = await runtime.callTool(toRuntimeConfig(target), name, args);
        await persistRuntimeState(servers, target, {
          status: "running",
          lastError: null
        });
        return reply.send(result);
      } catch (error) {
        return replyRuntimeError(reply, servers, target, error);
      }
    }
  );

  app.get<{ Params: { serverId: string } }>(
    "/servers/:serverId/resources",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { servers, target } = await findServer(request.params.serverId);
      if (!target) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }
      if (!target.enabled) {
        return reply.code(409).send({ message: "MCP Server 未启用，请先启用后再访问运行能力。" });
      }
      try {
        const items = await runtime.listResources(toRuntimeConfig(target));
        await persistRuntimeState(servers, target, {
          status: "running",
          lastError: null
        });
        return reply.send({ items });
      } catch (error) {
        return replyRuntimeError(reply, servers, target, error);
      }
    }
  );

  app.post<{ Params: { serverId: string }; Body: McpReadResourceBody }>(
    "/servers/:serverId/resources/read",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { servers, target } = await findServer(request.params.serverId);
      if (!target) {
        return reply.code(404).send({ message: "MCP Server 不存在" });
      }
      if (!target.enabled) {
        return reply.code(409).send({ message: "MCP Server 未启用，请先启用后再访问运行能力。" });
      }
      const uri = normalizeString(request.body?.uri);
      if (!uri) {
        return reply.code(400).send({ message: "uri 必填" });
      }
      try {
        const contents = await runtime.readResource(toRuntimeConfig(target), uri);
        await persistRuntimeState(servers, target, {
          status: "running",
          lastError: null
        });
        return reply.send({ contents });
      } catch (error) {
        return replyRuntimeError(reply, servers, target, error);
      }
    }
  );
};
