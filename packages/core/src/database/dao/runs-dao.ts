import type { AgentRun, TeamRun } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface AgentRunRow {
  id: string;
  session_id: string;
  agent_name: string;
  input: string;
  output: string;
  status: "running" | "done" | "error";
  tool_call_count: number;
  iterations: number;
  usage_tokens: number;
  created_at: string;
  updated_at: string;
}

interface TeamRunRow {
  id: string;
  session_id: string;
  team_name: string;
  status: "running" | "done" | "error";
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateTeamRunInput {
  status?: "running" | "done" | "error";
  memberCount?: number;
}

export interface CreateAgentRunInput {
  id?: string;
  sessionId: string;
  agentName: string;
  input: string;
  output: string;
  status: "running" | "done" | "error";
  toolCallCount?: number;
  iterations?: number;
  usageTokens?: number;
}

export interface CreateTeamRunInput {
  id?: string;
  sessionId: string;
  teamName: string;
  status: "running" | "done" | "error";
  memberCount: number;
}

const toAgentRun = (row: AgentRunRow): AgentRun => ({
  id: row.id,
  sessionId: row.session_id,
  agentName: row.agent_name,
  input: row.input,
  output: row.output,
  status: row.status,
  toolCallCount: row.tool_call_count,
  iterations: row.iterations,
  usageTokens: row.usage_tokens,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toTeamRun = (row: TeamRunRow): TeamRun => ({
  id: row.id,
  sessionId: row.session_id,
  teamName: row.team_name,
  status: row.status,
  memberCount: row.member_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class RunsDao {
  constructor(private readonly db: SqliteConnection) {}

  createAgentRun(input: CreateAgentRunInput): AgentRun {
    const id = input.id ?? generateId();
    const timestamp = nowIso();

    this.db
      .prepare(
        `INSERT INTO agent_runs(
          id, session_id, agent_name, input, output, status, tool_call_count, iterations, usage_tokens, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.sessionId,
        input.agentName,
        input.input,
        input.output,
        input.status,
        input.toolCallCount ?? 0,
        input.iterations ?? 0,
        input.usageTokens ?? 0,
        timestamp,
        timestamp
      );

    const row = this.db
      .prepare("SELECT * FROM agent_runs WHERE id = ?")
      .get(id) as AgentRunRow | undefined;
    if (!row) {
      throw new Error("Failed to create agent run");
    }

    return toAgentRun(row);
  }

  createTeamRun(input: CreateTeamRunInput): TeamRun {
    const id = input.id ?? generateId();
    const timestamp = nowIso();

    this.db
      .prepare(
        `INSERT INTO team_runs(
          id, session_id, team_name, status, member_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.sessionId,
        input.teamName,
        input.status,
        input.memberCount,
        timestamp,
        timestamp
      );

    const row = this.db
      .prepare("SELECT * FROM team_runs WHERE id = ?")
      .get(id) as TeamRunRow | undefined;
    if (!row) {
      throw new Error("Failed to create team run");
    }

    return toTeamRun(row);
  }

  getTeamRunById(id: string): TeamRun | null {
    const row = this.db
      .prepare("SELECT * FROM team_runs WHERE id = ?")
      .get(id) as TeamRunRow | undefined;
    return row ? toTeamRun(row) : null;
  }

  listTeamRunsBySession(sessionId: string): TeamRun[] {
    const rows = this.db
      .prepare("SELECT * FROM team_runs WHERE session_id = ? ORDER BY updated_at DESC, id DESC")
      .all(sessionId) as TeamRunRow[];
    return rows.map(toTeamRun);
  }

  updateTeamRun(id: string, input: UpdateTeamRunInput): TeamRun | null {
    const current = this.getTeamRunById(id);
    if (!current) {
      return null;
    }

    const status = input.status ?? current.status;
    const memberCount = input.memberCount ?? current.memberCount;
    const updatedAt = nowIso();

    this.db
      .prepare(
        `UPDATE team_runs
         SET status = ?, member_count = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(status, memberCount, updatedAt, id);

    return this.getTeamRunById(id);
  }
}

