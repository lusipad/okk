import type { SqliteDatabase } from "@okk/core";
import type { FastifyPluginAsync } from "fastify";

interface PreviewBody {
  name?: unknown;
  sourceTypes?: unknown;
  repoIds?: unknown;
}

const getDatabase = (app: { core: unknown }): SqliteDatabase | null => {
  const database = (app.core as { database?: SqliteDatabase }).database;
  return database ?? null;
};

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, " ");
const normalizeString = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);
const normalizeStringArray = (value: unknown): string[] => Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))) : [];
const summarize = (content: string, maxLength = 160): string => {
  const normalized = normalizeText(content);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
};

export const knowledgeImportsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge imports not available" });
    }

    return reply.send({ items: database.knowledgeImports.listBatches() });
  });

  app.get<{ Params: { batchId: string } }>("/:batchId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge imports not available" });
    }

    const item = database.knowledgeImports.getBatch(request.params.batchId);
    if (!item) {
      return reply.code(404).send({ message: "batch not found" });
    }

    return reply.send({ item, items: database.knowledgeImports.listItems(item.id) });
  });

  app.post<{ Body: PreviewBody }>("/preview", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge imports not available" });
    }

    const sourceTypes = normalizeStringArray(request.body?.sourceTypes);
    const resolvedSourceTypes = sourceTypes.length > 0 ? sourceTypes : ["memory", "sessions", "knowledge"];
    const repoIds = normalizeStringArray(request.body?.repoIds);
    const repoFilter = repoIds.length > 0 ? new Set(repoIds) : null;
    const name = normalizeString(request.body?.name) ?? `导入批次 ${new Date().toISOString()}`;
    const batch = database.knowledgeImports.createBatch({
      name,
      sourceTypes: resolvedSourceTypes,
      sourceSummary: `来源: ${resolvedSourceTypes.join(", ")}`
    });

    const adminUserId = request.user.sub;
    const items: Array<{
      batchId: string;
      title: string;
      summary: string;
      content: string;
      repoId?: string | null;
      sourceType: string;
      sourceRef?: string | null;
      dedupeKey: string;
      evidence: Record<string, unknown>;
    }> = [];

    if (resolvedSourceTypes.includes("memory")) {
      const memories = database.memory.list({ userId: adminUserId, limit: 30 });
      for (const memory of memories) {
        if (repoFilter && memory.repoId && !repoFilter.has(memory.repoId)) {
          continue;
        }
        items.push({
          batchId: batch.id,
          title: memory.title,
          summary: memory.summary,
          content: memory.content,
          repoId: memory.repoId,
          sourceType: "memory",
          sourceRef: memory.id,
          dedupeKey: `${memory.repoId ?? 'global'}:${normalizeText(memory.title).toLowerCase()}`,
          evidence: { confidence: memory.confidence, memoryType: memory.memoryType, sourceKind: memory.sourceKind }
        });
      }
    }

    if (resolvedSourceTypes.includes("sessions")) {
      const sessions = database.sessions.listByUserId(adminUserId, { limit: 20 });
      for (const session of sessions) {
        if (repoFilter && !repoFilter.has(session.repoId)) {
          continue;
        }
        const lastAssistant = database.messages.listBySessionId(session.id).filter((message) => message.role === "assistant").at(-1);
        if (!lastAssistant) {
          continue;
        }
        items.push({
          batchId: batch.id,
          title: session.title || "会话摘要",
          summary: summarize(lastAssistant.content),
          content: lastAssistant.content,
          repoId: session.repoId,
          sourceType: "session",
          sourceRef: session.id,
          dedupeKey: `${session.repoId}:session:${normalizeText(session.title || session.id).toLowerCase()}`,
          evidence: { sessionId: session.id, updatedAt: session.updatedAt }
        });
      }
    }

    if (resolvedSourceTypes.includes("knowledge")) {
      const repositories = repoFilter ? Array.from(repoFilter) : database.repositories.list().map((repo) => repo.id);
      for (const repoId of repositories) {
        for (const entry of database.knowledge.listByRepo(repoId).slice(0, 20)) {
          items.push({
            batchId: batch.id,
            title: entry.title,
            summary: entry.summary,
            content: entry.content,
            repoId,
            sourceType: "knowledge",
            sourceRef: entry.id,
            dedupeKey: `${repoId}:${normalizeText(entry.title).toLowerCase()}`,
            evidence: { version: entry.version, status: entry.status, tags: entry.tags }
          });
        }
      }
    }

    const uniqueItems = Array.from(new Map(items.map((item) => [item.dedupeKey, item])).values());
    const storedItems = database.knowledgeImports.addItems(uniqueItems);
    return reply.code(201).send({ item: database.knowledgeImports.getBatch(batch.id), items: storedItems });
  });

  app.post<{ Params: { batchId: string } }>("/:batchId/confirm", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge imports not available" });
    }

    const batch = database.knowledgeImports.getBatch(request.params.batchId);
    if (!batch) {
      return reply.code(404).send({ message: "batch not found" });
    }

    database.knowledgeImports.updateBatchStatus(batch.id, "confirmed");
    const actorId = request.user.sub;
    const results = database.knowledgeImports.listItems(batch.id).map((item) => {
      const existing = item.repoId
        ? database.knowledge.listByRepo(item.repoId).find((entry) => normalizeText(entry.title).toLowerCase() === normalizeText(item.title).toLowerCase())
        : null;
      if (existing) {
        database.knowledgeImports.updateItemStatus(item.id, "duplicate", existing.id);
        return { itemId: item.id, status: "duplicate", entryId: existing.id };
      }

      const repoId = item.repoId ?? database.repositories.list()[0]?.id;
      if (!repoId) {
        database.knowledgeImports.updateItemStatus(item.id, "skipped");
        return { itemId: item.id, status: "skipped" };
      }

      const created = database.knowledge.create({
        title: item.title,
        content: item.content,
        summary: item.summary,
        repoId,
        category: item.sourceType,
        status: "published",
        tags: [item.sourceType, "imported"],
        createdBy: actorId,
        metadata: { sourceRef: item.sourceRef, importBatchId: batch.id, evidence: item.evidence }
      });
      database.knowledgeImports.updateItemStatus(item.id, "imported", created.id);
      return { itemId: item.id, status: "imported", entryId: created.id };
    });

    const item = database.knowledgeImports.updateBatchStatus(batch.id, "completed");
    return reply.send({ item, results, items: database.knowledgeImports.listItems(batch.id) });
  });

  app.post<{ Params: { batchId: string } }>("/:batchId/replay", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge imports not available" });
    }

    const batch = database.knowledgeImports.getBatch(request.params.batchId);
    if (!batch) {
      return reply.code(404).send({ message: "batch not found" });
    }

    const replay = database.knowledgeImports.createBatch({
      name: `${batch.name}（回放）`,
      sourceTypes: batch.sourceTypes,
      sourceSummary: `${batch.sourceSummary} / replay`
    });
    const clonedItems = database.knowledgeImports.listItems(batch.id).map((item) => ({
      batchId: replay.id,
      title: item.title,
      summary: item.summary,
      content: item.content,
      repoId: item.repoId,
      sourceType: item.sourceType,
      sourceRef: item.sourceRef,
      dedupeKey: item.dedupeKey,
      evidence: item.evidence,
      status: "pending" as const
    }));
    database.knowledgeImports.addItems(clonedItems);
    return reply.code(201).send({ item: replay, items: database.knowledgeImports.listItems(replay.id) });
  });
};
