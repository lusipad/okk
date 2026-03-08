import type { SqliteDatabase } from "@okk/core";
import type { FastifyPluginAsync } from "fastify";

interface GovernanceReviewBody {
  action?: unknown;
  targetEntryId?: unknown;
  version?: unknown;
  note?: unknown;
}

const getDatabase = (app: { core: unknown }): SqliteDatabase | null => {
  const database = (app.core as { database?: SqliteDatabase }).database;
  return database ?? null;
};

const summarize = (content: string, maxLength = 160): string => {
  const normalized = content.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
};

export const governanceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { status?: string } }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "governance not available" });
    }

    const items = database.knowledgeGovernance.list(request.query.status as never | undefined);
    return reply.send({ items });
  });

  app.post("/refresh", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "governance not available" });
    }

    const items = database.knowledgeGovernance.refresh(database.knowledge.listByRepo());
    return reply.send({ items });
  });

  app.get<{ Params: { governanceId: string } }>("/:governanceId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "governance not available" });
    }

    const item = database.knowledgeGovernance.getById(request.params.governanceId);
    if (!item) {
      return reply.code(404).send({ message: "governance not found" });
    }

    const entry = database.knowledge.getById(item.entryId);
    const versions = entry ? database.knowledge.getVersionsByEntryId(entry.id) : [];
    const conflicts = item.conflictEntryIds.map((entryId) => database.knowledge.getById(entryId)).filter(Boolean);
    const reviews = database.knowledgeGovernance.listReviews(item.id);
    return reply.send({ item, entry, versions, conflicts, reviews });
  });

  app.post<{ Params: { governanceId: string }; Body: GovernanceReviewBody }>("/:governanceId/review", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "governance not available" });
    }

    const action = typeof request.body?.action === "string" ? request.body.action : "";
    const note = typeof request.body?.note === "string" ? request.body.note.trim() : null;
    const item = database.knowledgeGovernance.getById(request.params.governanceId);
    if (!item) {
      return reply.code(404).send({ message: "governance not found" });
    }

    const entry = database.knowledge.getById(item.entryId);
    if (!entry) {
      return reply.code(404).send({ message: "knowledge entry not found" });
    }

    const actorId = request.user.sub;
    if (action === "approve") {
      if (entry.status === "draft") {
        database.knowledge.updateStatus(entry.id, "published", actorId);
      }
      const updated = database.knowledgeGovernance.markReviewed(item.id, actorId, "approve", { status: "healthy" }, note);
      return reply.send({ item: updated });
    }

    if (action === "mark_stale") {
      database.knowledge.updateStatus(entry.id, "stale", actorId);
      const updated = database.knowledgeGovernance.markReviewed(item.id, actorId, "mark_stale", { status: "stale" }, note);
      return reply.send({ item: updated });
    }

    if (action === "merge") {
      const targetEntryId = typeof request.body?.targetEntryId === "string" ? request.body.targetEntryId.trim() : "";
      const target = database.knowledge.getById(targetEntryId);
      if (!target) {
        return reply.code(400).send({ message: "targetEntryId 无效" });
      }

      const mergedContent = `${target.content}\n\n---\nMerged from ${entry.title}\n${entry.content}`.trim();
      database.knowledge.update(target.id, {
        content: mergedContent,
        summary: summarize(mergedContent),
        editedBy: actorId,
        changeSummary: `merge:${entry.id}`
      });
      database.knowledge.updateStatus(entry.id, "archived", actorId);
      const updated = database.knowledgeGovernance.markReviewed(item.id, actorId, "merge", { status: "merged", mergedIntoEntryId: target.id }, note, { targetEntryId: target.id });
      return reply.send({ item: updated });
    }

    if (action === "rollback") {
      const version = typeof request.body?.version === "number" ? request.body.version : Number(request.body?.version);
      const targetVersion = database.knowledge.getVersionsByEntryId(entry.id).find((candidate) => candidate.version === version);
      if (!targetVersion) {
        return reply.code(400).send({ message: "version 无效" });
      }

      database.knowledge.update(entry.id, {
        title: targetVersion.title,
        content: targetVersion.content,
        summary: targetVersion.summary,
        category: targetVersion.category,
        editedBy: actorId,
        changeSummary: `rollback:${version}`
      });
      const updated = database.knowledgeGovernance.markReviewed(item.id, actorId, "rollback", { status: "rolled_back", rollbackVersion: version }, note, { version });
      return reply.send({ item: updated });
    }

    return reply.code(400).send({ message: "不支持的治理动作" });
  });
};
