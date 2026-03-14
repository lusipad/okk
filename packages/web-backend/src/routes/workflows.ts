import {
  buildWorkflowKnowledgeDraft,
  buildWorkflowKnowledgeEntryMetadata,
  createWorkflowRunMetadata,
  normalizeSkillWorkflowMetadata,
  normalizeWorkflowKnowledgePublishingConfig,
  type SkillWorkflowMetadata,
  type SkillWorkflowNode,
  type SkillWorkflowRecord,
  type SkillWorkflowRun,
  type SkillWorkflowRunStep,
  type SqliteDatabase,
  type WorkflowKnowledgeDraft,
  type WorkflowKnowledgePublishMode
} from "@okk/core";
import type { FastifyPluginAsync } from "fastify";

interface WorkflowBody {
  name?: unknown;
  description?: unknown;
  status?: unknown;
  nodes?: unknown;
  metadata?: unknown;
}

interface WorkflowKnowledgeDraftQuery {
  mode?: string;
}

interface PublishWorkflowKnowledgeBody {
  title?: unknown;
  summary?: unknown;
  content?: unknown;
  repoId?: unknown;
  category?: unknown;
  tags?: unknown;
  mode?: unknown;
}

const getDatabase = (app: { core: unknown }): SqliteDatabase | null => {
  const database = (app.core as { database?: SqliteDatabase }).database;
  return database ?? null;
};

const normalizeString = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)))
    : [];

const asPositiveInt = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
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

const resolvePublishMode = (value: unknown): WorkflowKnowledgePublishMode | null | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value === "summary" || value === "full") {
    return value;
  }
  return null;
};

const VALID_NODE_TYPES = new Set<SkillWorkflowNode["type"]>(["prompt", "skill", "agent", "condition", "knowledge_ref"]);
const VALID_KNOWLEDGE_STATUS = new Set(["draft", "published", "stale", "archived"]);

const parseNodes = (value: unknown): SkillWorkflowNode[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is SkillWorkflowNode =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as SkillWorkflowNode).id === "string" &&
          typeof (item as SkillWorkflowNode).type === "string" &&
          VALID_NODE_TYPES.has((item as SkillWorkflowNode).type) &&
          typeof (item as SkillWorkflowNode).name === "string" &&
          Array.isArray((item as SkillWorkflowNode).next)
      )
  );
};

const parseWorkflowMetadata = (value: unknown): SkillWorkflowMetadata => normalizeSkillWorkflowMetadata(value);

const validateKnowledgeRefNode = (node: SkillWorkflowNode): string | null => {
  if (node.type !== "knowledge_ref") {
    return null;
  }

  const config = node.config ?? {};
  const outputKey = normalizeString(config.outputKey);
  if (!outputKey) {
    return `knowledge_ref 节点 ${node.id} 缺少 outputKey`;
  }

  const entryIds = asStringArray(config.entryIds);
  const tags = asStringArray(config.tags);
  const hasFilters =
    Boolean(normalizeString(config.repoId)) ||
    Boolean(normalizeString(config.category)) ||
    Boolean(normalizeString(config.query)) ||
    Boolean(normalizeString(config.status)) ||
    tags.length > 0 ||
    asPositiveInt(config.limit) !== undefined;

  if (entryIds.length === 0 && !hasFilters) {
    return `knowledge_ref 节点 ${node.id} 至少需要 entryIds 或任一筛选条件`;
  }

  const status = normalizeString(config.status);
  if (status && !VALID_KNOWLEDGE_STATUS.has(status)) {
    return `knowledge_ref 节点 ${node.id} 使用了非法 status`;
  }

  return null;
};

const validateWorkflowNodes = (nodes: SkillWorkflowNode[]): string | null => {
  for (const node of nodes) {
    const error = validateKnowledgeRefNode(node);
    if (error) {
      return error;
    }
  }
  return null;
};

interface WorkflowKnowledgeEntry {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  status: string;
  updatedAt: string;
}

const toWorkflowKnowledgeEntry = (entry: {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  status: string;
  updatedAt: string;
}): WorkflowKnowledgeEntry => ({
  id: entry.id,
  title: entry.title,
  summary: entry.summary,
  category: entry.category,
  tags: [...entry.tags],
  status: entry.status,
  updatedAt: entry.updatedAt
});

