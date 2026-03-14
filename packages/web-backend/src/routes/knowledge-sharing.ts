import type {
  KnowledgeShareRecord,
  KnowledgeShareReview,
  KnowledgeShareReviewStatus,
  KnowledgeShareVisibility,
  SqliteDatabase
} from "@okk/core";
import type { FastifyPluginAsync } from "fastify";

interface KnowledgeShareRequestBody {
  entryId?: unknown;
  visibility?: unknown;
  note?: unknown;
}

interface KnowledgeShareReviewBody {
  action?: unknown;
  note?: unknown;
}

interface KnowledgeShareListQuery {
  status?: unknown;
  repoId?: unknown;
  category?: unknown;
  tags?: unknown;
  query?: unknown;
  authorId?: unknown;
}

const ACTIVE_STATUSES = new Set<KnowledgeShareReviewStatus>(["pending_review", "approved", "published"]);
const REVIEWABLE_ACTIONS = new Set(["approve", "publish", "reject", "request_changes", "rollback"]);
const KNOWN_STATUSES = new Set<KnowledgeShareReviewStatus>([
  "pending_review",
  "approved",
  "published",
  "rejected",
  "changes_requested"
]);
const KNOWN_VISIBILITIES = new Set<KnowledgeShareVisibility>(["workspace", "team"]);

const getDatabase = (app: { core: unknown }): SqliteDatabase | null => {
  const database = (app.core as { database?: SqliteDatabase }).database;
  return database ?? null;
};

const normalizeString = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value) && typeof value !== "string") {
    return [];
  }

  const source = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      source
        .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};

const mergeSharingMetadata = (
  metadata: Record<string, unknown>,
  share: KnowledgeShareRecord
): Record<string, unknown> => ({
  ...metadata,
  sharing: {
    shareId: share.id,
    visibility: share.visibility,
    reviewStatus: share.reviewStatus,
    requestedBy: share.requestedBy,
    reviewedBy: share.reviewedBy,
    requestNote: share.requestNote,
    reviewNote: share.reviewNote,
    publishedAt: share.publishedAt,
    updatedAt: share.updatedAt
  }
});

const syncKnowledgeSharingMetadata = (
  database: SqliteDatabase,
  share: KnowledgeShareRecord,
  actorId: string,
  changeSummary: string
): void => {
  const entry = database.knowledge.getById(share.entryId);
  if (!entry) {
    throw new Error("knowledge entry not found");
  }

  database.knowledge.update(share.entryId, {
    metadata: mergeSharingMetadata(entry.metadata, share),
    editedBy: actorId,
    changeSummary
  });
};

const ensureShareStatus = (value: unknown): KnowledgeShareReviewStatus | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim() as KnowledgeShareReviewStatus;
  return KNOWN_STATUSES.has(normalized) ? normalized : null;
};

const ensureShareVisibility = (value: unknown): KnowledgeShareVisibility | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim() as KnowledgeShareVisibility;
  return KNOWN_VISIBILITIES.has(normalized) ? normalized : null;
};

const canReview = (status: KnowledgeShareReviewStatus, action: string): boolean => {
  if (action === "approve") {
    return status === "pending_review" || status === "changes_requested";
  }
  if (action === "publish") {
    return status === "approved";
  }
  if (action === "reject") {
    return status === "pending_review" || status === "approved" || status === "changes_requested";
  }
  if (action === "request_changes") {
    return status === "pending_review" || status === "approved";
  }
  if (action === "rollback") {
    return status === "published";
  }
  return false;
};

