import type { FastifyPluginAsync } from "fastify";
import type {
  TeamEventType
} from "../types/contracts.js";

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
    const items = await app.core.runtime.listBackendHealth();
    return reply.send({ items });
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
        return reply.code(202).send(created);
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
      return reply.send({ item });
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
      const items = await app.core.team.listRuns(sessionId);
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