const buildKnowledgeSummary = (entries: WorkflowKnowledgeEntry[]): string =>
  entries.map((entry, index) => `${index + 1}. [${entry.category}] ${entry.title}: ${entry.summary}`).join("\n");

const resolveKnowledgeRefOutput = (database: SqliteDatabase, node: SkillWorkflowNode): { outputKey: string; entries: WorkflowKnowledgeEntry[]; summary: string } => {
  const config = node.config ?? {};
  const outputKey = normalizeString(config.outputKey) ?? "knowledge";
  const entryIds = asStringArray(config.entryIds);
  const tags = asStringArray(config.tags);
  const status = normalizeString(config.status);

  const entries =
    entryIds.length > 0
      ? entryIds
          .map((entryId) => database.knowledge.getById(entryId))
          .filter((item): item is NonNullable<ReturnType<SqliteDatabase["knowledge"]["getById"]>> => Boolean(item))
      : normalizeString(config.query)
        ? database.knowledge.search({
            keyword: normalizeString(config.query) ?? undefined,
            repoId: normalizeString(config.repoId) ?? undefined,
            category: normalizeString(config.category) ?? undefined,
            status: status && VALID_KNOWLEDGE_STATUS.has(status) ? (status as "draft" | "published" | "stale" | "archived") : undefined,
            tags,
            limit: asPositiveInt(config.limit) ?? 5
          })
        : database.knowledge.list({
            repoId: normalizeString(config.repoId) ?? undefined,
            category: normalizeString(config.category) ?? undefined,
            status: status && VALID_KNOWLEDGE_STATUS.has(status) ? (status as "draft" | "published" | "stale" | "archived") : undefined,
            tags,
            limit: asPositiveInt(config.limit) ?? 5
          });

  const serializedEntries = entries.map((entry) => toWorkflowKnowledgeEntry(entry));
  return {
    outputKey,
    entries: serializedEntries,
    summary: buildKnowledgeSummary(serializedEntries)
  };
};

const interpolate = (template: string, context: Record<string, unknown>): string =>
  template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });

const createTemplate = (input: {
  id: string;
  name: string;
  description: string;
  nodes: SkillWorkflowNode[];
  metadata?: unknown;
}) => ({
  id: input.id,
  name: input.name,
  description: input.description,
  nodes: input.nodes,
  metadata: normalizeSkillWorkflowMetadata({
    templateId: input.id,
    knowledgePublishing: normalizeWorkflowKnowledgePublishingConfig(input.metadata)
  })
});

