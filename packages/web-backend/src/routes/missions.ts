import type { FastifyInstance, FastifyPluginAsync } from "fastify";

interface CreateMissionBody {
  title?: unknown;
  goal?: unknown;
  repoId?: unknown;
  sessionId?: unknown;
  workspaceId?: unknown;
  ownerPartnerId?: unknown;
}

interface ListMissionsQuery {
  status?: string;
  repoId?: string;
  sessionId?: string;
  summaries?: string;
}

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

async function resolveRepoId(app: FastifyInstance, requestedRepoId?: string | null): Promise<string | null> {
  if (requestedRepoId && requestedRepoId.trim().length > 0) {
    return requestedRepoId;
  }

  const repos = await app.core.repos.list();
  if (repos.length > 0) {
    return repos[0].id;
  }

  const created = await app.core.repos.create({
    name: "默认仓库",
    path: process.cwd()
  });
  return created.id;
}

export const missionsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ListMissionsQuery }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = {
      ...(request.query.status ? { status: request.query.status as never } : {}),
      ...(request.query.repoId ? { repoId: request.query.repoId } : {}),
      ...(request.query.sessionId ? { sessionId: request.query.sessionId } : {})
    };
    if (request.query.summaries === "true") {
      return reply.send({ items: await app.core.missions.listSummaries(input) });
    }
    return reply.send({ items: await app.core.missions.list(input) });
  });

  app.post<{ Body: CreateMissionBody }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body ?? {};
    const title = normalizeString(body.title);
    const goal = normalizeString(body.goal);
    if (!title || !goal) {
      return reply.code(400).send({ message: "title 和 goal 必填" });
    }
    const repoId = await resolveRepoId(app, normalizeString(body.repoId));
    const item = await app.core.missions.create({
      title,
      goal,
      repoId,
      sessionId: normalizeString(body.sessionId),
      workspaceId: normalizeString(body.workspaceId),
      ownerPartnerId: normalizeString(body.ownerPartnerId)
    });
    return reply.code(201).send({ item });
  });

  app.get<{ Params: { missionId: string } }>("/:missionId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const item = await app.core.missions.get(request.params.missionId);
    if (!item) {
      return reply.code(404).send({ message: "mission not found" });
    }
    return reply.send({ item });
  });

  app.get<{ Params: { missionId: string } }>("/:missionId/workstreams", { preHandler: [app.authenticate] }, async (request, reply) => {
    return reply.send({ items: await app.core.missions.listWorkstreams(request.params.missionId) });
  });

  app.get<{ Params: { missionId: string } }>("/:missionId/checkpoints", { preHandler: [app.authenticate] }, async (request, reply) => {
    return reply.send({ items: await app.core.missions.listCheckpoints(request.params.missionId) });
  });

  app.post<{ Params: { missionId: string; checkpointId: string } }>(
    "/:missionId/checkpoints/:checkpointId/resolve",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const current = await app.core.missions.get(request.params.missionId);
      if (!current) {
        return reply.code(404).send({ message: "mission not found" });
      }
      const item = await app.core.missions.resolveCheckpoint(request.params.checkpointId);
      if (!item) {
        return reply.code(404).send({ message: "checkpoint not found" });
      }
      return reply.send({ item });
    }
  );

  app.get<{ Params: { missionId: string } }>("/:missionId/handoffs", { preHandler: [app.authenticate] }, async (request, reply) => {
    return reply.send({ items: await app.core.missions.listHandoffs(request.params.missionId) });
  });
};
