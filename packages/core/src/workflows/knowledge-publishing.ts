import type {
  SkillWorkflowMetadata,
  SkillWorkflowRecord,
  SkillWorkflowRun,
  SkillWorkflowRunMetadata,
  SkillWorkflowRunStep,
  WorkflowKnowledgeDraft,
  WorkflowKnowledgePublishMode,
  WorkflowKnowledgePublishingConfig
} from "../types.js";

const DEFAULT_CATEGORY = "workflow";
const DEFAULT_MODE: WorkflowKnowledgePublishMode = "summary";
const DEFAULT_AVAILABLE_MODES: WorkflowKnowledgePublishMode[] = ["summary", "full"];
const MAX_SUMMARY_LENGTH = 180;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeString = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)))
    : [];

const truncate = (value: string, maxLength = MAX_SUMMARY_LENGTH): string => {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
};

const renderValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const summarizeStep = (step: SkillWorkflowRunStep): string => {
  const output = step.output ?? {};
  const candidates = [output.summary, output.text, output.message];
  for (const candidate of candidates) {
    const rendered = renderValue(candidate);
    if (rendered) {
      return truncate(rendered);
    }
  }

  if (Object.keys(output).length === 0) {
    return step.error ?? `${step.nodeType} 已完成`;
  }

  return truncate(renderValue(output));
};

const summarizeRun = (workflow: Pick<SkillWorkflowRecord, "name">, run: SkillWorkflowRun): string => {
  const outputCandidates = [run.output.summary, run.output.brief, run.output.result, run.output.agentResult];
  for (const candidate of outputCandidates) {
    const rendered = renderValue(candidate);
    if (rendered) {
      return truncate(rendered);
    }
  }

  for (const step of run.steps) {
    const rendered = summarizeStep(step);
    if (rendered) {
      return truncate(rendered);
    }
  }

  return truncate(`${workflow.name} 已完成，共 ${run.steps.length} 个步骤。`);
};

const resolveSourceSteps = (run: SkillWorkflowRun, sourceStepIds: string[]): SkillWorkflowRunStep[] => {
  const stepMap = new Map(run.steps.map((step) => [step.nodeId, step]));
  const selected = sourceStepIds
    .map((stepId) => stepMap.get(stepId))
    .filter((step): step is SkillWorkflowRunStep => Boolean(step));
  if (selected.length > 0) {
    return selected;
  }
  return run.steps.filter((step) => step.status === "completed");
};

const renderStepSection = (steps: SkillWorkflowRunStep[]): string =>
  steps.length === 0
    ? "## 关键步骤\n\n- 本次运行没有可用步骤摘要。"
    : [
        "## 关键步骤",
        "",
        ...steps.flatMap((step) => [
          `### ${step.nodeName}`,
          `- 节点类型：${step.nodeType}`,
          `- 状态：${step.status}`,
          step.error ? `- 错误：${step.error}` : `- 摘要：${summarizeStep(step) || "无"}`,
          ""
        ])
      ].join("\n");

const renderSourceSection = (workflow: SkillWorkflowRecord, run: SkillWorkflowRun, mode: WorkflowKnowledgePublishMode, sourceStepIds: string[]): string =>
  [
    "## 来源信息",
    "",
    `- workflowId: ${workflow.id}`,
    `- workflowName: ${workflow.name}`,
    `- runId: ${run.id}`,
    `- mode: ${mode}`,
    `- templateId: ${workflow.metadata.templateId ?? "manual"}`,
    `- sourceStepIds: ${sourceStepIds.length > 0 ? sourceStepIds.join(", ") : "none"}`
  ].join("\n");

const renderOutputSection = (title: string, payload: unknown): string =>
  [
    `## ${title}`,
    "",
    "```json",
    renderValue(payload) || "{}",
    "```"
  ].join("\n");

export const normalizeWorkflowKnowledgePublishingConfig = (value: unknown): WorkflowKnowledgePublishingConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    enabled: value.enabled !== false,
    defaultMode: value.defaultMode === "full" ? "full" : DEFAULT_MODE,
    titlePrefix: normalizeString(value.titlePrefix) ?? "",
    category: normalizeString(value.category) ?? DEFAULT_CATEGORY,
    tags: normalizeStringArray(value.tags),
    repoId: normalizeString(value.repoId),
    sourceStepIds: normalizeStringArray(value.sourceStepIds)
  };
};

export const normalizeSkillWorkflowMetadata = (value: unknown): SkillWorkflowMetadata => {
  const source = isRecord(value) ? value : {};

  return {
    templateId: normalizeString(source.templateId),
    knowledgePublishing: normalizeWorkflowKnowledgePublishingConfig(source.knowledgePublishing ?? {})
  };
};

