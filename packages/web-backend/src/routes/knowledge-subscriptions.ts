import type {
  KnowledgeSubscriptionRecord,
  KnowledgeSubscriptionSource,
  KnowledgeSubscriptionSourceType,
  SqliteDatabase
} from "@okk/core";
import type { FastifyPluginAsync } from "fastify";

interface CreateSubscriptionBody {
  sourceType?: unknown;
  sourceId?: unknown;
  sourceLabel?: unknown;
  targetRepoId?: unknown;
  enabled?: unknown;
}

interface UpdateSubscriptionBody {
  sourceLabel?: unknown;
  targetRepoId?: unknown;
  enabled?: unknown;
}

const KNOWN_SOURCE_TYPES = new Set<KnowledgeSubscriptionSourceType>(["team", "project", "topic"]);

const getDatabase = (app: { core: unknown }): SqliteDatabase | null => {
  const database = (app.core as { database?: SqliteDatabase }).database;
  return database ?? null;
};

const normalizeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const normalizeBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const normalizeTitle = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();

const ensureSourceType = (value: unknown): KnowledgeSubscriptionSourceType | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim() as KnowledgeSubscriptionSourceType;
  return KNOWN_SOURCE_TYPES.has(normalized) ? normalized : null;
};

const getOwnedSubscription = (
  database: SqliteDatabase,
  actorId: string,
  subscriptionId: string
): KnowledgeSubscriptionRecord | null => {
  const item = database.knowledgeSubscriptions.getById(subscriptionId);
  if (!item || item.userId !== actorId) {
    return null;
  }
  return item;
};

const buildSourceDescriptor = (
  database: SqliteDatabase,
  sourceType: KnowledgeSubscriptionSourceType,
  sourceId: string,
  sourceLabel: string | null
): KnowledgeSubscriptionSource => {
  if (sourceType === "project") {
    const repo = database.repositories.getById(sourceId);
    return {
      type: "project",
      id: sourceId,
      label: sourceLabel ?? repo?.name ?? sourceId,
      repoId: sourceId,
      tag: null,
      metadata: repo ? { repoName: repo.name } : {}
    };
  }

  if (sourceType === "topic") {
    return {
      type: "topic",
      id: sourceId,
      label: sourceLabel ?? sourceId,
      repoId: null,
      tag: sourceId,
      metadata: {}
    };
  }

  return {
    type: "team",
    id: sourceId,
    label: sourceLabel ?? "团队知识",
    repoId: null,
    tag: null,
    metadata: {}
  };
};

