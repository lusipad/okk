import fs from "node:fs";
import type { WorkspaceRecord, WorkspaceRepositoryBinding } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  active_repo_id: string | null;
  recent_repo_ids_json: string;
  created_at: string;
  updated_at: string;
}

interface WorkspaceRepositoryRow {
  workspace_id: string;
  repo_id: string;
  position: number;
  added_at: string;
}

export interface CreateWorkspaceInput {
  id?: string;
  name: string;
  description?: string | null;
  repoIds?: string[];
  activeRepoId?: string | null;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string | null;
  repoIds?: string[];
  activeRepoId?: string | null;
}

const parseStringArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export class WorkspacesDao {
  constructor(private readonly db: SqliteConnection) {}

  list(): WorkspaceRecord[] {
    const rows = this.db.prepare("SELECT * FROM workspaces ORDER BY updated_at DESC, created_at DESC").all() as WorkspaceRow[];
    return rows.map((row) => this.toWorkspace(row));
  }

  getById(id: string): WorkspaceRecord | null {
    const row = this.db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as WorkspaceRow | undefined;
    return row ? this.toWorkspace(row) : null;
  }

  getByRepositoryId(repoId: string): WorkspaceRecord | null {
    const row = this.db.prepare(
      `SELECT w.*
       FROM workspaces w
       JOIN workspace_repositories wr ON wr.workspace_id = w.id
       WHERE wr.repo_id = ?
       ORDER BY w.updated_at DESC
       LIMIT 1`
    ).get(repoId) as WorkspaceRow | undefined;
    return row ? this.toWorkspace(row) : null;
  }

  create(input: CreateWorkspaceInput): WorkspaceRecord {
    const id = input.id ?? generateId();
    const createdAt = nowIso();
    const repoIds = Array.from(new Set((input.repoIds ?? []).map((item) => item.trim()).filter(Boolean)));
    const activeRepoId = input.activeRepoId && repoIds.includes(input.activeRepoId) ? input.activeRepoId : repoIds[0] ?? null;

    const tx = this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO workspaces(id, name, description, active_repo_id, recent_repo_ids_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, input.name.trim(), input.description ?? null, activeRepoId, JSON.stringify(activeRepoId ? [activeRepoId] : []), createdAt, createdAt);
      this.replaceRepositories(id, repoIds);
    });

    tx();
    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create workspace");
    }
    return created;
  }

  update(id: string, input: UpdateWorkspaceInput): WorkspaceRecord | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const nextRepoIds = input.repoIds
      ? Array.from(new Set(input.repoIds.map((item) => item.trim()).filter(Boolean)))
      : existing.repoIds;
    const nextActiveRepoId =
      input.activeRepoId !== undefined
        ? input.activeRepoId && nextRepoIds.includes(input.activeRepoId)
          ? input.activeRepoId
          : null
        : existing.activeRepoId && nextRepoIds.includes(existing.activeRepoId)
          ? existing.activeRepoId
          : nextRepoIds[0] ?? null;
    const recentRepoIds = nextActiveRepoId
      ? [nextActiveRepoId, ...existing.recentRepoIds.filter((item) => item !== nextActiveRepoId)].slice(0, 8)
      : existing.recentRepoIds;

    const tx = this.db.transaction(() => {
      this.db.prepare(
        `UPDATE workspaces
         SET name = ?, description = ?, active_repo_id = ?, recent_repo_ids_json = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        input.name?.trim() || existing.name,
        input.description === undefined ? existing.description : input.description,
        nextActiveRepoId,
        JSON.stringify(recentRepoIds),
        nowIso(),
        id
      );

      if (input.repoIds) {
        this.replaceRepositories(id, nextRepoIds);
      }
    });

    tx();
    return this.getById(id);
  }

  delete(id: string): boolean {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM workspace_repositories WHERE workspace_id = ?").run(id);
      return this.db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    });
    const result = tx() as { changes: number };
    return result.changes > 0;
  }

  activateRepo(workspaceId: string, repoId: string): WorkspaceRecord | null {
    const current = this.getById(workspaceId);
    if (!current || !current.repoIds.includes(repoId)) {
      return null;
    }
    return this.update(workspaceId, { activeRepoId: repoId });
  }

  listRepositoryBindings(workspaceId: string): WorkspaceRepositoryBinding[] {
    const rows = this.db.prepare(
      "SELECT * FROM workspace_repositories WHERE workspace_id = ? ORDER BY position ASC, added_at ASC"
    ).all(workspaceId) as WorkspaceRepositoryRow[];
    return rows.map((row) => ({
      workspaceId: row.workspace_id,
      repoId: row.repo_id,
      position: row.position,
      addedAt: row.added_at
    }));
  }

  listRepositoryStatus(workspaceId: string): Array<{ repoId: string; name: string; path: string; exists: boolean; isActive: boolean }> {
    const workspace = this.getById(workspaceId);
    if (!workspace) {
      return [];
    }

    const rows = this.db.prepare(
      `SELECT r.id, r.name, r.path
       FROM workspace_repositories wr
       JOIN repositories r ON r.id = wr.repo_id
       WHERE wr.workspace_id = ?
       ORDER BY wr.position ASC, wr.added_at ASC`
    ).all(workspaceId) as Array<{ id: string; name: string; path: string }>;

    return rows.map((row) => ({
      repoId: row.id,
      name: row.name,
      path: row.path,
      exists: fs.existsSync(row.path),
      isActive: workspace.activeRepoId === row.id
    }));
  }

  private replaceRepositories(workspaceId: string, repoIds: string[]): void {
    this.db.prepare("DELETE FROM workspace_repositories WHERE workspace_id = ?").run(workspaceId);
    const insert = this.db.prepare(
      `INSERT INTO workspace_repositories(workspace_id, repo_id, position, added_at)
       VALUES (?, ?, ?, ?)`
    );
    const timestamp = nowIso();
    repoIds.forEach((repoId, index) => {
      insert.run(workspaceId, repoId, index, timestamp);
    });
  }

  private toWorkspace(row: WorkspaceRow): WorkspaceRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      activeRepoId: row.active_repo_id,
      repoIds: this.listRepositoryBindings(row.id).map((item) => item.repoId),
      recentRepoIds: parseStringArray(row.recent_repo_ids_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
