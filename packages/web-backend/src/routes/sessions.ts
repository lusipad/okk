import type { FastifyInstance, FastifyPluginAsync } from "fastify";

interface CreateSessionBody {
  title?: string;
  repoId?: string;
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
  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const sessions = await app.core.sessions.list();
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
};