export const normalizeSkillWorkflowRunMetadata = (value: unknown, workflowName = ""): SkillWorkflowRunMetadata => {
  const workflowMetadata = normalizeSkillWorkflowMetadata(value);
  const source = isRecord(value) ? value : {};
  const availableModesRaw = normalizeStringArray(source.availablePublishModes);
  const availablePublishModes = availableModesRaw.filter(
    (mode): mode is WorkflowKnowledgePublishMode => mode === "summary" || mode === "full"
  );

  return {
    ...workflowMetadata,
    workflowName: normalizeString(source.workflowName) ?? workflowName,
    availablePublishModes: availablePublishModes.length > 0 ? availablePublishModes : [...DEFAULT_AVAILABLE_MODES],
    publishedKnowledgeEntryId: normalizeString(source.publishedKnowledgeEntryId),
    publishedAt: normalizeString(source.publishedAt)
  };
};

export const createWorkflowRunMetadata = (workflow: Pick<SkillWorkflowRecord, "name" | "metadata">): SkillWorkflowRunMetadata => {
  const metadata = normalizeSkillWorkflowMetadata(workflow.metadata);
  return {
    ...metadata,
    workflowName: workflow.name,
    availablePublishModes: [...DEFAULT_AVAILABLE_MODES],
    publishedKnowledgeEntryId: null,
    publishedAt: null
  };
};

export const buildWorkflowKnowledgeDraft = (input: {
  workflow: SkillWorkflowRecord;
  run: SkillWorkflowRun;
  repoId?: string | null;
  mode?: WorkflowKnowledgePublishMode;
}): WorkflowKnowledgeDraft => {
  const workflowMetadata = normalizeSkillWorkflowMetadata(input.workflow.metadata);
  const runMetadata = normalizeSkillWorkflowRunMetadata(input.run.metadata, input.workflow.name);
  const knowledgePublishing = runMetadata.knowledgePublishing ?? workflowMetadata.knowledgePublishing ?? normalizeWorkflowKnowledgePublishingConfig({});
  const mode = input.mode ?? knowledgePublishing?.defaultMode ?? DEFAULT_MODE;
  const sourceSteps = resolveSourceSteps(input.run, knowledgePublishing?.sourceStepIds ?? []);
  const sourceStepIds = sourceSteps.map((step) => step.nodeId);
  const titlePrefix = knowledgePublishing?.titlePrefix ? `${knowledgePublishing.titlePrefix} ` : "";
  const summary = summarizeRun(input.workflow, input.run);
  const title = `${titlePrefix}${input.workflow.name} 运行沉淀`;
  const repoId = normalizeString(input.repoId) ?? input.repoId ?? knowledgePublishing?.repoId ?? null;
  const tags = Array.from(new Set(["workflow", ...((knowledgePublishing?.tags ?? []).filter(Boolean))]));
  const contentSections =
    mode === "summary"
      ? [
          `# ${title}`,
          "",
          "## 摘要",
          "",
          summary,
          "",
          renderStepSection(sourceSteps),
          "",
          renderSourceSection(input.workflow, input.run, mode, sourceStepIds)
        ]
      : [
          `# ${title}`,
          "",
          "## 摘要",
          "",
          summary,
          "",
          renderOutputSection("运行输入", input.run.input),
          "",
          renderOutputSection("运行输出", input.run.output),
          "",
          renderStepSection(sourceSteps),
          "",
          renderSourceSection(input.workflow, input.run, mode, sourceStepIds)
        ];

  return {
    title,
    summary,
    content: contentSections.join("\n"),
    repoId,
    category: knowledgePublishing?.category ?? DEFAULT_CATEGORY,
    tags,
    mode,
    source: {
      workflowId: input.workflow.id,
      workflowName: runMetadata.workflowName || input.workflow.name,
      runId: input.run.id,
      templateId: runMetadata.templateId ?? workflowMetadata.templateId,
      sourceStepIds,
      mode
    }
  };
};

export const buildWorkflowKnowledgeEntryMetadata = (draft: WorkflowKnowledgeDraft, publishedAt: string): Record<string, unknown> => ({
  workflow: {
    workflowId: draft.source.workflowId,
    workflowName: draft.source.workflowName,
    runId: draft.source.runId,
    templateId: draft.source.templateId,
    sourceStepIds: [...draft.source.sourceStepIds],
    mode: draft.source.mode,
    publishedAt
  }
});
