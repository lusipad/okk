import { describe, expect, it } from "vitest";
import {
  buildWorkflowKnowledgeDraft,
  buildWorkflowKnowledgeEntryMetadata,
  normalizeSkillWorkflowRunMetadata,
  type SkillWorkflowRecord,
  type SkillWorkflowRun
} from "../src/index.js";

const workflow: SkillWorkflowRecord = {
  id: "workflow-1",
  name: "知识工作流",
  description: "将运行结果沉淀为知识",
  status: "active",
  nodes: [],
  metadata: {
    templateId: "template-context-digest",
    knowledgePublishing: {
      enabled: true,
      defaultMode: "summary",
      titlePrefix: "上下文整理",
      category: "context",
      tags: ["context", "digest"],
      repoId: null,
      sourceStepIds: ["prompt-1", "agent-1"]
    }
  },
  createdAt: "2026-03-14T00:00:00.000Z",
  updatedAt: "2026-03-14T00:00:00.000Z"
};

const run: SkillWorkflowRun = {
  id: "run-1",
  workflowId: workflow.id,
  sessionId: "session-1",
  status: "completed",
  input: { topic: "SQLite 迁移" },
  output: { summary: "整理出迁移背景、风险和执行建议", result: "review complete" },
  steps: [
    {
      nodeId: "prompt-1",
      nodeName: "整理当前上下文",
      nodeType: "prompt",
      status: "completed",
      input: { topic: "SQLite 迁移" },
      output: { text: "输出可沉淀的上下文摘要" },
      startedAt: "2026-03-14T00:00:00.000Z",
      endedAt: "2026-03-14T00:00:01.000Z",
      error: null
    },
    {
      nodeId: "agent-1",
      nodeName: "补充结构化说明",
      nodeType: "agent",
      status: "completed",
      input: {},
      output: { message: "Agent 已生成结构化说明" },
      startedAt: "2026-03-14T00:00:01.000Z",
      endedAt: "2026-03-14T00:00:02.000Z",
      error: null
    }
  ],
  metadata: normalizeSkillWorkflowRunMetadata({
    templateId: "template-context-digest",
    workflowName: workflow.name,
    knowledgePublishing: workflow.metadata.knowledgePublishing,
    availablePublishModes: ["summary", "full"]
  }),
  startedAt: "2026-03-14T00:00:00.000Z",
  updatedAt: "2026-03-14T00:00:02.000Z",
  endedAt: "2026-03-14T00:00:02.000Z"
};

describe("workflow knowledge publishing", () => {
  it("根据 workflow metadata 生成默认知识草稿", () => {
    const draft = buildWorkflowKnowledgeDraft({
      workflow,
      run,
      repoId: "repo-1"
    });

    expect(draft.title).toContain("上下文整理");
    expect(draft.summary).toContain("整理出迁移背景");
    expect(draft.repoId).toBe("repo-1");
    expect(draft.category).toBe("context");
    expect(draft.tags).toEqual(["workflow", "context", "digest"]);
    expect(draft.mode).toBe("summary");
    expect(draft.source.templateId).toBe("template-context-digest");
    expect(draft.source.sourceStepIds).toEqual(["prompt-1", "agent-1"]);
    expect(draft.content).toContain("## 关键步骤");
  });

  it("在 full 模式下保留运行输入输出，并生成知识来源元数据", () => {
    const draft = buildWorkflowKnowledgeDraft({
      workflow,
      run,
      repoId: "repo-1",
      mode: "full"
    });
    const metadata = buildWorkflowKnowledgeEntryMetadata(draft, "2026-03-14T01:00:00.000Z");

    expect(draft.mode).toBe("full");
    expect(draft.content).toContain("## 运行输入");
    expect(draft.content).toContain("## 运行输出");
    expect(metadata.workflow).toEqual({
      workflowId: "workflow-1",
      workflowName: "知识工作流",
      runId: "run-1",
      templateId: "template-context-digest",
      sourceStepIds: ["prompt-1", "agent-1"],
      mode: "full",
      publishedAt: "2026-03-14T01:00:00.000Z"
    });
  });
});
