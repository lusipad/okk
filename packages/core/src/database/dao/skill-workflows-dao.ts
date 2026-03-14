import type {
  SkillWorkflowMetadata,
  SkillWorkflowNode,
  SkillWorkflowRecord,
  SkillWorkflowRun,
  SkillWorkflowRunMetadata,
  SkillWorkflowRunStatus,
  SkillWorkflowRunStep,
  SkillWorkflowStatus
} from "../../types.js";
import { normalizeSkillWorkflowMetadata, normalizeSkillWorkflowRunMetadata } from "../../workflows/knowledge-publishing.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  status: SkillWorkflowStatus;
  nodes_json: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  session_id: string | null;
  status: SkillWorkflowRunStatus;
  input_json: string;
  output_json: string;
  steps_json: string;
  metadata_json: string;
  started_at: string;
  updated_at: string;
  ended_at: string | null;
}

export interface CreateWorkflowInput {
  id?: string;
  name: string;
  description?: string;
  status?: SkillWorkflowStatus;
  nodes: SkillWorkflowNode[];
  metadata?: SkillWorkflowMetadata;
}

const parseObject = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const parseNodes = (value: string): SkillWorkflowNode[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as SkillWorkflowNode[]) : [];
  } catch {
    return [];
  }
};

const parseSteps = (value: string): SkillWorkflowRunStep[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as SkillWorkflowRunStep[]) : [];
  } catch {
    return [];
  }
};

const toWorkflow = (row: WorkflowRow): SkillWorkflowRecord => ({
  id: row.id,
  name: row.name,
  description: row.description,
  status: row.status,
  nodes: parseNodes(row.nodes_json),
  metadata: normalizeSkillWorkflowMetadata(parseObject(row.metadata_json)),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toRun = (row: WorkflowRunRow): SkillWorkflowRun => ({
  id: row.id,
  workflowId: row.workflow_id,
  sessionId: row.session_id,
  status: row.status,
  input: parseObject(row.input_json),
  output: parseObject(row.output_json),
  steps: parseSteps(row.steps_json),
  metadata: normalizeSkillWorkflowRunMetadata(parseObject(row.metadata_json)),
  startedAt: row.started_at,
  updatedAt: row.updated_at,
  endedAt: row.ended_at
});

export class SkillWorkflowsDao {
  constructor(private readonly db: SqliteConnection) {}

  list(): SkillWorkflowRecord[] {
    const rows = this.db.prepare("SELECT * FROM skill_workflows ORDER BY updated_at DESC, created_at DESC").all() as WorkflowRow[];
    return rows.map(toWorkflow);
  }

  getById(id: string): SkillWorkflowRecord | null {
    const row = this.db.prepare("SELECT * FROM skill_workflows WHERE id = ?").get(id) as WorkflowRow | undefined;
    return row ? toWorkflow(row) : null;
  }

  create(input: CreateWorkflowInput): SkillWorkflowRecord {
    const id = input.id ?? generateId();
    const timestamp = nowIso();
    this.db.prepare(
      `INSERT INTO skill_workflows(id, name, description, status, nodes_json, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name.trim(),
      input.description?.trim() ?? "",
      input.status ?? "draft",
      JSON.stringify(input.nodes),
      JSON.stringify(normalizeSkillWorkflowMetadata(input.metadata)),
      timestamp,
      timestamp
    );

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create workflow");
    }
    return created;
  }

  update(id: string, input: Partial<CreateWorkflowInput>): SkillWorkflowRecord | null {
    const current = this.getById(id);
    if (!current) {
      return null;
    }
    this.db.prepare(
       `UPDATE skill_workflows
       SET name = ?, description = ?, status = ?, nodes_json = ?, metadata_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.name?.trim() || current.name,
      input.description === undefined ? current.description : input.description,
      input.status ?? current.status,
      JSON.stringify(input.nodes ?? current.nodes),
      JSON.stringify(input.metadata === undefined ? current.metadata : normalizeSkillWorkflowMetadata(input.metadata)),
      nowIso(),
      id
    );

    return this.getById(id);
  }

  delete(id: string): boolean {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM skill_workflow_runs WHERE workflow_id = ?").run(id);
      return this.db.prepare("DELETE FROM skill_workflows WHERE id = ?").run(id);
    });
    const result = tx() as { changes: number };
    return result.changes > 0;
  }

  createRun(input: {
    workflowId: string;
    sessionId?: string | null;
    status?: SkillWorkflowRunStatus;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    steps?: SkillWorkflowRunStep[];
    metadata?: SkillWorkflowRunMetadata;
  }): SkillWorkflowRun {
    const id = generateId();
    const timestamp = nowIso();
    this.db.prepare(
      `INSERT INTO skill_workflow_runs(
         id, workflow_id, session_id, status, input_json, output_json, steps_json, metadata_json, started_at, updated_at, ended_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.workflowId,
      input.sessionId ?? null,
      input.status ?? "running",
      JSON.stringify(input.input ?? {}),
      JSON.stringify(input.output ?? {}),
      JSON.stringify(input.steps ?? []),
      JSON.stringify(normalizeSkillWorkflowRunMetadata(input.metadata)),
      timestamp,
      timestamp,
      input.status && input.status !== "running" ? timestamp : null
    );

    const created = this.getRunById(id);
    if (!created) {
      throw new Error("Failed to create workflow run");
    }
    return created;
  }

  updateRun(id: string, input: Partial<Pick<SkillWorkflowRun, "status" | "input" | "output" | "steps" | "metadata" | "endedAt">>): SkillWorkflowRun | null {
    const current = this.getRunById(id);
    if (!current) {
      return null;
    }

    const nextEndedAt = input.endedAt === undefined
      ? input.status && input.status !== "running"
        ? nowIso()
        : current.endedAt
      : input.endedAt;

    this.db.prepare(
      `UPDATE skill_workflow_runs
       SET status = ?, input_json = ?, output_json = ?, steps_json = ?, metadata_json = ?, updated_at = ?, ended_at = ?
       WHERE id = ?`
    ).run(
      input.status ?? current.status,
      JSON.stringify(input.input ?? current.input),
      JSON.stringify(input.output ?? current.output),
      JSON.stringify(input.steps ?? current.steps),
      JSON.stringify(input.metadata === undefined ? current.metadata : normalizeSkillWorkflowRunMetadata(input.metadata, current.metadata.workflowName)),
      nowIso(),
      nextEndedAt,
      id
    );

    return this.getRunById(id);
  }

  getRunById(id: string): SkillWorkflowRun | null {
    const row = this.db.prepare("SELECT * FROM skill_workflow_runs WHERE id = ?").get(id) as WorkflowRunRow | undefined;
    return row ? toRun(row) : null;
  }

  listRuns(workflowId: string): SkillWorkflowRun[] {
    const rows = this.db.prepare(
      "SELECT * FROM skill_workflow_runs WHERE workflow_id = ? ORDER BY updated_at DESC, started_at DESC"
    ).all(workflowId) as WorkflowRunRow[];
    return rows.map(toRun);
  }
}
