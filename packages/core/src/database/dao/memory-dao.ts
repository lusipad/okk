import type { MemoryAccessLog, MemoryEntry, MemoryStatus, MemoryType } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface MemoryEntryRow {
  id: string;
  user_id: string;
  repo_id: string | null;
  memory_type: MemoryType;
  title: string;
  content: string;
  summary: string;
  confidence: number;
  status: MemoryStatus;
  source_kind: "conversation" | "claude-md" | "knowledge" | "manual";
  source_ref: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

interface MemoryAccessLogRow {
  id: string;
  memory_id: string;
  session_id: string | null;
  access_kind: "injected" | "viewed" | "edited" | "confirmed";
  created_at: string;
}

export interface UpsertMemoryInput {
  userId: string;
  repoId?: string | null;
  memoryType: MemoryType;
  title: string;
  content: string;
  summary: string;
  confidence?: number;
  status?: MemoryStatus;
  sourceKind?: "conversation" | "claude-md" | "knowledge" | "manual";
  sourceRef?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListMemoryInput {
  userId: string;
  repoId?: string | null;
  memoryType?: MemoryType;
  status?: MemoryStatus;
  limit?: number;
}

export interface LogMemoryAccessInput {
  memoryId: string;
  sessionId?: string | null;
  accessKind: "injected" | "viewed" | "edited" | "confirmed";
}

const parseObject = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
};

const toMemoryEntry = (row: MemoryEntryRow): MemoryEntry => ({
  id: row.id,
  userId: row.user_id,
  repoId: row.repo_id,
  memoryType: row.memory_type,
  title: row.title,
  content: row.content,
  summary: row.summary,
  confidence: row.confidence,
  status: row.status,
  sourceKind: row.source_kind,
  sourceRef: row.source_ref,
  metadata: parseObject(row.metadata),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toMemoryAccessLog = (row: MemoryAccessLogRow): MemoryAccessLog => ({
  id: row.id,
  memoryId: row.memory_id,
  sessionId: row.session_id,
  accessKind: row.access_kind,
  createdAt: row.created_at
});

export class MemoryDao {
  constructor(private readonly db: SqliteConnection) {}

  upsert(input: UpsertMemoryInput): MemoryEntry {
    const existing = this.db.prepare(
      `SELECT * FROM memory_entries
       WHERE user_id = ? AND COALESCE(repo_id, '') = COALESCE(?, '') AND memory_type = ? AND title = ?`
    ).get(input.userId, input.repoId ?? null, input.memoryType, input.title) as MemoryEntryRow | undefined;

    const timestamp = nowIso();

    if (existing) {
      this.db.prepare(
        `UPDATE memory_entries
         SET content = ?, summary = ?, confidence = ?, status = ?, source_kind = ?, source_ref = ?, metadata = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        input.content,
        input.summary,
        input.confidence ?? existing.confidence,
        input.status ?? existing.status,
        input.sourceKind ?? existing.source_kind,
        input.sourceRef ?? existing.source_ref,
        JSON.stringify(input.metadata ?? parseObject(existing.metadata)),
        timestamp,
        existing.id
      );

      const updated = this.getById(existing.id);
      if (!updated) {
        throw new Error("Failed to update memory entry");
      }
      return updated;
    }

    const id = generateId();
    this.db.prepare(
      `INSERT INTO memory_entries(
        id, user_id, repo_id, memory_type, title, content, summary, confidence, status, source_kind, source_ref, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.userId,
      input.repoId ?? null,
      input.memoryType,
      input.title,
      input.content,
      input.summary,
      input.confidence ?? 0.6,
      input.status ?? "active",
      input.sourceKind ?? "conversation",
      input.sourceRef ?? null,
      JSON.stringify(input.metadata ?? {}),
      timestamp,
      timestamp
    );

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create memory entry");
    }
    return created;
  }

  getById(id: string): MemoryEntry | null {
    const row = this.db.prepare("SELECT * FROM memory_entries WHERE id = ?").get(id) as MemoryEntryRow | undefined;
    return row ? toMemoryEntry(row) : null;
  }

  list(input: ListMemoryInput): MemoryEntry[] {
    const clauses = ["user_id = ?"];
    const params = [input.userId] as Array<string | number | null>;

    if (input.repoId !== undefined) {
      if (input.repoId === null) {
        clauses.push("repo_id IS NULL");
      } else {
        clauses.push("repo_id = ?");
        params.push(input.repoId);
      }
    }

    if (input.memoryType) {
      clauses.push("memory_type = ?");
      params.push(input.memoryType);
    }

    if (input.status) {
      clauses.push("status = ?");
      params.push(input.status);
    }

    let sql = `SELECT * FROM memory_entries WHERE ${clauses.join(" AND ")} ORDER BY confidence DESC, updated_at DESC`;
    if (typeof input.limit === "number" && input.limit > 0) {
      sql += " LIMIT ?";
      params.push(input.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as MemoryEntryRow[];
    return rows.map(toMemoryEntry);
  }

  listRelevant(userId: string, repoId: string | null, limit = 5): MemoryEntry[] {
    const rows = this.db.prepare(
      `SELECT * FROM memory_entries
       WHERE user_id = ?
         AND status = 'active'
         AND (repo_id = ? OR repo_id IS NULL)
       ORDER BY CASE WHEN repo_id = ? THEN 1 ELSE 0 END DESC, confidence DESC, updated_at DESC
       LIMIT ?`
    ).all(userId, repoId, repoId, limit) as MemoryEntryRow[];
    return rows.map(toMemoryEntry);
  }

  update(id: string, input: Partial<Pick<MemoryEntry, "title" | "content" | "summary" | "confidence" | "status">>): MemoryEntry | null {
    const current = this.getById(id);
    if (!current) {
      return null;
    }

    this.db.prepare(
      `UPDATE memory_entries
       SET title = ?, content = ?, summary = ?, confidence = ?, status = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.title ?? current.title,
      input.content ?? current.content,
      input.summary ?? current.summary,
      input.confidence ?? current.confidence,
      input.status ?? current.status,
      nowIso(),
      id
    );

    return this.getById(id);
  }

  logAccess(input: LogMemoryAccessInput): MemoryAccessLog {
    const id = generateId();
    const createdAt = nowIso();
    this.db.prepare(
      `INSERT INTO memory_access_log(id, memory_id, session_id, access_kind, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.memoryId, input.sessionId ?? null, input.accessKind, createdAt);

    const row = this.db.prepare("SELECT * FROM memory_access_log WHERE id = ?").get(id) as MemoryAccessLogRow | undefined;
    if (!row) {
      throw new Error("Failed to log memory access");
    }
    return toMemoryAccessLog(row);
  }
}
