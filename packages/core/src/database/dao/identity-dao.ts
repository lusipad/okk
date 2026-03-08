import type { IdentityProfile } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface IdentityProfileRow {
  id: string;
  name: string;
  system_prompt: string;
  profile_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateIdentityProfileInput {
  name: string;
  systemPrompt: string;
  profileJson?: Record<string, unknown>;
  isActive?: boolean;
}

const parseJson = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const toProfile = (row: IdentityProfileRow): IdentityProfile => ({
  id: row.id,
  name: row.name,
  systemPrompt: row.system_prompt,
  profileJson: parseJson(row.profile_json),
  isActive: row.is_active === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class IdentityDao {
  constructor(private readonly db: SqliteConnection) {}

  list(): IdentityProfile[] {
    const rows = this.db.prepare("SELECT * FROM identity_profiles ORDER BY updated_at DESC").all() as IdentityProfileRow[];
    return rows.map(toProfile);
  }

  getActive(): IdentityProfile | null {
    const row = this.db.prepare("SELECT * FROM identity_profiles WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1").get() as IdentityProfileRow | undefined;
    return row ? toProfile(row) : null;
  }

  upsert(input: CreateIdentityProfileInput): IdentityProfile {
    const existing = this.db.prepare("SELECT * FROM identity_profiles WHERE name = ?").get(input.name) as IdentityProfileRow | undefined;
    const timestamp = nowIso();
    if (input.isActive) {
      this.db.prepare("UPDATE identity_profiles SET is_active = 0").run();
    }

    if (existing) {
      this.db.prepare(
        `UPDATE identity_profiles
         SET system_prompt = ?, profile_json = ?, is_active = ?, updated_at = ?
         WHERE id = ?`
      ).run(input.systemPrompt, JSON.stringify(input.profileJson ?? {}), input.isActive ? 1 : existing.is_active, timestamp, existing.id);
      return this.getById(existing.id)!;
    }

    const id = generateId();
    this.db.prepare(
      `INSERT INTO identity_profiles(id, name, system_prompt, profile_json, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.name, input.systemPrompt, JSON.stringify(input.profileJson ?? {}), input.isActive ? 1 : 0, timestamp, timestamp);
    return this.getById(id)!;
  }

  activate(id: string): IdentityProfile | null {
    this.db.prepare("UPDATE identity_profiles SET is_active = 0").run();
    this.db.prepare("UPDATE identity_profiles SET is_active = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
    return this.getById(id);
  }

  getById(id: string): IdentityProfile | null {
    const row = this.db.prepare("SELECT * FROM identity_profiles WHERE id = ?").get(id) as IdentityProfileRow | undefined;
    return row ? toProfile(row) : null;
  }
}
