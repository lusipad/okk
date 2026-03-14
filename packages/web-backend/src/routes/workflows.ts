import type { SkillWorkflowNode, SkillWorkflowRunStep, SqliteDatabase } from "@okk/core";
import type { FastifyPluginAsync } from "fastify";

interface WorkflowBody {
  name?: unknown;
  description?: unknown;
  status?: unknown;
  nodes?: unknown;
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

const buildTemplates = () => [
  {
    id: "template-review",
    name: "代码审查工作流",
    description: "Prompt -> Skill -> Agent",
    nodes: [
      { id: "prompt-1", type: "prompt", name: "准备上下文", config: { template: "请基于 {{topic}} 总结背景", outputKey: "brief" }, next: ["skill-1"] },
      { id: "skill-1", type: "skill", name: "注入 Skill", config: { skillName: "openspec-apply-change", outputKey: "skillSummary" }, next: ["agent-1"] },
      { id: "agent-1", type: "agent", name: "分派 Agent", config: { agentName: "code-reviewer", outputKey: "agentResult" }, next: [] }
    ]
  },
  {
    id: "template-branch",
    name: "分支恢复工作流",
    description: "Condition -> Agent Branches",
    nodes: [
      { id: "condition-1", type: "condition", name: "判断风险级别", config: { key: "severity", equals: "high", trueNext: "agent-high", falseNext: "agent-low" }, next: [] },
      { id: "agent-high", type: "agent", name: "高优先处理", config: { agentName: "incident-responder", outputKey: "result" }, next: [] },
      { id: "agent-low", type: "agent", name: "常规处理", config: { agentName: "code-reviewer", outputKey: "result" }, next: [] }
    ]
  },
  {
    id: "template-knowledge",
    name: "知识输入工作流",
    description: "Knowledge -> Prompt -> Agent",
    nodes: [
      { id: "knowledge-1", type: "knowledge_ref", name: "加载知识", config: { query: "workflow", limit: 3, outputKey: "knowledgeBundle" }, next: ["prompt-1"] },
      { id: "prompt-1", type: "prompt", name: "生成摘要", config: { template: "请结合 {{knowledgeBundle.summary}} 和 {{topic}} 生成执行简报", outputKey: "brief" }, next: ["agent-1"] },
      { id: "agent-1", type: "agent", name: "分派 Agent", config: { agentName: "code-reviewer", outputKey: "result" }, next: [] }
    ]
  }
];

async function executeWorkflow(
  app: {
    core: {
      skills: { list: () => Promise<Array<{ name: string; description: string }>> };
      agents: { list: () => Promise<Array<{ name: string; description: string; backend: string }>> };
    };
  },
  workflow: { id: string; nodes: SkillWorkflowNode[] },
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

export const workflowsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/templates", { preHandler: [app.authenticate] }, async (_request, reply) => reply.send({ items: buildTemplates() }));

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
      status: normalizeString(request.body?.status) as "draft" | "active" | null ?? "draft",
      nodes
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
      ...(request.body?.nodes !== undefined ? { nodes: parseNodes(request.body?.nodes) } : {})
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

    const run = database.skillWorkflows.createRun({ workflowId: workflow.id, sessionId: request.body?.sessionId ?? null, input: request.body?.input ?? {} });
    const result = await executeWorkflow(app as never, workflow, request.body?.input ?? {});
    const item = database.skillWorkflows.updateRun(run.id, {
      status: result.status,
      input: request.body?.input ?? {},
      output: result.output,
      steps: result.steps
    });
    return reply.send({ item });
  });

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
    const nextRun = database.skillWorkflows.createRun({ workflowId: workflow.id, sessionId: currentRun.sessionId, input: currentRun.input });
    const result = await executeWorkflow(app as never, workflow, currentRun.input);
    const item = database.skillWorkflows.updateRun(nextRun.id, { status: result.status, input: currentRun.input, output: result.output, steps: result.steps });
    return reply.code(201).send({ item });
  });
};
