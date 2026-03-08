import type { SqliteDatabase } from "@okk/core";
import type { FastifyPluginAsync } from "fastify";

interface MemoryShareRequestBody {
  memoryId?: unknown;
  visibility?: unknown;
}

interface MemoryShareReviewBody {
  action?: unknown;
  note?: unknown;
}

const getDatabase = (app: { core: unknown }): SqliteDatabase | null => {
  const database = (app.core as { database?: SqliteDatabase }).database;
  return database ?? null;
};

const normalizeString = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);
const summarize = (content: string, maxLength = 160): string => {
  const normalized = content.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
};

const containsSensitiveContent = (content: string): boolean => /api[_-]?key|token|secret|password|ssh-rsa/i.test(content);

export const memorySharingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "memory sharing not available" });
    }
    return reply.send({ items: database.memorySharing.list() });
  });

  app.get("/overview", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "memory sharing not available" });
    }

    const shares = database.memorySharing.list();
    const recommendations = database.memory
      .list({ userId: request.user.sub, limit: 50 })
      .filter((memory) => memory.confidence >= 0.6 && !containsSensitiveContent(memory.content))
      .filter((memory) => !database.memorySharing.getByMemoryId(memory.id))
      .slice(0, 10)
      .map((memory) => ({
        memoryId: memory.id,
        title: memory.title,
        summary: memory.summary,
        confidence: memory.confidence,
        repoId: memory.repoId
      }));

    return reply.send({
      summary: {
        total: shares.length,
        pending: shares.filter((item) => item.reviewStatus === "pending").length,
        approved: shares.filter((item) => item.reviewStatus === "approved").length,
        published: shares.filter((item) => item.reviewStatus === "published").length,
        rejected: shares.filter((item) => item.reviewStatus === "rejected").length
      },
      recommendations
    });
  });

  app.get<{ Params: { shareId: string } }>("/:shareId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "memory sharing not available" });
    }

    const item = database.memorySharing.getById(request.params.shareId);
    if (!item) {
      return reply.code(404).send({ message: "share not found" });
    }

    return reply.send({ item, reviews: database.memorySharing.listReviews(item.id) });
  });

  app.post<{ Body: MemoryShareRequestBody }>("/request", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "memory sharing not available" });
    }

    const memoryId = normalizeString(request.body?.memoryId);
    const visibility = normalizeString(request.body?.visibility) as "private" | "workspace" | "team" | null;
    if (!memoryId || !visibility) {
      return reply.code(400).send({ message: "memoryId 与 visibility 必填" });
    }

    const memory = database.memory.getById(memoryId);
    if (!memory) {
      return reply.code(404).send({ message: "memory not found" });
    }

    const sensitive = containsSensitiveContent(memory.content);
    const item = database.memorySharing.upsert({
      memoryId: memory.id,
      visibility,
      reviewStatus: sensitive ? "rejected" : "pending",
      requestedBy: request.user.sub,
      rejectionReason: sensitive ? "检测到疑似敏感信息，已拦截共享" : null,
      recommendationScore: Number(memory.confidence.toFixed(2)),
      memoryTitle: memory.title,
      memorySummary: memory.summary,
      repoId: memory.repoId
    });

    database.memorySharing.appendReview({
      shareId: item.id,
      action: "submit",
      note: sensitive ? "敏感信息拦截" : "提交共享审核",
      createdBy: request.user.sub
    });

    return reply.code(201).send({ item });
  });

  app.post<{ Params: { shareId: string }; Body: MemoryShareReviewBody }>("/:shareId/review", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "memory sharing not available" });
    }

    const action = normalizeString(request.body?.action);
    const note = normalizeString(request.body?.note);
    const share = database.memorySharing.getById(request.params.shareId);
    if (!share) {
      return reply.code(404).send({ message: "share not found" });
    }

    const actorId = request.user.sub;
    if (action === "approve") {
      const item = database.memorySharing.upsert({
        memoryId: share.memoryId,
        knowledgeEntryId: share.knowledgeEntryId,
        visibility: share.visibility,
        reviewStatus: "approved",
        requestedBy: share.requestedBy,
        reviewedBy: actorId,
        approvalNote: note,
        recommendationScore: share.recommendationScore,
        memoryTitle: share.memoryTitle,
        memorySummary: share.memorySummary,
        repoId: share.repoId,
        publishedAt: share.publishedAt
      });
      database.memorySharing.appendReview({ shareId: item.id, action: "approve", note, createdBy: actorId });
      return reply.send({ item });
    }

    if (action === "reject") {
      const item = database.memorySharing.upsert({
        memoryId: share.memoryId,
        knowledgeEntryId: share.knowledgeEntryId,
        visibility: share.visibility,
        reviewStatus: "rejected",
        requestedBy: share.requestedBy,
        reviewedBy: actorId,
        rejectionReason: note ?? "审核驳回",
        recommendationScore: share.recommendationScore,
        memoryTitle: share.memoryTitle,
        memorySummary: share.memorySummary,
        repoId: share.repoId,
        publishedAt: share.publishedAt
      });
      database.memorySharing.appendReview({ shareId: item.id, action: "reject", note, createdBy: actorId });
      return reply.send({ item });
    }

    if (action === "publish") {
      const memory = database.memory.getById(share.memoryId);
      if (!memory) {
        return reply.code(404).send({ message: "memory not found" });
      }
      const repoId = share.repoId ?? database.repositories.list()[0]?.id;
      if (!repoId) {
        return reply.code(400).send({ message: "缺少可发布仓库" });
      }
      const knowledgeEntryId = share.knowledgeEntryId ?? database.knowledge.create({
        title: share.memoryTitle,
        content: memory.content,
        summary: summarize(memory.content),
        repoId,
        category: "memory-sharing",
        status: "published",
        tags: ["memory", "shared", share.visibility],
        createdBy: actorId,
        metadata: { memoryId: share.memoryId, visibility: share.visibility }
      }).id;
      const item = database.memorySharing.upsert({
        memoryId: share.memoryId,
        knowledgeEntryId,
        visibility: share.visibility,
        reviewStatus: "published",
        requestedBy: share.requestedBy,
        reviewedBy: actorId,
        approvalNote: note ?? share.approvalNote,
        recommendationScore: share.recommendationScore,
        memoryTitle: share.memoryTitle,
        memorySummary: share.memorySummary,
        repoId,
        publishedAt: new Date().toISOString()
      });
      database.memorySharing.appendReview({ shareId: item.id, action: "publish", note, createdBy: actorId });
      return reply.send({ item });
    }

    if (action === "rollback") {
      if (share.knowledgeEntryId) {
        database.knowledge.updateStatus(share.knowledgeEntryId, "archived", actorId);
      }
      const item = database.memorySharing.upsert({
        memoryId: share.memoryId,
        knowledgeEntryId: share.knowledgeEntryId,
        visibility: share.visibility,
        reviewStatus: "approved",
        requestedBy: share.requestedBy,
        reviewedBy: actorId,
        approvalNote: note ?? share.approvalNote,
        recommendationScore: share.recommendationScore,
        memoryTitle: share.memoryTitle,
        memorySummary: share.memorySummary,
        repoId: share.repoId,
        publishedAt: null
      });
      database.memorySharing.appendReview({ shareId: item.id, action: "rollback", note, createdBy: actorId });
      return reply.send({ item });
    }

    return reply.code(400).send({ message: "不支持的审核动作" });
  });
};
