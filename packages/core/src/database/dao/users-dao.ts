import type { User, UserRole } from "../../types.js";
import type { SqliteConnection } from "../sqlite-database.js";
import { generateId, nowIso } from "../../utils/id.js";

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export interface CreateUserInput {
  id?: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  role?: UserRole;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  displayName: row.display_name,
  role: row.role,
  createdAt: row.created_at
});

export class UsersDao {
  constructor(private readonly db: SqliteConnection) {}

  create(input: CreateUserInput): User {
    const id = input.id ?? generateId();
    const createdAt = nowIso();
    const role = input.role ?? "user";
    const displayName = input.displayName ?? input.username;

    this.db
      .prepare(
        `INSERT INTO users(id, username, password_hash, display_name, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.username, input.passwordHash, displayName, role, createdAt);

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create user");
    }

    return created;
  }

  getById(id: string): User | null {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  getByUsername(username: string): User | null {
    const row = this.db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  list(): User[] {
    const rows = this.db
      .prepare("SELECT * FROM users ORDER BY created_at ASC")
      .all() as UserRow[];
    return rows.map(toUser);
  }
}

