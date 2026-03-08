import type { SqliteDatabase } from "@okk/core";
import type { FastifyPluginAsync } from "fastify";
import type {
  CollaborationAction,
  CollaborationDiagnostics,
  CollaborationRunStatus,
  TeamEventType
} from "../types/contracts.js";
import type { RuntimeBackendHealth, TeamRunMemberResult, TeamRunRecord } from "../core/types.js";

interface PublishTeamEventBody {
  type: TeamEventType;
  payload?: Record<string, unknown>;
}

interface TeamRunMemberBody {
  memberId?: unknown;
  agentName?: unknown;
  backend?: unknown;
  prompt?: unknown;
  taskTitle?: unknown;
  dependsOn?: unknown;
}

interface TeamRunBody {
  teamId?: unknown;
  sessionId?: unknown;
  teamName?: unknown;
  members?: unknown;
}

function normalizeAgentId(name: string, backend: string): string {
  return `${backend}:${name}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function asNonEmptyString(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}

function isStatus(input: unknown): input is "pending" | "running" | "done" | "error" {
  return input === "pending" || input === "running" || input === "done" || input === "error";
}

function validateStandardTeamPayload(
  type: TeamEventType,
  payload: Record<string, unknown>
): boolean {
  if (type === "team_start") {
    return (
      typeof payload.team_name === "string" &&
      payload.team_name.trim().length > 0 &&
      typeof payload.member_count === "number"
    );
  }

  if (type === "team_member_add" || type === "team_member_update") {
    return (
      typeof payload.member_id === "string" &&
      typeof payload.agent_name === "string" &&
      isStatus(payload.status) &&
      typeof payload.backend === "string" &&
      typeof payload.updated_at === "string"
    );
  }

  if (type === "team_task_update") {
    return (
      typeof payload.task_id === "string" &&
      typeof payload.title === "string" &&
      isStatus(payload.status) &&
      Array.isArray(payload.depends_on)
    );
  }

  if (type === "team_message") {
    return (
      typeof payload.message_id === "string" &&
      typeof payload.member_id === "string" &&
      typeof payload.content === "string" &&
      typeof payload.created_at === "string"
    );
  }

  if (type === "capability_status") {
    return (
      typeof payload.capability_id === "string" &&
      typeof payload.capability_name === "string" &&
      typeof payload.summary === "string"
    );
  }

  if (type === "team_end") {
    return payload.status === "done" || payload.status === "error";
  }

  return true;
}

function parseDependsOn(input: unknown): string[] {
  if (input === undefined) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw new Error("dependsOn 必须是字符串数组");
  }

  return Array.from(
    new Set(
      input
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
}

function parseTeamRunMember(input: unknown, index: number) {
  if (!isObject(input)) {
    throw new Error(`members[${index}] 必须是对象`);
  }

  const member = input as TeamRunMemberBody;
  const agentName = asNonEmptyString(member.agentName);
  if (!agentName) {
    throw new Error(`members[${index}].agentName 必填`);
  }

  const prompt = asNonEmptyString(member.prompt);
  if (!prompt) {
    throw new Error(`members[${index}].prompt 必填`);
  }

  const taskTitle = asNonEmptyString(member.taskTitle);
  if (!taskTitle) {
    throw new Error(`members[${index}].taskTitle 必填`);
  }

  const memberId = asNonEmptyString(member.memberId);
  const backend = asNonEmptyString(member.backend);

  return {
    ...(memberId ? { memberId } : {}),
    agentName,
    ...(backend ? { backend } : {}),
    prompt,
    taskTitle,
    dependsOn: parseDependsOn(member.dependsOn)
  };
}

function parseTeamRunBody(input: unknown) {
  if (!isObject(input)) {
    throw new Error("请求体必须是对象");
  }

  const body = input as TeamRunBody;
  const sessionId = asNonEmptyString(body.sessionId);
  if (!sessionId) {
    throw new Error("sessionId 必填");
  }

  const teamName = asNonEmptyString(body.teamName);
  if (!teamName) {
    throw new Error("teamName 必填");
  }
  const teamId = asNonEmptyString(body.teamId);

  if (!Array.isArray(body.members) || body.members.length === 0) {
    throw new Error("members 至少包含一个成员");
  }

  return {
    ...(teamId ? { teamId } : {}),
    sessionId,
    teamName,
    members: body.members.map((item, index) => parseTeamRunMember(item, index))
  };
}

function buildDiagnostics(message: string, options?: { code?: string; detail?: string; retryable?: boolean }): CollaborationDiagnostics {
  return {
    message,
    ...(options?.code ? { code: options.code } : {}),
    ...(options?.detail ? { detail: options.detail } : {}),
    ...(options?.retryable !== undefined ? { retryable: options.retryable } : {}),
    severity: "error"
  };
}

function mapRuntimeStatus(status: TeamRunRecord["status"]): CollaborationRunStatus {
  if (status === "done") {
    return "completed";
  }
  if (status === "error") {
    return "failed";
  }
  return "running";
}

function mapTeamRunMember(member: TeamRunMemberResult): TeamRunMemberResult {
  const diagnostics = member.error ? buildDiagnostics(member.error, { code: "team_member_error", retryable: true }) : undefined;
  const actions: CollaborationAction[] | undefined = diagnostics
    ? [
        { kind: "retry", label: "重试消息" },
        { kind: "copy_diagnostic", label: "复制诊断" }
      ]
    : undefined;

  return {
    ...member,
    sourceType: member.sourceType ?? "agent",
    runtimeStatus: member.runtimeStatus ?? (member.status === "done" ? "completed" : "failed"),
    ...(diagnostics ? { diagnostics } : {}),
    ...(actions ? { actions } : {})
  };
}

function mapTeamRunRecord(item: TeamRunRecord): TeamRunRecord {
  const runtimeStatus = item.runtimeStatus ?? mapRuntimeStatus(item.status);
  const diagnostics = item.diagnostics ?? (item.status === "error" ? buildDiagnostics(item.summary ?? "团队运行失败", { code: "team_run_failed", retryable: true }) : undefined);
  const actions = item.actions ?? (item.status === "error"
    ? [
        { kind: "retry", label: "重试消息" },
        { kind: "copy_diagnostic", label: "复制诊断" }
      ]
    : undefined);

  return {
    ...item,
    sourceType: item.sourceType ?? "team",
    runtimeStatus,
    ...(diagnostics ? { diagnostics } : {}),
    ...(actions ? { actions } : {}),
    members: item.members.map((member) => mapTeamRunMember(member))
  };
}

function mapRuntimeBackend(item: RuntimeBackendHealth): RuntimeBackendHealth {
  const diagnostics = item.diagnostics ?? (!item.available
    ? buildDiagnostics(item.reason ?? `${item.backend} 不可用`, {
        code: "backend_unavailable",
        detail: item.command ? `命令 ${item.command}` : undefined,
        retryable: true
      })
    : undefined);
  const actions = item.actions ?? (!item.available
    ? [
        { kind: "refresh", label: "重试探测" },
        { kind: "copy_diagnostic", label: "复制诊断" }
      ]
    : undefined);

  return {
    ...item,
    sourceType: item.sourceType ?? "backend",
    runtimeStatus: item.runtimeStatus ?? (item.available ? "ready" : "unavailable"),
    ...(diagnostics ? { diagnostics } : {}),
    ...(actions ? { actions } : {})
  };
}

export const agentsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const records = await app.core.agents.list();
    const items = records.map((record) => ({
      id: normalizeAgentId(record.name, record.backend),
      name: record.name,
      description: record.description,
      backend: record.backend,
    }));

    return reply.send({ items });
  });

  app.get("/runtime/backends", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const items = (await app.core.runtime.listBackendHealth()).map((item) => mapRuntimeBackend(item));
    return reply.send({ items });
  });

  app.get<{ Params: { sessionId: string }; Querystring: { traceType?: string; status?: string; sourceType?: string; q?: string; filePath?: string } }>("/traces/:sessionId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = (app.core as unknown as { database?: SqliteDatabase }).database;
    const items = database?.agentTrace
      ? database.agentTrace.listBySessionId(request.params.sessionId, {
          limit: 200,
          traceType: asNonEmptyString(request.query.traceType) ?? undefined,
          status: asNonEmptyString(request.query.status) as never,
          sourceType: asNonEmptyString(request.query.sourceType) ?? undefined,
          q: asNonEmptyString(request.query.q) ?? undefined,
          filePath: asNonEmptyString(request.query.filePath) ?? undefined
        })
      : [];
    return reply.send({ items });
  });

  app.get<{ Params: { sessionId: string; traceId: string } }>("/traces/:sessionId/:traceId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = (app.core as unknown as { database?: SqliteDatabase }).database;
    const item = database?.agentTrace?.getById(request.params.traceId) ?? null;
    if (!item || item.sessionId !== request.params.sessionId) {
      return reply.code(404).send({ message: "trace not found" });
    }
    return reply.send({ item });
  });

  app.get<{ Params: { sessionId: string; traceId: string }; Querystring: { filePath?: string } }>("/traces/:sessionId/:traceId/diff", { preHandler: [app.authenticate] }, async (request, reply) => {
    const filePath = asNonEmptyString(request.query.filePath);
    if (!filePath) {
      return reply.code(400).send({ message: "filePath 必填" });
    }

    const database = (app.core as unknown as { database?: SqliteDatabase }).database;
    const item = database?.agentTrace?.getById(request.params.traceId) ?? null;
    if (!item || item.sessionId !== request.params.sessionId) {
      return reply.code(404).send({ message: "trace not found" });
    }

    const diff = database?.agentTrace?.getFileDiff(request.params.traceId, filePath) ?? null;
    return reply.send({ item: diff });
  });

  app.get("/teams", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const items = await app.core.team.list();
    return reply.send({ items });
  });

  app.post<{ Body: TeamRunBody }>(
    "/teams/runs",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const created = await app.core.team.run(parseTeamRunBody(request.body ?? {}));
        return reply.code(202).send(mapTeamRunRecord(created));
      } catch (error) {
        return reply.code(400).send({
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  app.get<{ Params: { runId: string } }>(
    "/teams/runs/:runId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const runId = asNonEmptyString(request.params.runId);
      if (!runId) {
        return reply.code(400).send({ message: "runId 必填" });
      }
      const item = await app.core.team.getRun(runId);
      if (!item) {
        return reply.code(404).send({ message: "team run 不存在" });
      }
      return reply.send({ item: mapTeamRunRecord(item) });
    }
  );

  app.get<{ Querystring: { sessionId?: string } }>(
    "/teams/runs",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const sessionId = asNonEmptyString(request.query.sessionId);
      if (!sessionId) {
        return reply.code(400).send({ message: "sessionId 必填" });
      }
      const items = (await app.core.team.listRuns(sessionId)).map((item) => mapTeamRunRecord(item));
      return reply.send({ items });
    }
  );

  app.post<{ Body: PublishTeamEventBody }>(
    "/teams/:teamId/events",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { teamId } = request.params as { teamId: string };
      const { type, payload } = request.body ?? {};
      if (!teamId || !type) {
        return reply.code(400).send({ message: "teamId 和 type 必填" });
      }

      const resolvedPayload = isObject(payload) ? payload : {};
      if (!validateStandardTeamPayload(type, resolvedPayload)) {
        return reply.code(400).send({ message: "team event payload 不符合约束" });
      }

      const event = app.core.team.publish({
        teamId,
        type,
        payload: resolvedPayload,
      });

      return reply.code(202).send(event);
    },
  );
};