const buildTemplates = async (app: {
  core: {
    skills: { list: () => Promise<Array<{ name: string; description: string }>> };
    agents: { list: () => Promise<Array<{ name: string; description: string; backend: string }>> };
  };
}) => {
  const [skills, agents] = await Promise.all([app.core.skills.list(), app.core.agents.list()]);
  const primarySkill = skills.find((item) => item.name === "openspec-apply-change")?.name ?? skills[0]?.name ?? "repo-stats";

  const createExecutionNode = (nodeId: string, nodeName: string, outputKey: string): SkillWorkflowNode =>
    agents[0]
      ? {
          id: nodeId,
          type: "agent",
          name: nodeName,
          config: { agentName: agents[0].name, outputKey },
          next: []
        }
      : {
          id: nodeId,
          type: "skill",
          name: nodeName,
          config: { skillName: primarySkill, outputKey },
          next: []
        };

  const reviewExecutionNode = createExecutionNode("agent-1", "生成审查结论", "agentResult");
  const contextExecutionNode = createExecutionNode("agent-1", "补充结构化说明", "agentResult");
  const healthExecutionNode = createExecutionNode("agent-1", "生成健康检查结论", "agentResult");

  return [
    createTemplate({
      id: "template-review",
      name: "代码审查沉淀",
      description: "Prompt -> Skill -> Agent/Skill，输出代码审查结论并可直接沉淀为知识。",
      metadata: {
        enabled: true,
        defaultMode: "summary",
        titlePrefix: "代码审查沉淀",
        category: "code-review",
        tags: ["review", "workflow"],
        sourceStepIds: ["prompt-1", "skill-1", reviewExecutionNode.id]
      },
      nodes: [
        { id: "prompt-1", type: "prompt", name: "准备审查背景", config: { template: "请基于 {{topic}} 提炼本次变更背景与风险点", outputKey: "brief" }, next: ["skill-1"] },
        { id: "skill-1", type: "skill", name: "注入变更技能", config: { skillName: primarySkill, outputKey: "skillSummary" }, next: [reviewExecutionNode.id] },
        reviewExecutionNode
      ]
    }),
    createTemplate({
      id: "template-context-digest",
      name: "上下文整理沉淀",
      description: "Knowledge -> Prompt -> Agent/Skill，先拉取上下文知识，再整理可复用说明。",
      metadata: {
        enabled: true,
        defaultMode: "summary",
        titlePrefix: "上下文整理沉淀",
        category: "context",
        tags: ["context", "workflow"],
        sourceStepIds: ["knowledge-1", "prompt-1", contextExecutionNode.id]
      },
      nodes: [
        { id: "knowledge-1", type: "knowledge_ref", name: "加载相关知识", config: { query: "context", limit: 3, outputKey: "knowledgeBundle" }, next: ["prompt-1"] },
        { id: "prompt-1", type: "prompt", name: "整理当前上下文", config: { template: "请结合 {{knowledgeBundle.summary}} 和 {{topic}} 输出可沉淀的上下文摘要", outputKey: "brief" }, next: [contextExecutionNode.id] },
        contextExecutionNode
      ]
    }),
    createTemplate({
      id: "template-knowledge-health",
      name: "知识健康检查",
      description: "Knowledge -> Prompt -> Agent/Skill，识别知识库中的陈旧、冲突和补录项。",
      metadata: {
        enabled: true,
        defaultMode: "summary",
        titlePrefix: "知识健康检查",
        category: "knowledge-health",
        tags: ["knowledge", "health-check", "workflow"],
        sourceStepIds: ["knowledge-1", "prompt-1", healthExecutionNode.id]
      },
      nodes: [
        { id: "knowledge-1", type: "knowledge_ref", name: "加载知识样本", config: { query: "knowledge", limit: 5, outputKey: "knowledgeBundle" }, next: ["prompt-1"] },
        { id: "prompt-1", type: "prompt", name: "提炼治理建议", config: { template: "请基于 {{knowledgeBundle.summary}} 和 {{topic}} 输出知识健康风险与改进建议", outputKey: "brief" }, next: [healthExecutionNode.id] },
        healthExecutionNode
      ]
    })
  ];
};

