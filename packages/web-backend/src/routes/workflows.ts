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

const parseNodes = (value: unknown): SkillWorkflowNode[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is SkillWorkflowNode => Boolean(item && typeof item === "object" && typeof (item as SkillWorkflowNode).id === "string" && typeof (item as SkillWorkflowNode).type === "string" && typeof (item as SkillWorkflowNode).name === "string" && Array.isArray((item as SkillWorkflowNode).next)));
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
    const item = database.skillWorkflows.create({
      name,
      description: normalizeString(request.body?.description) ?? "",
      status: normalizeString(request.body?.status) as "draft" | "active" | null ?? "draft",
      nodes: parseNodes(request.body?.nodes)
    });
    return reply.code(201).send({ item });
  });

  app.patch<{ Params: { workflowId: string }; Body: WorkflowBody }>("/:workflowId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const database = getDatabase(app);
    if (!database) {
      return reply.code(501).send({ message: "workflow not available" });
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
