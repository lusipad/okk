import type { BackendName, Session } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface SessionRow {
  id: string;
  user_id: string;
  repo_id: string;
  title: string;
  summary: string;
  tags_json: string;
  backend: string;
  backend_session_id: string | null;
  mode: string;
  status: "active" | "done" | "aborted" | "error";
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionSearchRow extends SessionRow {
  match_snippet: string | null;
}

interface SessionReferenceRow {
  message_id: string;
  snippet: string;
  created_at: string;
}

export interface CreateSessionInput {
  id?: string;
  userId: string;
  repoId: string;
  title: string;
  summary?: string;
  tags?: string[];
  backend: BackendName;
  backendSessionId?: string | null;
  mode?: string;
  status?: "active" | "done" | "aborted" | "error";
}

export interface ListSessionsOptions {
  archived?: boolean;
  q?: string;
  tag?: string;
  limit?: number;
}

export interface SessionSearchResult {
  session: Session;
  matchSnippet?: string;
}

export interface SessionReferenceSnippet {
  messageId: string;
  snippet: string;
  createdAt: string;
}

const parseTags = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
};

const normalizeTags = (tags: string[] | undefined): string[] =>
  Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  userId: row.user_id,
  repoId: row.repo_id,
  title: row.title,
  summary: row.summary,
  tags: parseTags(row.tags_json),
  backend: row.backend as BackendName,
  backendSessionId: row.backend_session_id,
  mode: row.mode,
  status: row.status,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class SessionsDao {
  constructor(private readonly db: SqliteConnection) {}

  create(input: CreateSessionInput): Session {
    const id = input.id ?? generateId();
    const timestamp = nowIso();

    this.db
      .prepare(
        `INSERT INTO sessions(
          id, user_id, repo_id, title, summary, tags_json, backend, backend_session_id, mode, status, archived_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.userId,
        input.repoId,
        input.title,
        input.summary ?? "",
        JSON.stringify(normalizeTags(input.tags)),
        input.backend,
        input.backendSessionId ?? null,
        input.mode ?? "ask",
        input.status ?? "active",
        null,
        timestamp,
        timestamp
      );

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create session");
    }

    return created;
  }

  getById(id: string): Session | null {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as SessionRow | undefined;
    return row ? toSession(row) : null;
  }

  listByUserId(userId: string, options: ListSessionsOptions = {}): Session[] {
    const { archived = false, tag, limit } = options;
    const clauses = ["user_id = ?", archived ? "archived_at IS NOT NULL" : "archived_at IS NULL"];
    const values = [userId] as Array<string | number>;

    if (tag && tag.trim().length > 0) {
      clauses.push("tags_json LIKE ?");
      values.push(`%\"${tag.trim()}\"%`);
    }

    let sql = `SELECT * FROM sessions WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC, created_at DESC`;
    if (typeof limit === "number" && limit > 0) {
      sql += " LIMIT ?";
      values.push(limit);
    }

    const rows = this.db.prepare(sql).all(...values) as SessionRow[];
    return rows.map(toSession);
  }

  searchByUserId(userId: string, options: ListSessionsOptions): SessionSearchResult[] {
    const query = options.q?.trim();
    if (!query) {
      return this.listByUserId(userId, options).map((session) => ({ session }));
    }

    const archived = options.archived === true;
    const tagFilter = options.tag?.trim();
    const rows = this.db
      .prepare(
        `
        SELECT DISTINCT s.*, COALESCE(sf.match_snippet, mf.match_snippet) AS match_snippet
        FROM sessions s
        LEFT JOIN (
          SELECT session_id, snippet(session_fts, 2, '<mark>', '</mark>', '…', 12) AS match_snippet
          FROM session_fts
          WHERE session_fts MATCH ?
        ) sf ON sf.session_id = s.id
        LEFT JOIN (
          SELECT session_id, snippet(messages_fts, 2, '<mark>', '</mark>', '…', 12) AS match_snippet
          FROM messages_fts
          WHERE messages_fts MATCH ?
        ) mf ON mf.session_id = s.id
        WHERE s.user_id = ?
          AND ${archived ? "s.archived_at IS NOT NULL" : "s.archived_at IS NULL"}
          AND (? = '' OR s.tags_json LIKE '%' || '"' || ? || '"' || '%')
          AND (sf.session_id IS NOT NULL OR mf.session_id IS NOT NULL)
        ORDER BY (CASE WHEN sf.session_id IS NOT NULL THEN 2 ELSE 0 END + CASE WHEN mf.session_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                 s.updated_at DESC,
                 s.created_at DESC
        LIMIT ?
        `
      )
      .all(query, query, userId, tagFilter ?? "", tagFilter ?? "", options.limit ?? 20) as SessionSearchRow[];

    return rows.map((row) => ({
      session: toSession(row),
      ...(row.match_snippet ? { matchSnippet: row.match_snippet } : {})
    }));
  }

  listReferenceSnippets(sessionId: string, query?: string, limit = 5): SessionReferenceSnippet[] {
    const trimmed = query?.trim();
    if (trimmed) {
      const rows = this.db
        .prepare(
          `
          SELECT message_id, snippet(messages_fts, 2, '<mark>', '</mark>', '…', 12) AS snippet, created_at
          FROM messages_fts
          JOIN messages ON messages.id = messages_fts.message_id
          WHERE messages_fts MATCH ?
            AND messages_fts.session_id = ?
          ORDER BY messages.created_at DESC
          LIMIT ?
          `
        )
        .all(trimmed, sessionId, limit) as SessionReferenceRow[];

      if (rows.length > 0) {
        return rows.map((row) => ({ messageId: row.message_id, snippet: row.snippet, createdAt: row.created_at }));
      }
    }

    const fallbackRows = this.db
      .prepare(
        `
        SELECT id AS message_id, substr(content, 1, 160) AS snippet, created_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        `
      )
      .all(sessionId, limit) as SessionReferenceRow[];

    return fallbackRows.map((row) => ({ messageId: row.message_id, snippet: row.snippet, createdAt: row.created_at }));
  }

  updateBackendSessionId(id: string, backendSessionId: string): void {
    this.db
      .prepare("UPDATE sessions SET backend_session_id = ?, updated_at = ? WHERE id = ?")
      .run(backendSessionId, nowIso(), id);
  }

  updateSummary(id: string, summary: string): void {
    this.db
      .prepare("UPDATE sessions SET summary = ?, updated_at = ? WHERE id = ?")
      .run(summary, nowIso(), id);
  }

  updateTags(id: string, tags: string[]): void {
    this.db
      .prepare("UPDATE sessions SET tags_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(normalizeTags(tags)), nowIso(), id);
  }

  archive(id: string): Session | null {
    this.db
      .prepare("UPDATE sessions SET archived_at = ?, updated_at = ? WHERE id = ?")
      .run(nowIso(), nowIso(), id);
    return this.getById(id);
  }

  restore(id: string): Session | null {
    this.db
      .prepare("UPDATE sessions SET archived_at = NULL, updated_at = ? WHERE id = ?")
      .run(nowIso(), id);
    return this.getById(id);
  }
}
