import type { FastifyInstance, FastifyPluginAsync } from "fastify";

interface CreateSessionBody {
  title?: string;
  repoId?: string;
}

interface ListSessionsQuery {
  q?: string;
  archived?: string;
  tag?: string;
}

async function resolveRepoId(app: FastifyInstance, requestedRepoId?: string): Promise<string> {
  if (requestedRepoId && requestedRepoId.trim().length > 0) {
    return requestedRepoId;
  }

  const repos = await app.core.repos.list();
  if (repos.length > 0) {
    return repos[0].id;
  }

  const created = await app.core.repos.create({
    name: "默认仓库",
    path: process.cwd(),
  });

  return created.id;
}

export const sessionsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ListSessionsQuery }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const sessions = await app.core.sessions.list({
      ...(typeof request.query.q === "string" && request.query.q.trim().length > 0 ? { q: request.query.q.trim() } : {}),
      ...(typeof request.query.tag === "string" && request.query.tag.trim().length > 0 ? { tag: request.query.tag.trim() } : {}),
      archived: request.query.archived === "true"
    });
    return reply.send({ items: sessions });
  });

  app.post<{ Body: CreateSessionBody }>(
    "/",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const input = request.body ?? {};
      const title = typeof input.title === "string" && input.title.trim().length > 0 ? input.title.trim() : "新会话";
      const repoId = await resolveRepoId(app, input.repoId);

      const created = await app.core.sessions.create({ title, repoId });
      return reply.code(201).send(created);
    },
  );

  app.post<{ Params: { sessionId: string } }>("/:sessionId/archive", { preHandler: [app.authenticate] }, async (request, reply) => {
    const updated = await app.core.sessions.archive(request.params.sessionId);
    if (!updated) {
      return reply.code(404).send({ message: "session not found" });
    }
    return reply.send(updated);
  });

  app.post<{ Params: { sessionId: string } }>("/:sessionId/restore", { preHandler: [app.authenticate] }, async (request, reply) => {
    const updated = await app.core.sessions.restore(request.params.sessionId);
    if (!updated) {
      return reply.code(404).send({ message: "session not found" });
    }
    return reply.send(updated);
  });

  app.get<{ Params: { sessionId: string }; Querystring: { q?: string } }>("/:sessionId/references", { preHandler: [app.authenticate] }, async (request, reply) => {
    const items = await app.core.sessions.listReferences(request.params.sessionId, request.query.q?.trim());
    return reply.send({ items });
  });
};
