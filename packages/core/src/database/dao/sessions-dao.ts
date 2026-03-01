import type { BackendName, Session } from "../../types.js";
import type { SqliteConnection } from "../sqlite-database.js";
import { generateId, nowIso } from "../../utils/id.js";

interface SessionRow {
  id: string;
  user_id: string;
  repo_id: string;
  title: string;
  backend: string;
  backend_session_id: string | null;
  mode: string;
  status: "active" | "done" | "aborted" | "error";
  created_at: string;
  updated_at: string;
}

export interface CreateSessionInput {
  id?: string;
  userId: string;
  repoId: string;
  title: string;
  backend: BackendName;
  backendSessionId?: string | null;
  mode?: string;
  status?: "active" | "done" | "aborted" | "error";
}

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  userId: row.user_id,
  repoId: row.repo_id,
  title: row.title,
  backend: row.backend as BackendName,
  backendSessionId: row.backend_session_id,
  mode: row.mode,
  status: row.status,
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
          id, user_id, repo_id, title, backend, backend_session_id, mode, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.userId,
        input.repoId,
        input.title,
        input.backend,
        input.backendSessionId ?? null,
        input.mode ?? "ask",
        input.status ?? "active",
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

  listByUserId(userId: string): Session[] {
    const rows = this.db
      .prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at ASC")
      .all(userId) as SessionRow[];
    return rows.map(toSession);
  }

  updateBackendSessionId(id: string, backendSessionId: string): void {
    this.db
      .prepare("UPDATE sessions SET backend_session_id = ?, updated_at = ? WHERE id = ?")
      .run(backendSessionId, nowIso(), id);
  }
}

