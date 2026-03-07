import type { FastifyPluginAsync } from "fastify";

interface ListMemoryQuery {
  repoId?: string;
  memoryType?: "preference" | "project" | "relationship" | "process" | "event";
  status?: "active" | "stale" | "archived";
}

interface UpsertMemoryBody {
  repoId?: string | null;
  memoryType?: "preference" | "project" | "relationship" | "process" | "event";
  title?: string;
  content?: string;
  summary?: string;
  confidence?: number;
  status?: "active" | "stale" | "archived";
}

interface SyncMemoryBody {
  repoId?: string;
}

export const memoryRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ListMemoryQuery }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const items = await app.core.memory.list({
      ...(typeof request.query.repoId === "string" && request.query.repoId.trim().length > 0 ? { repoId: request.query.repoId.trim() } : {}),
      ...(request.query.memoryType ? { memoryType: request.query.memoryType } : {}),
      ...(request.query.status ? { status: request.query.status } : {})
    });
    return reply.send({ items });
  });

  app.post<{ Body: UpsertMemoryBody }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body ?? {};
    if (!body.memoryType || !body.title || !body.content || !body.summary) {
      return reply.code(400).send({ message: "memoryType/title/content/summary 必填" });
    }

    const item = await app.core.memory.upsert({
      userId: "u-admin",
      repoId: body.repoId ?? null,
      memoryType: body.memoryType,
      title: body.title,
      content: body.content,
      summary: body.summary,
      confidence: typeof body.confidence === "number" ? body.confidence : 0.6,
      status: body.status ?? "active",
      sourceKind: "manual",
      sourceRef: null,
      metadata: {}
    });
    return reply.code(201).send({ item });
  });

  app.patch<{ Params: { memoryId: string }; Body: Partial<Pick<UpsertMemoryBody, "title" | "content" | "summary" | "confidence" | "status">> }>("/:memoryId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const updated = await app.core.memory.update(request.params.memoryId, request.body ?? {});
    if (!updated) {
      return reply.code(404).send({ message: "memory not found" });
    }
    return reply.send({ item: updated });
  });

  app.post<{ Body: SyncMemoryBody }>("/sync", { preHandler: [app.authenticate] }, async (request, reply) => {
    const repoId = request.body?.repoId?.trim();
    if (!repoId) {
      return reply.code(400).send({ message: "repoId 必填" });
    }

    const result = await app.core.memory.syncRepo(repoId);
    return reply.send(result);
  });
};