export const knowledgeSharingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: KnowledgeShareListQuery }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge sharing not available" });
    }

    const status = ensureShareStatus(request.query.status);
    if (request.query.status && !status) {
      return reply.code(400).send({ message: "status 非法" });
    }

    return reply.send({
      items: database.knowledgeSharing.list({
        ...(status ? { statuses: [status] } : {}),
        repoId: normalizeString(request.query.repoId) ?? undefined,
        category: normalizeString(request.query.category) ?? undefined,
        authorId: normalizeString(request.query.authorId) ?? undefined,
        query: normalizeString(request.query.query) ?? undefined,
        tags: normalizeTags(request.query.tags)
      })
    });
  });

  app.get("/overview", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge sharing not available" });
    }

    return reply.send(database.knowledgeSharing.getOverview());
  });

  app.get<{ Querystring: KnowledgeShareListQuery }>("/team", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge sharing not available" });
    }

    return reply.send({
      items: database.knowledgeSharing.list({
        statuses: ["published"],
        repoId: normalizeString(request.query.repoId) ?? undefined,
        category: normalizeString(request.query.category) ?? undefined,
        authorId: normalizeString(request.query.authorId) ?? undefined,
        query: normalizeString(request.query.query) ?? undefined,
        tags: normalizeTags(request.query.tags)
      })
    });
  });

  app.get<{ Params: { entryId: string } }>("/entry/:entryId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge sharing not available" });
    }

    const item = database.knowledgeSharing.getByEntryId(request.params.entryId);
    if (!item) {
      return reply.send({ item: null, reviews: [] });
    }

    return reply.send({
      item,
      reviews: database.knowledgeSharing.listReviews(item.id)
    });
  });

  app.get<{ Params: { shareId: string } }>("/:shareId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge sharing not available" });
    }

    const item = database.knowledgeSharing.getById(request.params.shareId);
    if (!item) {
      return reply.code(404).send({ message: "share not found" });
    }

    return reply.send({
      item,
      reviews: database.knowledgeSharing.listReviews(item.id)
    });
  });

  app.post<{ Body: KnowledgeShareRequestBody }>("/request", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge sharing not available" });
    }

    const entryId = normalizeString(request.body?.entryId);
    const visibility = ensureShareVisibility(request.body?.visibility);
    const note = normalizeString(request.body?.note);
    if (!entryId || !visibility) {
      return reply.code(400).send({ message: "entryId 与 visibility 必填" });
    }

    const entry = database.knowledge.getById(entryId);
    if (!entry) {
      return reply.code(404).send({ message: "knowledge entry not found" });
    }
    if (entry.status === "archived") {
      return reply.code(400).send({ message: "已归档知识不能发起共享" });
    }

    const actorId = request.user.sub;
    const existing = database.knowledgeSharing.getByEntryId(entryId);
    if (existing && ACTIVE_STATUSES.has(existing.reviewStatus)) {
      return reply.code(409).send({
        message: "已存在未终结的共享请求",
        item: existing
      });
    }

    const item = existing
      ? database.knowledgeSharing.update(existing.id, {
          visibility,
          reviewStatus: "pending_review",
          requestedBy: actorId,
          reviewedBy: null,
          requestNote: note,
          reviewNote: null,
          publishedAt: null
        })
      : database.knowledgeSharing.create({
          entryId,
          visibility,
          reviewStatus: "pending_review",
          requestedBy: actorId,
          requestNote: note
        });

    if (!item) {
      return reply.code(500).send({ message: "创建共享请求失败" });
    }

    database.knowledgeSharing.appendReview({
      shareId: item.id,
      action: "submit",
      note,
      createdBy: actorId
    });
    syncKnowledgeSharingMetadata(database, item, actorId, "knowledge-share:submit");

    return reply.code(existing ? 200 : 201).send({ item });
  });

  app.post<{ Params: { shareId: string }; Body: KnowledgeShareReviewBody }>(
    "/:shareId/review",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = getDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "knowledge sharing not available" });
      }

      const action = normalizeString(request.body?.action);
      const note = normalizeString(request.body?.note);
      if (!action || !REVIEWABLE_ACTIONS.has(action)) {
        return reply.code(400).send({ message: "不支持的审核动作" });
      }
      if ((action === "reject" || action === "request_changes") && !note) {
        return reply.code(400).send({ message: "该动作需要审核备注" });
      }

      const current = database.knowledgeSharing.getById(request.params.shareId);
      if (!current) {
        return reply.code(404).send({ message: "share not found" });
      }
      if (!canReview(current.reviewStatus, action)) {
        return reply.code(400).send({ message: "当前状态不允许执行该动作" });
      }

      const actorId = request.user.sub;
      const nextStatus: KnowledgeShareReviewStatus =
        action === "approve"
          ? "approved"
          : action === "publish"
            ? "published"
            : action === "reject"
              ? "rejected"
              : action === "request_changes"
                ? "changes_requested"
                : "approved";

      const item = database.knowledgeSharing.update(current.id, {
        reviewStatus: nextStatus,
        reviewedBy: actorId,
        reviewNote: note ?? current.reviewNote,
        publishedAt: action === "publish" ? new Date().toISOString() : action === "rollback" ? null : current.publishedAt
      });

      if (!item) {
        return reply.code(500).send({ message: "更新共享请求失败" });
      }

      database.knowledgeSharing.appendReview({
        shareId: item.id,
        action: action as KnowledgeShareReview["action"],
        note,
        createdBy: actorId
      });
      syncKnowledgeSharingMetadata(database, item, actorId, `knowledge-share:${action}`);

      return reply.send({ item });
    }
  );
};
