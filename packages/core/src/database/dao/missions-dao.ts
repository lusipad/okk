import type {
  Mission,
  MissionCheckpoint,
  MissionCheckpointStatus,
  MissionCheckpointType,
  MissionHandoff,
  MissionHandoffStatus,
  MissionPhase,
  MissionStatus,
  MissionSummary,
  MissionWorkstream,
  MissionWorkstreamStatus
} from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface MissionRow {
  id: string;
  session_id: string | null;
  workspace_id: string | null;
  repo_id: string | null;
  title: string;
  goal: string;
  summary: string;
  mission_status: MissionStatus;
  mission_phase: MissionPhase;
  owner_partner_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface MissionWorkstreamRow {
  id: string;
  mission_id: string;
  team_run_id: string | null;
  title: string;
  description: string | null;
  assignee_partner_id: string;
  workstream_status: MissionWorkstreamStatus;
  order_index: number;
  depends_on_workstream_ids_json: string;
  output_summary: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MissionCheckpointRow {
  id: string;
  mission_id: string;
  workstream_id: string | null;
  checkpoint_type: MissionCheckpointType;
  title: string;
  summary: string;
  checkpoint_status: MissionCheckpointStatus;
  requires_user_action: number;
  created_by_partner_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MissionHandoffRow {
  id: string;
  mission_id: string;
  from_workstream_id: string;
  to_partner_id: string;
  reason: string;
  payload_summary: string | null;
  handoff_status: MissionHandoffStatus;
  created_at: string;
  updated_at: string;
}

interface MissionSummaryRow extends MissionRow {
  partner_count: number;
  workstream_total: number;
  workstream_completed: number;
  blocked_count: number;
  open_checkpoint_count: number;
}

export interface CreateMissionInput {
  id?: string;
  sessionId?: string | null;
  workspaceId?: string | null;
  repoId?: string | null;
  title: string;
  goal: string;
  summary?: string;
  status?: MissionStatus;
  phase?: MissionPhase;
  ownerPartnerId?: string | null;
  createdByUserId: string;
}

export interface UpdateMissionInput {
  title?: string;
  goal?: string;
  summary?: string;
  status?: MissionStatus;
  phase?: MissionPhase;
  ownerPartnerId?: string | null;
  sessionId?: string | null;
  workspaceId?: string | null;
  repoId?: string | null;
}

export interface ListMissionsInput {
  status?: MissionStatus;
  repoId?: string;
  sessionId?: string;
  limit?: number;
}

export interface UpsertMissionWorkstreamInput {
  id?: string;
  missionId: string;
  teamRunId?: string | null;
  title: string;
  description?: string | null;
  assigneePartnerId: string;
  status?: MissionWorkstreamStatus;
  orderIndex?: number;
  dependsOnWorkstreamIds?: string[];
  outputSummary?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface UpdateMissionWorkstreamInput {
  title?: string;
  description?: string | null;
  assigneePartnerId?: string;
  status?: MissionWorkstreamStatus;
  orderIndex?: number;
  dependsOnWorkstreamIds?: string[];
  outputSummary?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  teamRunId?: string | null;
}

export interface CreateMissionCheckpointInput {
  id?: string;
  missionId: string;
  workstreamId?: string | null;
  type: MissionCheckpointType;
  title: string;
  summary: string;
  status?: MissionCheckpointStatus;
  requiresUserAction?: boolean;
  createdByPartnerId?: string | null;
}

export interface UpdateMissionCheckpointInput {
  title?: string;
  summary?: string;
  status?: MissionCheckpointStatus;
  requiresUserAction?: boolean;
  resolvedAt?: string | null;
}

export interface CreateMissionHandoffInput {
  id?: string;
  missionId: string;
  fromWorkstreamId: string;
  toPartnerId: string;
  reason: string;
  payloadSummary?: string | null;
  status?: MissionHandoffStatus;
}

const parseStringArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const normalizeStringArray = (value: string[] | undefined): string[] =>
  Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));

const toMission = (row: MissionRow): Mission => ({
  id: row.id,
  sessionId: row.session_id,
  workspaceId: row.workspace_id,
  repoId: row.repo_id,
  title: row.title,
  goal: row.goal,
  summary: row.summary,
  status: row.mission_status,
  phase: row.mission_phase,
  ownerPartnerId: row.owner_partner_id,
  createdByUserId: row.created_by_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toMissionWorkstream = (row: MissionWorkstreamRow): MissionWorkstream => ({
  id: row.id,
  missionId: row.mission_id,
  teamRunId: row.team_run_id,
  title: row.title,
  description: row.description,
  assigneePartnerId: row.assignee_partner_id,
  status: row.workstream_status,
  orderIndex: row.order_index,
  dependsOnWorkstreamIds: parseStringArray(row.depends_on_workstream_ids_json),
  outputSummary: row.output_summary,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toMissionCheckpoint = (row: MissionCheckpointRow): MissionCheckpoint => ({
  id: row.id,
  missionId: row.mission_id,
  workstreamId: row.workstream_id,
  type: row.checkpoint_type,
  title: row.title,
  summary: row.summary,
  status: row.checkpoint_status,
  requiresUserAction: row.requires_user_action === 1,
  createdByPartnerId: row.created_by_partner_id,
  resolvedAt: row.resolved_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toMissionHandoff = (row: MissionHandoffRow): MissionHandoff => ({
  id: row.id,
  missionId: row.mission_id,
  fromWorkstreamId: row.from_workstream_id,
  toPartnerId: row.to_partner_id,
  reason: row.reason,
  payloadSummary: row.payload_summary,
  status: row.handoff_status,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toMissionSummary = (row: MissionSummaryRow): MissionSummary => ({
  id: row.id,
  title: row.title,
  goal: row.goal,
  status: row.mission_status,
  phase: row.mission_phase,
  repoId: row.repo_id,
  sessionId: row.session_id,
  ownerPartnerId: row.owner_partner_id,
  partnerCount: row.partner_count,
  workstreamTotal: row.workstream_total,
  workstreamCompleted: row.workstream_completed,
  blockedCount: row.blocked_count,
  openCheckpointCount: row.open_checkpoint_count,
  updatedAt: row.updated_at
});

export class MissionsDao {
  constructor(private readonly db: SqliteConnection) {}

  create(input: CreateMissionInput): Mission {
    const id = input.id ?? generateId();
    const timestamp = nowIso();
    this.db.prepare(
      `INSERT INTO missions(
        id, session_id, workspace_id, repo_id, title, goal, summary, mission_status, mission_phase, owner_partner_id, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.sessionId ?? null,
      input.workspaceId ?? null,
      input.repoId ?? null,
      input.title.trim(),
      input.goal.trim(),
      input.summary?.trim() ?? "",
      input.status ?? "draft",
      input.phase ?? "align",
      input.ownerPartnerId ?? null,
      input.createdByUserId,
      timestamp,
      timestamp
    );
    return this.getById(id) ?? (() => { throw new Error("Failed to create mission"); })();
  }

  getById(id: string): Mission | null {
    const row = this.db.prepare("SELECT * FROM missions WHERE id = ?").get(id) as MissionRow | undefined;
    return row ? toMission(row) : null;
  }

  getBySessionId(sessionId: string): Mission | null {
    const row = this.db.prepare("SELECT * FROM missions WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1").get(sessionId) as MissionRow | undefined;
    return row ? toMission(row) : null;
  }

  list(input: ListMissionsInput = {}): Mission[] {
    const clauses: string[] = ["1=1"];
    const values: Array<string | number> = [];

    if (input.status) {
      clauses.push("mission_status = ?");
      values.push(input.status);
    }
    if (input.repoId) {
      clauses.push("repo_id = ?");
      values.push(input.repoId);
    }
    if (input.sessionId) {
      clauses.push("session_id = ?");
      values.push(input.sessionId);
    }

    let sql = `SELECT * FROM missions WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC, created_at DESC`;
    if (typeof input.limit === "number" && input.limit > 0) {
      sql += " LIMIT ?";
      values.push(input.limit);
    }

    const rows = this.db.prepare(sql).all(...values) as MissionRow[];
    return rows.map(toMission);
  }

  listSummaries(input: ListMissionsInput = {}): MissionSummary[] {
    const clauses: string[] = ["1=1"];
    const values: Array<string | number> = [];
    if (input.status) {
      clauses.push("m.mission_status = ?");
      values.push(input.status);
    }
    if (input.repoId) {
      clauses.push("m.repo_id = ?");
      values.push(input.repoId);
    }
    if (input.sessionId) {
      clauses.push("m.session_id = ?");
      values.push(input.sessionId);
    }
    let sql = `
      SELECT
        m.*,
        COUNT(DISTINCT ws.assignee_partner_id) AS partner_count,
        COUNT(DISTINCT ws.id) AS workstream_total,
        SUM(CASE WHEN ws.workstream_status = 'completed' THEN 1 ELSE 0 END) AS workstream_completed,
        SUM(CASE WHEN ws.workstream_status = 'blocked' OR ws.workstream_status = 'failed' THEN 1 ELSE 0 END) AS blocked_count,
        SUM(CASE WHEN cp.checkpoint_status = 'open' AND cp.requires_user_action = 1 THEN 1 ELSE 0 END) AS open_checkpoint_count
      FROM missions m
      LEFT JOIN mission_workstreams ws ON ws.mission_id = m.id
      LEFT JOIN mission_checkpoints cp ON cp.mission_id = m.id
      WHERE ${clauses.join(" AND ")}
      GROUP BY m.id
      ORDER BY m.updated_at DESC, m.created_at DESC
    `;
    if (typeof input.limit === "number" && input.limit > 0) {
      sql += " LIMIT ?";
      values.push(input.limit);
    }
    const rows = this.db.prepare(sql).all(...values) as MissionSummaryRow[];
    return rows.map((row) =>
      toMissionSummary({
        ...row,
        partner_count: Number(row.partner_count ?? 0),
        workstream_total: Number(row.workstream_total ?? 0),
        workstream_completed: Number(row.workstream_completed ?? 0),
        blocked_count: Number(row.blocked_count ?? 0),
        open_checkpoint_count: Number(row.open_checkpoint_count ?? 0)
      })
    );
  }

  update(id: string, input: UpdateMissionInput): Mission | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }
    this.db.prepare(
      `UPDATE missions
       SET session_id = ?, workspace_id = ?, repo_id = ?, title = ?, goal = ?, summary = ?, mission_status = ?, mission_phase = ?, owner_partner_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.sessionId === undefined ? existing.sessionId : input.sessionId,
      input.workspaceId === undefined ? existing.workspaceId : input.workspaceId,
      input.repoId === undefined ? existing.repoId : input.repoId,
      input.title?.trim() ?? existing.title,
      input.goal?.trim() ?? existing.goal,
      input.summary?.trim() ?? existing.summary,
      input.status ?? existing.status,
      input.phase ?? existing.phase,
      input.ownerPartnerId === undefined ? existing.ownerPartnerId : input.ownerPartnerId,
      nowIso(),
      id
    );
    return this.getById(id);
  }

  upsertWorkstream(input: UpsertMissionWorkstreamInput): MissionWorkstream {
    if (input.id) {
      const updated = this.updateWorkstream(input.id, input);
      if (updated) {
        return updated;
      }
    }
    const id = input.id ?? generateId();
    const timestamp = nowIso();
    this.db.prepare(
      `INSERT INTO mission_workstreams(
        id, mission_id, team_run_id, title, description, assignee_partner_id, workstream_status, order_index, depends_on_workstream_ids_json, output_summary, started_at, ended_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.missionId,
      input.teamRunId ?? null,
      input.title.trim(),
      input.description ?? null,
      input.assigneePartnerId,
      input.status ?? "queued",
      input.orderIndex ?? 0,
      JSON.stringify(normalizeStringArray(input.dependsOnWorkstreamIds)),
      input.outputSummary ?? null,
      input.startedAt ?? null,
      input.endedAt ?? null,
      timestamp,
      timestamp
    );
    return this.getWorkstreamById(id) ?? (() => { throw new Error("Failed to create workstream"); })();
  }

  getWorkstreamById(id: string): MissionWorkstream | null {
    const row = this.db.prepare("SELECT * FROM mission_workstreams WHERE id = ?").get(id) as MissionWorkstreamRow | undefined;
    return row ? toMissionWorkstream(row) : null;
  }

  listWorkstreams(missionId: string): MissionWorkstream[] {
    const rows = this.db.prepare("SELECT * FROM mission_workstreams WHERE mission_id = ? ORDER BY order_index ASC, created_at ASC").all(missionId) as MissionWorkstreamRow[];
    return rows.map(toMissionWorkstream);
  }

  updateWorkstream(id: string, input: Partial<UpsertMissionWorkstreamInput> & UpdateMissionWorkstreamInput): MissionWorkstream | null {
    const existing = this.getWorkstreamById(id);
    if (!existing) {
      return null;
    }
    this.db.prepare(
      `UPDATE mission_workstreams
       SET team_run_id = ?, title = ?, description = ?, assignee_partner_id = ?, workstream_status = ?, order_index = ?, depends_on_workstream_ids_json = ?, output_summary = ?, started_at = ?, ended_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.teamRunId === undefined ? existing.teamRunId : input.teamRunId,
      input.title?.trim() ?? existing.title,
      input.description === undefined ? existing.description : input.description,
      input.assigneePartnerId ?? existing.assigneePartnerId,
      input.status ?? existing.status,
      input.orderIndex ?? existing.orderIndex,
      JSON.stringify(input.dependsOnWorkstreamIds === undefined ? existing.dependsOnWorkstreamIds : normalizeStringArray(input.dependsOnWorkstreamIds)),
      input.outputSummary === undefined ? existing.outputSummary : input.outputSummary,
      input.startedAt === undefined ? existing.startedAt : input.startedAt,
      input.endedAt === undefined ? existing.endedAt : input.endedAt,
      nowIso(),
      id
    );
    return this.getWorkstreamById(id);
  }

  createCheckpoint(input: CreateMissionCheckpointInput): MissionCheckpoint {
    const id = input.id ?? generateId();
    const timestamp = nowIso();
    this.db.prepare(
      `INSERT INTO mission_checkpoints(
        id, mission_id, workstream_id, checkpoint_type, title, summary, checkpoint_status, requires_user_action, created_by_partner_id, resolved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.missionId,
      input.workstreamId ?? null,
      input.type,
      input.title.trim(),
      input.summary.trim(),
      input.status ?? "open",
      input.requiresUserAction === false ? 0 : 1,
      input.createdByPartnerId ?? null,
      null,
      timestamp,
      timestamp
    );
    return this.getCheckpointById(id) ?? (() => { throw new Error("Failed to create checkpoint"); })();
  }

  getCheckpointById(id: string): MissionCheckpoint | null {
    const row = this.db.prepare("SELECT * FROM mission_checkpoints WHERE id = ?").get(id) as MissionCheckpointRow | undefined;
    return row ? toMissionCheckpoint(row) : null;
  }

  listCheckpoints(missionId: string): MissionCheckpoint[] {
    const rows = this.db.prepare("SELECT * FROM mission_checkpoints WHERE mission_id = ? ORDER BY updated_at DESC, created_at DESC").all(missionId) as MissionCheckpointRow[];
    return rows.map(toMissionCheckpoint);
  }

  updateCheckpoint(id: string, input: UpdateMissionCheckpointInput): MissionCheckpoint | null {
    const existing = this.getCheckpointById(id);
    if (!existing) {
      return null;
    }
    this.db.prepare(
      `UPDATE mission_checkpoints
       SET title = ?, summary = ?, checkpoint_status = ?, requires_user_action = ?, resolved_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.title?.trim() ?? existing.title,
      input.summary?.trim() ?? existing.summary,
      input.status ?? existing.status,
      input.requiresUserAction === undefined ? (existing.requiresUserAction ? 1 : 0) : input.requiresUserAction ? 1 : 0,
      input.resolvedAt === undefined ? existing.resolvedAt : input.resolvedAt,
      nowIso(),
      id
    );
    return this.getCheckpointById(id);
  }

  resolveCheckpoint(id: string): MissionCheckpoint | null {
    return this.updateCheckpoint(id, { status: "resolved", resolvedAt: nowIso() });
  }

  createHandoff(input: CreateMissionHandoffInput): MissionHandoff {
    const id = input.id ?? generateId();
    const timestamp = nowIso();
    this.db.prepare(
      `INSERT INTO mission_handoffs(
        id, mission_id, from_workstream_id, to_partner_id, reason, payload_summary, handoff_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.missionId,
      input.fromWorkstreamId,
      input.toPartnerId,
      input.reason.trim(),
      input.payloadSummary ?? null,
      input.status ?? "pending",
      timestamp,
      timestamp
    );
    return this.getHandoffById(id) ?? (() => { throw new Error("Failed to create handoff"); })();
  }

  getHandoffById(id: string): MissionHandoff | null {
    const row = this.db.prepare("SELECT * FROM mission_handoffs WHERE id = ?").get(id) as MissionHandoffRow | undefined;
    return row ? toMissionHandoff(row) : null;
  }

  listHandoffs(missionId: string): MissionHandoff[] {
    const rows = this.db.prepare("SELECT * FROM mission_handoffs WHERE mission_id = ? ORDER BY updated_at DESC, created_at DESC").all(missionId) as MissionHandoffRow[];
    return rows.map(toMissionHandoff);
  }
}
