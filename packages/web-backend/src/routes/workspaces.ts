import type { SqliteDatabase, WorkspaceSearchRecord } from "@okk/core";
import type { FastifyPluginAsync } from "fastify";

interface WorkspaceBody {
  name?: unknown;
  description?: unknown;
  repoIds?: unknown;
  activeRepoId?: unknown;
}

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)));
};

const getDatabase = (app: { core: unknown }): SqliteDatabase | null => {
  const database = (app.core as { database?: SqliteDatabase }).database;
  return database ?? null;
};

const toWorkspaceInput = (body: WorkspaceBody) => ({
  ...(normalizeString(body.name) ? { name: normalizeString(body.name) as string } : {}),
  ...(body.description === undefined ? {} : { description: normalizeString(body.description) }),
  ...(body.repoIds !== undefined ? { repoIds: normalizeStringArray(body.repoIds) } : {}),
  ...(body.activeRepoId !== undefined ? { activeRepoId: normalizeString(body.activeRepoId) } : {})
});

export const workspacesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const database = getDatabase(app);
    return reply.send({ items: database?.workspaces.list() ?? [] });
  });

  app.post<{ Body: WorkspaceBody }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workspace not available" });
    }

    const input = toWorkspaceInput(request.body ?? {});
    if (!input.name) {
      return reply.code(400).send({ message: "name 必填" });
    }

    const item = database.workspaces.create({
      name: input.name,
      description: input.description,
      repoIds: input.repoIds,
      activeRepoId: input.activeRepoId
    });
    return reply.code(201).send({ item });
  });

  app.patch<{ Params: { workspaceId: string }; Body: WorkspaceBody }>("/:workspaceId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workspace not available" });
    }

    const item = database.workspaces.update(request.params.workspaceId, toWorkspaceInput(request.body ?? {}));
    if (!item) {
      return reply.code(404).send({ message: "workspace not found" });
    }

    return reply.send({ item });
  });

  app.delete<{ Params: { workspaceId: string } }>("/:workspaceId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workspace not available" });
    }

    const removed = database.workspaces.delete(request.params.workspaceId);
    return reply.code(removed ? 204 : 404).send();
  });

  app.post<{ Params: { workspaceId: string }; Body: { repoId?: string } }>("/:workspaceId/activate", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workspace not available" });
    }

    const repoId = normalizeString(request.body?.repoId);
    if (!repoId) {
      return reply.code(400).send({ message: "repoId 必填" });
    }

    const item = database.workspaces.activateRepo(request.params.workspaceId, repoId);
    if (!item) {
      return reply.code(404).send({ message: "workspace 或 repo 不存在" });
    }

    return reply.send({ item });
  });

  app.get<{ Params: { workspaceId: string } }>("/:workspaceId/status", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workspace not available" });
    }

    const item = database.workspaces.getById(request.params.workspaceId);
    if (!item) {
      return reply.code(404).send({ message: "workspace not found" });
    }

    return reply.send({
      item,
      repositories: database.workspaces.listRepositoryStatus(item.id)
    });
  });

  app.get<{ Params: { workspaceId: string }; Querystring: { q?: string } }>("/:workspaceId/search", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workspace not available" });
    }

    const workspace = database.workspaces.getById(request.params.workspaceId);
    if (!workspace) {
      return reply.code(404).send({ message: "workspace not found" });
    }

    const query = request.query.q?.trim() ?? "";
    const repoIds = new Set(workspace.repoIds);
    const repoItems = database.repositories
      .list()
      .filter((repo) => repoIds.has(repo.id))
      .filter((repo) => !query || repo.name.includes(query) || repo.path.includes(query))
      .map<WorkspaceSearchRecord>((repo) => ({
        kind: "repo",
        id: repo.id,
        repoId: repo.id,
        title: repo.name,
        summary: repo.path,
        updatedAt: repo.createdAt
      }));

    const sessionItems = (await app.core.sessions.list(query ? { q: query } : undefined))
      .filter((session) => repoIds.has(session.repoId))
      .map<WorkspaceSearchRecord>((session) => ({
        kind: "session",
        id: session.id,
        repoId: session.repoId,
        title: session.title,
        summary: session.summary ?? "",
        updatedAt: session.updatedAt
      }));

    const knowledgeItems = Array.from(repoIds).flatMap((repoId) =>
      (query ? database.knowledge.search({ keyword: query, repoId, limit: 10 }) : database.knowledge.listByRepo(repoId).slice(0, 10)).map<WorkspaceSearchRecord>((entry) => ({
        kind: "knowledge",
        id: entry.id,
        repoId,
        title: entry.title,
        summary: entry.summary,
        updatedAt: entry.updatedAt
      }))
    );

    const items = [...repoItems, ...sessionItems, ...knowledgeItems].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return reply.send({ items });
  });
};
