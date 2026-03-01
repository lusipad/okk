import type { FastifyPluginAsync } from "fastify";

interface CreateRepoBody {
  name: string;
  path: string;
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
};
