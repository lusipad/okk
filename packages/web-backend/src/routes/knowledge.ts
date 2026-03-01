import type { FastifyInstance, FastifyPluginAsync } from "fastify";

type KnowledgeStatus = "draft" | "published" | "stale" | "archived";

interface KnowledgeDaoLike {
  list(input?: {
    repoId?: string;
    category?: string;
    status?: KnowledgeStatus;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): unknown[];
  search(input?: {
    keyword?: string;
    repoId?: string;
    category?: string;
    status?: KnowledgeStatus;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): unknown[];
  getById(id: string): unknown | null;
  getVersionsByEntryId(entryId: string): unknown[];
  create(input: {
    title: string;
    content: string;
    summary: string;
    repoId: string;
    category?: string;
    sourceSessionId?: string | null;
    qualityScore?: number;
    status?: KnowledgeStatus;
    metadata?: Record<string, unknown>;
    tags?: string[];
    createdBy: string;
  }): unknown;
  update(
    id: string,
    input: {
      title?: string;
      content?: string;
      summary?: string;
      category?: string;
      sourceSessionId?: string | null;
      qualityScore?: number;
      status?: KnowledgeStatus;
      metadata?: Record<string, unknown>;
      tags?: string[];
      changeSummary?: string | null;
      editedBy: string;
    }
  ): unknown | null;
  updateStatus(id: string, status: KnowledgeStatus, editedBy?: string): unknown | null;
  delete(id: string): boolean;
}

interface AppDatabaseLike {
  repositories: {
    list(): Array<{ id: string }>;
  };
  knowledge: KnowledgeDaoLike;
}

interface KnowledgeListQuery {
  q?: string;
  repoId?: string;
  category?: string;
  status?: string;
  tags?: string | string[];
  limit?: string;
  offset?: string;
}

interface CreateKnowledgeBody {
  title?: string;
  content?: string;
  summary?: string;
  repoId?: string;
  category?: string;
  sourceSessionId?: string | null;
  qualityScore?: number;
  status?: KnowledgeStatus;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

interface UpdateKnowledgeBody {
  title?: string;
  content?: string;
  summary?: string;
  category?: string;
  sourceSessionId?: string | null;
  qualityScore?: number;
  status?: KnowledgeStatus;
  metadata?: Record<string, unknown>;
  tags?: string[];
  changeSummary?: string | null;
}

interface UpdateKnowledgeStatusBody {
  status?: KnowledgeStatus;
}

const KNOWN_STATUS = new Set<KnowledgeStatus>(["draft", "published", "stale", "archived"]);

const toTags = (input: string | string[] | undefined): string[] => {
  if (!input) {
    return [];
  }

  const source = Array.isArray(input) ? input : [input];
  return Array.from(
    new Set(
      source
        .flatMap((item) => item.split(","))
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};

const parseOptionalNumber = (input?: string): number | undefined => {
  if (!input?.trim()) {
    return undefined;
  }
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const summarizeContent = (content: string): string => {
  const trimmed = content.trim();
  if (trimmed.length <= 180) {
    return trimmed;
  }
  return `${trimmed.slice(0, 177)}...`;
};

const resolveDatabase = (app: FastifyInstance): AppDatabaseLike | null => {
  const database = app.core.database;
  if (!database || typeof database !== "object") {
    return null;
  }

  const candidate = database as Partial<AppDatabaseLike>;
  if (!candidate.knowledge || !candidate.repositories) {
    return null;
  }

  return candidate as AppDatabaseLike;
};

const resolveStatus = (status: string | undefined): KnowledgeStatus | undefined => {
  if (!status?.trim()) {
    return undefined;
  }

  const normalized = status.trim() as KnowledgeStatus;
  return KNOWN_STATUS.has(normalized) ? normalized : undefined;
};

const resolveCurrentUserId = (rawUser: unknown): string => {
  if (
    rawUser &&
    typeof rawUser === "object" &&
    "sub" in rawUser &&
    typeof (rawUser as { sub?: unknown }).sub === "string" &&
    (rawUser as { sub: string }).sub.trim().length > 0
  ) {
    return (rawUser as { sub: string }).sub;
  }

  return "u-admin";
};

const resolveRepoId = async (app: FastifyInstance, requestedRepoId?: string): Promise<string> => {
  if (requestedRepoId?.trim()) {
    return requestedRepoId.trim();
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
};

export const knowledgeRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: KnowledgeListQuery }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = resolveDatabase(app);
    const status = resolveStatus(request.query.status);
    if (request.query.status && !status) {
      return reply.code(400).send({ message: "status 非法" });
    }

    if (database) {
      const query = {
        repoId: request.query.repoId?.trim() || undefined,
        category: request.query.category?.trim() || undefined,
        status,
        tags: toTags(request.query.tags),
        limit: parseOptionalNumber(request.query.limit),
        offset: parseOptionalNumber(request.query.offset)
      };

      if (request.query.q?.trim()) {
        return reply.send({
          items: database.knowledge.search({
            ...query,
            keyword: request.query.q.trim()
          })
        });
      }

      return reply.send({ items: database.knowledge.list(query) });
    }

    if (request.query.q || request.query.repoId || request.query.limit || request.query.offset) {
      return reply.code(501).send({ message: "当前运行模式不支持知识搜索与高级过滤" });
    }

    let items = await app.core.knowledge.list();
    const tags = toTags(request.query.tags);
    if (request.query.category?.trim()) {
      items = items.filter((item) => item.category === request.query.category?.trim());
    }
    if (status) {
      items = items.filter((item) => item.status === status);
    }
    if (tags.length > 0) {
      items = items.filter((item) => tags.every((tag) => item.tags.includes(tag)));
    }

    return reply.send({ items });
  });

  app.get<{ Params: { id: string } }>("/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = resolveDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "当前运行模式不支持知识详情接口" });
    }

    const item = database.knowledge.getById(request.params.id);
    if (!item) {
      return reply.code(404).send({ message: "知识条目不存在" });
    }
    return reply.send({ item });
  });

  app.get<{ Params: { id: string } }>(
    "/:id/versions",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = resolveDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "当前运行模式不支持知识版本接口" });
      }

      if (!database.knowledge.getById(request.params.id)) {
        return reply.code(404).send({ message: "知识条目不存在" });
      }

      return reply.send({
        items: database.knowledge.getVersionsByEntryId(request.params.id)
      });
    }
  );

  app.post<{ Body: CreateKnowledgeBody }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const input = request.body ?? {};
    const title = input.title?.trim();
    const content = input.content;

    if (!title || !content?.trim()) {
      return reply.code(400).send({ message: "title 和 content 必填" });
    }

    if (input.status && !KNOWN_STATUS.has(input.status)) {
      return reply.code(400).send({ message: "status 非法" });
    }

    const database = resolveDatabase(app);
    if (database) {
      const created = database.knowledge.create({
        title,
        content,
        summary: input.summary?.trim() || summarizeContent(content),
        repoId: await resolveRepoId(app, input.repoId),
        category: input.category?.trim(),
        sourceSessionId: input.sourceSessionId,
        qualityScore: input.qualityScore,
        status: input.status ?? "draft",
        metadata: input.metadata ?? {},
        tags: input.tags ?? [],
        createdBy: resolveCurrentUserId(request.user)
      });

      return reply.code(201).send(created);
    }

    const created = await app.core.knowledge.create({
      title,
      content,
      tags: input.tags ?? [],
      category: input.category?.trim() || "general",
      status: input.status ?? "draft"
    });
    return reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string }; Body: UpdateKnowledgeBody }>(
    "/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = resolveDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "当前运行模式不支持知识更新接口" });
      }

      const input = request.body ?? {};
      if (input.status && !KNOWN_STATUS.has(input.status)) {
        return reply.code(400).send({ message: "status 非法" });
      }

      if (typeof input.title === "string" && input.title.trim().length === 0) {
        return reply.code(400).send({ message: "title 不能为空" });
      }

      if (typeof input.content === "string" && input.content.trim().length === 0) {
        return reply.code(400).send({ message: "content 不能为空" });
      }

      try {
        const updated = database.knowledge.update(request.params.id, {
          title: input.title?.trim(),
          content: input.content,
          summary: input.summary?.trim(),
          category: input.category?.trim(),
          sourceSessionId: input.sourceSessionId,
          qualityScore: input.qualityScore,
          status: input.status,
          metadata: input.metadata,
          tags: input.tags,
          changeSummary: input.changeSummary,
          editedBy: resolveCurrentUserId(request.user)
        });

        if (!updated) {
          return reply.code(404).send({ message: "知识条目不存在" });
        }

        return reply.send(updated);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Invalid knowledge status transition")) {
          return reply.code(400).send({ message: "不支持的状态流转" });
        }
        throw error;
      }
    }
  );

  app.patch<{ Params: { id: string }; Body: UpdateKnowledgeStatusBody }>(
    "/:id/status",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = resolveDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "当前运行模式不支持知识状态更新接口" });
      }

      const status = request.body?.status;
      if (!status || !KNOWN_STATUS.has(status)) {
        return reply.code(400).send({ message: "status 非法" });
      }

      try {
        const updated = database.knowledge.updateStatus(
          request.params.id,
          status,
          resolveCurrentUserId(request.user)
        );
        if (!updated) {
          return reply.code(404).send({ message: "知识条目不存在" });
        }
        return reply.send(updated);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Invalid knowledge status transition")) {
          return reply.code(400).send({ message: "不支持的状态流转" });
        }
        throw error;
      }
    }
  );

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = resolveDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "当前运行模式不支持知识删除接口" });
    }

    const deleted = database.knowledge.delete(request.params.id);
    if (!deleted) {
      return reply.code(404).send({ message: "知识条目不存在" });
    }
    return reply.code(204).send();
  });
};