export const knowledgeSubscriptionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge subscriptions not available" });
    }

    return reply.send({
      items: database.knowledgeSubscriptions.listByUserId(request.user.sub)
    });
  });

  app.post<{ Body: CreateSubscriptionBody }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "knowledge subscriptions not available" });
    }

    const sourceType = ensureSourceType(request.body?.sourceType);
    const sourceId = normalizeString(request.body?.sourceId) ?? (sourceType === "team" ? "team" : null);
    const sourceLabel = normalizeString(request.body?.sourceLabel);
    const targetRepoId = normalizeString(request.body?.targetRepoId);
    const enabled = normalizeBoolean(request.body?.enabled);

    if (!sourceType || !sourceId || !targetRepoId) {
      return reply.code(400).send({ message: "sourceType、sourceId 与 targetRepoId 必填" });
    }

    if (!database.repositories.getById(targetRepoId)) {
      return reply.code(404).send({ message: "target repo not found" });
    }
    if (sourceType === "project" && !database.repositories.getById(sourceId)) {
      return reply.code(404).send({ message: "source repo not found" });
    }

    const actorId = request.user.sub;
    const existing = database.knowledgeSubscriptions.findByUserSource(
      actorId,
      sourceType,
      sourceId,
      targetRepoId
    );
    if (existing) {
      return reply.code(409).send({ message: "订阅已存在", item: existing });
    }

    const item = database.knowledgeSubscriptions.create({
      userId: actorId,
      source: buildSourceDescriptor(database, sourceType, sourceId, sourceLabel),
      targetRepoId,
      status: enabled === false ? "paused" : "active"
    });

    return reply.code(201).send({ item });
  });

  app.patch<{ Params: { subscriptionId: string }; Body: UpdateSubscriptionBody }>(
    "/:subscriptionId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = getDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "knowledge subscriptions not available" });
      }

      const current = getOwnedSubscription(database, request.user.sub, request.params.subscriptionId);
      if (!current) {
        return reply.code(404).send({ message: "subscription not found" });
      }

      const targetRepoId = normalizeString(request.body?.targetRepoId);
      const sourceLabel = normalizeString(request.body?.sourceLabel);
      const enabled = normalizeBoolean(request.body?.enabled);

      if (targetRepoId && !database.repositories.getById(targetRepoId)) {
        return reply.code(404).send({ message: "target repo not found" });
      }

      const resolvedTargetRepoId = targetRepoId ?? current.targetRepoId;
      const duplicate = database.knowledgeSubscriptions.findByUserSource(
        request.user.sub,
        current.source.type,
        current.source.id,
        resolvedTargetRepoId
      );
      if (duplicate && duplicate.id !== current.id) {
        return reply.code(409).send({ message: "订阅已存在", item: duplicate });
      }

      const item = database.knowledgeSubscriptions.update(current.id, {
        ...(targetRepoId ? { targetRepoId } : {}),
        ...(sourceLabel ? { sourceLabel } : {}),
        ...(enabled !== null ? { status: enabled ? "active" : "paused" } : {})
      });

      return reply.send({ item });
    }
  );

  app.post<{ Params: { subscriptionId: string } }>(
    "/:subscriptionId/sync",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = getDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "knowledge subscriptions not available" });
      }

      const current = getOwnedSubscription(database, request.user.sub, request.params.subscriptionId);
      if (!current) {
        return reply.code(404).send({ message: "subscription not found" });
      }
      if (current.status !== "active") {
        return reply.code(400).send({ message: "订阅已停用，不能同步" });
      }

      const result = database.knowledgeSubscriptions.sync(current.id);
      if (!result) {
        return reply.code(500).send({ message: "subscription sync failed" });
      }

      return reply.send({ item: result.subscription, items: result.updates });
    }
  );

  app.get<{ Params: { subscriptionId: string } }>(
    "/:subscriptionId/updates",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = getDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "knowledge subscriptions not available" });
      }

      const current = getOwnedSubscription(database, request.user.sub, request.params.subscriptionId);
      if (!current) {
        return reply.code(404).send({ message: "subscription not found" });
      }

      if (!current.lastCursor && current.status === "active") {
        const initialized = database.knowledgeSubscriptions.sync(current.id);
        if (!initialized) {
          return reply.code(500).send({ message: "subscription sync failed" });
        }

        return reply.send({ item: initialized.subscription, items: initialized.updates });
      }

      return reply.send({
        item: current,
        items: database.knowledgeSubscriptions.listUpdates(current.id)
      });
    }
  );

  app.post<{ Params: { updateId: string } }>(
    "/updates/:updateId/import",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = getDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "knowledge subscriptions not available" });
      }

      const update = database.knowledgeSubscriptions.getUpdateById(request.params.updateId);
      if (!update) {
        return reply.code(404).send({ message: "subscription update not found" });
      }

      const subscription = getOwnedSubscription(database, request.user.sub, update.subscriptionId);
      if (!subscription) {
        return reply.code(404).send({ message: "subscription not found" });
      }
      if (update.consumeStatus !== "pending") {
        return reply.code(409).send({ message: "该更新已消费", item: update, subscription });
      }

      const sourceEntry = database.knowledge.getById(update.sourceEntryId);
      if (!sourceEntry) {
        return reply.code(404).send({ message: "source knowledge entry not found" });
      }

      const existing = database.knowledge
        .listByRepo(subscription.targetRepoId)
        .find((item) => normalizeTitle(item.title) === normalizeTitle(sourceEntry.title));
      if (existing) {
        const item = database.knowledgeSubscriptions.markUpdateConsumed(update.id, "duplicate", existing.id);
        return reply.send({
          item,
          entry: existing,
          subscription: database.knowledgeSubscriptions.getById(subscription.id)
        });
      }

      const entry = database.knowledge.create({
        title: sourceEntry.title,
        content: sourceEntry.content,
        summary: sourceEntry.summary,
        repoId: subscription.targetRepoId,
        category: sourceEntry.category,
        status: "published",
        tags: sourceEntry.tags,
        createdBy: request.user.sub,
        metadata: {
          ...sourceEntry.metadata,
          subscription: {
            subscriptionId: subscription.id,
            updateId: update.id,
            sourceType: subscription.source.type,
            sourceId: subscription.source.id,
            sourceLabel: subscription.source.label,
            sourceEntryId: sourceEntry.id,
            shareId: update.shareId,
            sourceUpdatedAt: update.sourceUpdatedAt
          }
        }
      });
      const item = database.knowledgeSubscriptions.markUpdateConsumed(update.id, "imported", entry.id);

      return reply.send({
        item,
        entry,
        subscription: database.knowledgeSubscriptions.getById(subscription.id)
      });
    }
  );
};