async function executeWorkflow(
  app: {
    core: {
      skills: { list: () => Promise<Array<{ name: string; description: string }>> };
      agents: { list: () => Promise<Array<{ name: string; description: string; backend: string }>> };
    };
  },
  workflow: Pick<SkillWorkflowRecord, "id" | "nodes">,
  input: Record<string, unknown>
): Promise<{ status: "completed" | "failed"; output: Record<string, unknown>; steps: SkillWorkflowRunStep[] }> {
  const skills = await app.core.skills.list();
  const agents = await app.core.agents.list();
  const database = getDatabase(app as { core: unknown });
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
  const incoming = new Set<string>();
  workflow.nodes.forEach((node) => node.next.forEach((nextId) => incoming.add(nextId)));
  const queue = workflow.nodes.filter((node) => !incoming.has(node.id)).map((node) => node.id);
  const context = { ...input };
  const steps: SkillWorkflowRunStep[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift() as string;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) {
      continue;
    }

    const startedAt = new Date().toISOString();
    const step: SkillWorkflowRunStep = {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      status: "running",
      input: { ...context },
      output: {},
      startedAt,
      endedAt: null,
      error: null
    };

    try {
      if (node.type === "prompt") {
        const template = typeof node.config.template === "string" ? node.config.template : "";
        const text = interpolate(template, context);
        const outputKey = typeof node.config.outputKey === "string" ? node.config.outputKey : "prompt";
        context[outputKey] = text;
        step.output = { text, outputKey };
        queue.push(...node.next);
      } else if (node.type === "skill") {
        const skillName = typeof node.config.skillName === "string" ? node.config.skillName : "";
        const skill = skills.find((item) => item.name === skillName);
        if (!skill) {
          throw new Error(`skill ${skillName} 不存在`);
        }
        const outputKey = typeof node.config.outputKey === "string" ? node.config.outputKey : skillName;
        const summary = `${skill.name}: ${skill.description}`;
        context[outputKey] = summary;
        step.output = { summary, outputKey };
        queue.push(...node.next);
      } else if (node.type === "agent") {
        const agentName = typeof node.config.agentName === "string" ? node.config.agentName : "";
        const agent = agents.find((item) => item.name === agentName);
        if (!agent) {
          throw new Error(`agent ${agentName} 不存在`);
        }
        const outputKey = typeof node.config.outputKey === "string" ? node.config.outputKey : agentName;
        const message = `Agent ${agent.name}(${agent.backend}) 已接收上下文：${Object.keys(context).join(", ") || "empty"}`;
        context[outputKey] = message;
        step.output = { message, outputKey };
        queue.push(...node.next);
      } else if (node.type === "condition") {
        const key = typeof node.config.key === "string" ? node.config.key : "";
        const expected = node.config.equals;
        const matched = context[key] === expected;
        const nextId = matched ? node.config.trueNext : node.config.falseNext;
        if (typeof nextId === "string" && nextId.trim().length > 0) {
          queue.push(nextId);
        }
        step.output = { matched, key, expected };
      } else if (node.type === "knowledge_ref") {
        if (!database) {
          throw new Error("knowledge_ref 节点需要可用的 workflow database");
        }
        const knowledgeOutput = resolveKnowledgeRefOutput(database, node);
        context[knowledgeOutput.outputKey] = knowledgeOutput;
        context[`${knowledgeOutput.outputKey}.summary`] = knowledgeOutput.summary;
        context[`${knowledgeOutput.outputKey}.entries`] = knowledgeOutput.entries;
        step.output = knowledgeOutput;
        queue.push(...node.next);
      }

      step.status = "completed";
      step.endedAt = new Date().toISOString();
      steps.push(step);
    } catch (error) {
      step.status = "failed";
      step.error = error instanceof Error ? error.message : "workflow_error";
      step.endedAt = new Date().toISOString();
      steps.push(step);
      return { status: "failed", output: { ...context, error: step.error }, steps };
    }
  }

  return { status: "completed", output: context, steps };
}

const resolveDefaultRepoId = async (app: { core: { repos: { list: () => Promise<Array<{ id: string }>>; create: (input: { name: string; path: string }) => Promise<{ id: string }> } } }): Promise<string> => {
  const repos = await app.core.repos.list();
  if (repos.length > 0) {
    return repos[0].id;
  }
  const created = await app.core.repos.create({ name: "默认仓库", path: process.cwd() });
  return created.id;
};

const resolveDraftRepoId = async (
  app: { core: { repos: { list: () => Promise<Array<{ id: string }>>; create: (input: { name: string; path: string }) => Promise<{ id: string }> } } },
  database: SqliteDatabase,
  workflow: SkillWorkflowRecord,
  run: SkillWorkflowRun
): Promise<string> => {
  const sessionRepoId = run.sessionId ? database.sessions.getById(run.sessionId)?.repoId ?? null : null;
  return sessionRepoId ?? workflow.metadata.knowledgePublishing?.repoId ?? await resolveDefaultRepoId(app);
};

const ensureCompletedRun = (run: SkillWorkflowRun): string | null => (run.status === "completed" ? null : "只有已完成的工作流运行可以保存为知识");

const resolveKnowledgeDraft = async (
  app: { core: { repos: { list: () => Promise<Array<{ id: string }>>; create: (input: { name: string; path: string }) => Promise<{ id: string }> } } },
  database: SqliteDatabase,
  workflow: SkillWorkflowRecord,
  run: SkillWorkflowRun,
  mode?: WorkflowKnowledgePublishMode,
  repoId?: string | null
): Promise<WorkflowKnowledgeDraft> => {
  const resolvedRepoId = normalizeString(repoId) ?? await resolveDraftRepoId(app, database, workflow, run);
  return buildWorkflowKnowledgeDraft({
    workflow,
    run,
    repoId: resolvedRepoId,
    mode
  });
};

