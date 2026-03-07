import type { FastifyPluginAsync } from "fastify";

interface CreateRepoBody {
  name: string;
  path: string;
}

interface UpdateRepoContextBody {
  preferredAgentId?: unknown;
  preferredAgentName?: unknown;
  preferredBackend?: unknown;
  preferredMode?: unknown;
  preferredSkillIds?: unknown;
  preferredMcpServerIds?: unknown;
  lastSessionId?: unknown;
  lastActivitySummary?: unknown;
  continuePrompt?: unknown;
}

function parseContextBody(input: unknown) {
  const source = typeof input === "object" && input !== null ? (input as UpdateRepoContextBody) : {};

  const toNullableString = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") {
      throw new Error("上下文字段必须是字符串或 null");
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const toStringArray = (value: unknown): string[] | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      throw new Error("数组字段必须是字符串数组");
    }
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  };

  return {
    preferredAgentId: toNullableString(source.preferredAgentId),
    preferredAgentName: toNullableString(source.preferredAgentName),
    preferredBackend: toNullableString(source.preferredBackend) ?? undefined,
    preferredMode: toNullableString(source.preferredMode),
    preferredSkillIds: toStringArray(source.preferredSkillIds),
    preferredMcpServerIds: toStringArray(source.preferredMcpServerIds),
    lastSessionId: toNullableString(source.lastSessionId),
    lastActivitySummary: toNullableString(source.lastActivitySummary),
    continuePrompt: toNullableString(source.continuePrompt)
  };
}

export const reposRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const repos = await app.core.repos.list();
    return reply.send({ items: repos });
  });

  app.post<{ Body: CreateRepoBody }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { name, path } = request.body ?? {};
    if (!name || !path) {
      return reply.code(400).send({ message: "name 和 path 必填" });
    }

    const created = await app.core.repos.create({ name, path });
    return reply.code(201).send(created);
  });

  app.get<{ Params: { repoId: string } }>("/:repoId/context", { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const record = await app.core.repos.getContext(request.params.repoId);
      return reply.send(record);
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : "repository not found" });
    }
  });

  app.patch<{ Params: { repoId: string }; Body: Record<string, unknown> }>("/:repoId/context", { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const record = await app.core.repos.updateContext(request.params.repoId, parseContextBody(request.body));
      return reply.send(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : "update context failed";
      return reply.code(message.includes("repository not found") ? 404 : 400).send({ message });
    }
  });

  app.post<{ Params: { repoId: string } }>("/:repoId/continue", { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const record = await app.core.repos.continue(request.params.repoId);
      return reply.send(record);
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : "repository not found" });
    }
  });
};
