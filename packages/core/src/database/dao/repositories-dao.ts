import type { BackendName, Repository } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface RepositoryRow {
  id: string;
  name: string;
  path: string;
  description: string | null;
  default_backend: string;
  status: "active" | "archived";
  created_at: string;
  context_snapshot_json?: string | null;
  last_activity_at?: string | null;
}

interface RepoActivityRow {
  id: string;
  repo_id: string;
  activity_type: string;
  summary: string;
  payload_json: string;
  created_at: string;
}

export interface RepositoryContextSnapshot {
  preferredAgentId?: string | null;
  preferredAgentName?: string | null;
  preferredBackend?: BackendName | null;
  preferredMode?: string | null;
  preferredSkillIds: string[];
  preferredMcpServerIds: string[];
  lastSessionId?: string | null;
  lastActivitySummary?: string | null;
  continuePrompt?: string | null;
  lastUpdatedAt?: string | null;
}

export interface RepoActivityRecord {
  id: string;
  repoId: string;
  activityType: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface UpdateRepositoryContextInput {
  preferredAgentId?: string | null;
  preferredAgentName?: string | null;
  preferredBackend?: BackendName | null;
  preferredMode?: string | null;
  preferredSkillIds?: string[];
  preferredMcpServerIds?: string[];
  lastSessionId?: string | null;
  lastActivitySummary?: string | null;
  continuePrompt?: string | null;
}

export interface AppendRepositoryActivityInput {
  activityType: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface CreateRepositoryInput {
  id?: string;
  name: string;
  path: string;
  description?: string | null;
  defaultBackend?: BackendName;
  status?: "active" | "archived";
}

const emptySnapshot = (): RepositoryContextSnapshot => ({
  preferredSkillIds: [],
  preferredMcpServerIds: []
});

const parseSnapshot = (value: string | null | undefined): RepositoryContextSnapshot => {
  if (!value) {
    return emptySnapshot();
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      preferredAgentId: typeof parsed.preferredAgentId === "string" ? parsed.preferredAgentId : null,
      preferredAgentName: typeof parsed.preferredAgentName === "string" ? parsed.preferredAgentName : null,
      preferredBackend: typeof parsed.preferredBackend === "string" ? (parsed.preferredBackend as BackendName) : null,
      preferredMode: typeof parsed.preferredMode === "string" ? parsed.preferredMode : null,
      preferredSkillIds: Array.isArray(parsed.preferredSkillIds)
        ? parsed.preferredSkillIds.filter((item): item is string => typeof item === "string")
        : [],
      preferredMcpServerIds: Array.isArray(parsed.preferredMcpServerIds)
        ? parsed.preferredMcpServerIds.filter((item): item is string => typeof item === "string")
        : [],
      lastSessionId: typeof parsed.lastSessionId === "string" ? parsed.lastSessionId : null,
      lastActivitySummary: typeof parsed.lastActivitySummary === "string" ? parsed.lastActivitySummary : null,
      continuePrompt: typeof parsed.continuePrompt === "string" ? parsed.continuePrompt : null,
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : null
    };
  } catch {
    return emptySnapshot();
  }
};

const toRepository = (row: RepositoryRow): Repository => ({
  id: row.id,
  name: row.name,
  path: row.path,
  description: row.description,
  defaultBackend: row.default_backend as BackendName,
  status: row.status,
  createdAt: row.created_at
});

const toActivityRecord = (row: RepoActivityRow): RepoActivityRecord => ({
  id: row.id,
  repoId: row.repo_id,
  activityType: row.activity_type,
  summary: row.summary,
  payload: JSON.parse(row.payload_json || "{}") as Record<string, unknown>,
  createdAt: row.created_at
});

export class RepositoriesDao {
  constructor(private readonly db: SqliteConnection) {}

  create(input: CreateRepositoryInput): Repository {
    const id = input.id ?? generateId();
    const createdAt = nowIso();

    this.db
      .prepare(
        `INSERT INTO repositories(id, name, path, description, default_backend, status, created_at, context_snapshot_json, last_activity_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.path,
        input.description ?? null,
        input.defaultBackend ?? "claude-code",
        input.status ?? "active",
        createdAt,
        JSON.stringify(emptySnapshot()),
        null
      );

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create repository");
    }

    return created;
  }

  getById(id: string): Repository | null {
    const row = this.db
      .prepare("SELECT * FROM repositories WHERE id = ?")
      .get(id) as RepositoryRow | undefined;
    return row ? toRepository(row) : null;
  }

  getByPath(path: string): Repository | null {
    const row = this.db
      .prepare("SELECT * FROM repositories WHERE path = ?")
      .get(path) as RepositoryRow | undefined;
    return row ? toRepository(row) : null;
  }

  list(): Repository[] {
    const rows = this.db
      .prepare("SELECT * FROM repositories ORDER BY created_at ASC")
      .all() as RepositoryRow[];
    return rows.map(toRepository);
  }

  getContextSnapshot(repoId: string): RepositoryContextSnapshot {
    const row = this.db
      .prepare("SELECT context_snapshot_json FROM repositories WHERE id = ?")
      .get(repoId) as Pick<RepositoryRow, "context_snapshot_json"> | undefined;
    return parseSnapshot(row?.context_snapshot_json);
  }

  updateContextSnapshot(repoId: string, input: UpdateRepositoryContextInput): RepositoryContextSnapshot {
    const current = this.getContextSnapshot(repoId);
    const next: RepositoryContextSnapshot = {
      preferredAgentId: input.preferredAgentId ?? current.preferredAgentId ?? null,
      preferredAgentName: input.preferredAgentName ?? current.preferredAgentName ?? null,
      preferredBackend: input.preferredBackend ?? current.preferredBackend ?? null,
      preferredMode: input.preferredMode ?? current.preferredMode ?? null,
      preferredSkillIds: input.preferredSkillIds ?? current.preferredSkillIds,
      preferredMcpServerIds: input.preferredMcpServerIds ?? current.preferredMcpServerIds,
      lastSessionId: input.lastSessionId ?? current.lastSessionId ?? null,
      lastActivitySummary: input.lastActivitySummary ?? current.lastActivitySummary ?? null,
      continuePrompt: input.continuePrompt ?? current.continuePrompt ?? null,
      lastUpdatedAt: nowIso()
    };

    this.db
      .prepare("UPDATE repositories SET context_snapshot_json = ?, last_activity_at = ? WHERE id = ?")
      .run(JSON.stringify(next), next.lastUpdatedAt, repoId);

    return next;
  }

  appendActivity(repoId: string, input: AppendRepositoryActivityInput): RepoActivityRecord {
    const createdAt = nowIso();
    const id = generateId();

    this.db
      .prepare(
        `INSERT INTO repo_activity_log(id, repo_id, activity_type, summary, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, repoId, input.activityType, input.summary, JSON.stringify(input.payload ?? {}), createdAt);

    this.db
      .prepare("UPDATE repositories SET last_activity_at = ? WHERE id = ?")
      .run(createdAt, repoId);

    return {
      id,
      repoId,
      activityType: input.activityType,
      summary: input.summary,
      payload: input.payload ?? {},
      createdAt
    };
  }

  listRecentActivities(repoId: string, limit = 5): RepoActivityRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM repo_activity_log
         WHERE repo_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(repoId, limit) as RepoActivityRow[];
    return rows.map(toActivityRecord);
  }
}
