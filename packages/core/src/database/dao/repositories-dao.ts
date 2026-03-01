import type { BackendName, Repository } from "../../types.js";
import type { SqliteConnection } from "../sqlite-database.js";
import { generateId, nowIso } from "../../utils/id.js";

interface RepositoryRow {
  id: string;
  name: string;
  path: string;
  description: string | null;
  default_backend: string;
  status: "active" | "archived";
  created_at: string;
}

export interface CreateRepositoryInput {
  id?: string;
  name: string;
  path: string;
  description?: string | null;
  defaultBackend?: BackendName;
  status?: "active" | "archived";
}

const toRepository = (row: RepositoryRow): Repository => ({
  id: row.id,
  name: row.name,
  path: row.path,
  description: row.description,
  defaultBackend: row.default_backend as BackendName,
  status: row.status,
  createdAt: row.created_at
});

export class RepositoriesDao {
  constructor(private readonly db: SqliteConnection) {}

  create(input: CreateRepositoryInput): Repository {
    const id = input.id ?? generateId();
    const createdAt = nowIso();

    this.db
      .prepare(
        `INSERT INTO repositories(id, name, path, description, default_backend, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.path,
        input.description ?? null,
        input.defaultBackend ?? "claude-code",
        input.status ?? "active",
        createdAt
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
}