export const workflowsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/templates", { preHandler: [app.authenticate] }, async (_request, reply) => reply.send({ items: await buildTemplates(app as never) }));

  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
    }
    return reply.send({ items: database.skillWorkflows.list() });
  });

  app.post<{ Body: WorkflowBody }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
    }
    const name = normalizeString(request.body?.name);
    if (!name) {
      return reply.code(400).send({ message: "name 必填" });
    }
    const nodes = parseNodes(request.body?.nodes);
    const validationError = validateWorkflowNodes(nodes);
    if (validationError) {
      return reply.code(400).send({ message: validationError });
    }
    const item = database.skillWorkflows.create({
      name,
      description: normalizeString(request.body?.description) ?? "",
      status: (normalizeString(request.body?.status) as "draft" | "active" | null) ?? "draft",
      nodes,
      metadata: parseWorkflowMetadata(request.body?.metadata)
    });
    return reply.code(201).send({ item });
  });

  app.patch<{ Params: { workflowId: string }; Body: WorkflowBody }>("/:workflowId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
    }
    if (request.body?.nodes !== undefined) {
      const nodes = parseNodes(request.body?.nodes);
      const validationError = validateWorkflowNodes(nodes);
      if (validationError) {
        return reply.code(400).send({ message: validationError });
      }
    }
    const item = database.skillWorkflows.update(request.params.workflowId, {
      ...(normalizeString(request.body?.name) ? { name: normalizeString(request.body?.name) as string } : {}),
      ...(request.body?.description !== undefined ? { description: normalizeString(request.body?.description) ?? "" } : {}),
      ...(request.body?.status !== undefined ? { status: normalizeString(request.body?.status) as "draft" | "active" } : {}),
      ...(request.body?.nodes !== undefined ? { nodes: parseNodes(request.body?.nodes) } : {}),
      ...(request.body?.metadata !== undefined ? { metadata: parseWorkflowMetadata(request.body?.metadata) } : {})
    });
    if (!item) {
      return reply.code(404).send({ message: "workflow not found" });
    }
    return reply.send({ item });
  });

  app.delete<{ Params: { workflowId: string } }>("/:workflowId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
    }
    const removed = database.skillWorkflows.delete(request.params.workflowId);
    return reply.code(removed ? 204 : 404).send();
  });

  app.get<{ Params: { workflowId: string } }>("/:workflowId/runs", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
    }
    return reply.send({ items: database.skillWorkflows.listRuns(request.params.workflowId) });
  });

  app.get<{ Params: { runId: string } }>("/runs/:runId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
    }
    const item = database.skillWorkflows.getRunById(request.params.runId);
    return reply.code(item ? 200 : 404).send(item ? { item } : { message: "run not found" });
  });

  app.get<{ Params: { runId: string }; Querystring: WorkflowKnowledgeDraftQuery }>(
    "/runs/:runId/knowledge-draft",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = getDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "workflow not available" });
      }
      const mode = resolvePublishMode(request.query.mode);
      if (mode === null) {
        return reply.code(400).send({ message: "mode 非法" });
      }
      const run = database.skillWorkflows.getRunById(request.params.runId);
      if (!run) {
        return reply.code(404).send({ message: "run not found" });
      }
      const workflow = database.skillWorkflows.getById(run.workflowId);
      if (!workflow) {
        return reply.code(404).send({ message: "workflow not found" });
      }
      const runError = ensureCompletedRun(run);
      if (runError) {
        return reply.code(409).send({ message: runError });
      }
      const item = await resolveKnowledgeDraft(app as never, database, workflow, run, mode);
      return reply.send({ item });
    }
  );

  app.post<{ Params: { workflowId: string }; Body: { sessionId?: string; input?: Record<string, unknown> } }>("/:workflowId/run", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
    }
    const workflow = database.skillWorkflows.getById(request.params.workflowId);
    if (!workflow) {
      return reply.code(404).send({ message: "workflow not found" });
    }
    const validationError = validateWorkflowNodes(workflow.nodes);
    if (validationError) {
      return reply.code(400).send({ message: validationError });
    }

    const run = database.skillWorkflows.createRun({
      workflowId: workflow.id,
      sessionId: request.body?.sessionId ?? null,
      input: request.body?.input ?? {},
      metadata: createWorkflowRunMetadata(workflow)
    });
    const result = await executeWorkflow(app as never, workflow, request.body?.input ?? {});
    const item = database.skillWorkflows.updateRun(run.id, {
      status: result.status,
      input: request.body?.input ?? {},
      output: result.output,
      steps: result.steps
    });
    return reply.send({ item });
  });

  app.post<{ Params: { runId: string }; Body: PublishWorkflowKnowledgeBody }>(
    "/runs/:runId/publish-knowledge",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const database = getDatabase(app);
      if (!database) {
        return reply.code(501).send({ message: "workflow not available" });
      }
      const run = database.skillWorkflows.getRunById(request.params.runId);
      if (!run) {
        return reply.code(404).send({ message: "run not found" });
      }
      const workflow = database.skillWorkflows.getById(run.workflowId);
      if (!workflow) {
        return reply.code(404).send({ message: "workflow not found" });
      }
      const runError = ensureCompletedRun(run);
      if (runError) {
        return reply.code(409).send({ message: runError });
      }

      if (run.metadata.publishedKnowledgeEntryId) {
        const existing = database.knowledge.getById(run.metadata.publishedKnowledgeEntryId);
        if (existing) {
          return reply.send({
            item: existing,
            relation: { workflowId: workflow.id, runId: run.id, entryId: existing.id }
          });
        }
      }

      const mode = resolvePublishMode(request.body?.mode);
      if (mode === null) {
        return reply.code(400).send({ message: "mode 非法" });
      }
      const draft = await resolveKnowledgeDraft(
        app as never,
        database,
        workflow,
        run,
        mode,
        normalizeString(request.body?.repoId)
      );
      const publishedRepoId = (normalizeString(request.body?.repoId) ?? draft.repoId ?? await resolveDefaultRepoId(app as never)) as string;
      const publishedDraft: WorkflowKnowledgeDraft = {
        ...draft,
        title: normalizeString(request.body?.title) ?? draft.title,
        summary: normalizeString(request.body?.summary) ?? draft.summary,
        content: normalizeString(request.body?.content) ?? draft.content,
        repoId: publishedRepoId,
        category: normalizeString(request.body?.category) ?? draft.category,
        tags: asStringArray(request.body?.tags).length > 0 ? asStringArray(request.body?.tags) : draft.tags
      };
      const publishedAt = new Date().toISOString();
      const item = database.knowledge.create({
        title: publishedDraft.title,
        content: publishedDraft.content,
        summary: publishedDraft.summary,
        repoId: publishedRepoId,
        category: publishedDraft.category,
        sourceSessionId: run.sessionId,
        status: "draft",
        metadata: buildWorkflowKnowledgeEntryMetadata(publishedDraft, publishedAt),
        tags: publishedDraft.tags,
        createdBy: resolveCurrentUserId(request.user)
      });
      const updatedRun = database.skillWorkflows.updateRun(run.id, {
        metadata: {
          ...run.metadata,
          workflowName: run.metadata.workflowName || workflow.name,
          publishedKnowledgeEntryId: item.id,
          publishedAt
        }
      });
      return reply.code(201).send({
        item,
        run: updatedRun,
        relation: { workflowId: workflow.id, runId: run.id, entryId: item.id }
      });
    }
  );

  app.post<{ Params: { runId: string } }>("/runs/:runId/retry", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
    }
    const currentRun = database.skillWorkflows.getRunById(request.params.runId);
    if (!currentRun) {
      return reply.code(404).send({ message: "run not found" });
    }
    const workflow = database.skillWorkflows.getById(currentRun.workflowId);
    if (!workflow) {
      return reply.code(404).send({ message: "workflow not found" });
    }
    const nextRun = database.skillWorkflows.createRun({
      workflowId: workflow.id,
      sessionId: currentRun.sessionId,
      input: currentRun.input,
      metadata: createWorkflowRunMetadata(workflow)
    });
    const result = await executeWorkflow(app as never, workflow, currentRun.input);
    const item = database.skillWorkflows.updateRun(nextRun.id, {
      status: result.status,
      input: currentRun.input,
      output: result.output,
      steps: result.steps
    });
    return reply.code(201).send({ item });
  });
};
