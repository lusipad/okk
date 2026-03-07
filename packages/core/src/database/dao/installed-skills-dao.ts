import type { InstalledSkill } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { nowIso } from "../../utils/id.js";

interface InstalledSkillRow {
  name: string;
  description: string;
  source: string;
  source_type: "local" | "market" | "imported";
  version: string;
  enabled: number;
  status: "installed" | "disabled" | "error";
  dependency_errors_json: string;
  installed_at: string;
  updated_at: string;
}

const toInstalledSkill = (row: InstalledSkillRow): InstalledSkill => ({
  name: row.name,
  description: row.description,
  source: row.source,
  sourceType: row.source_type,
  version: row.version,
  enabled: row.enabled === 1,
  status: row.status,
  dependencyErrors: (() => {
    try {
      const parsed = JSON.parse(row.dependency_errors_json);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  })(),
  installedAt: row.installed_at,
  updatedAt: row.updated_at
});

export interface UpsertInstalledSkillInput {
  name: string;
  description: string;
  source: string;
  sourceType?: "local" | "market" | "imported";
  version: string;
  enabled?: boolean;
  status?: "installed" | "disabled" | "error";
  dependencyErrors?: string[];
}

export class InstalledSkillsDao {
  constructor(private readonly db: SqliteConnection) {}

  upsert(input: UpsertInstalledSkillInput): InstalledSkill {
    const installedAt = nowIso();
    const updatedAt = installedAt;
    this.db
      .prepare(
        `INSERT INTO installed_skills(name, description, source, source_type, version, enabled, status, dependency_errors_json, installed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           description = excluded.description,
           source = excluded.source,
           source_type = excluded.source_type,
           version = excluded.version,
           enabled = excluded.enabled,
           status = excluded.status,
           dependency_errors_json = excluded.dependency_errors_json,
           updated_at = excluded.updated_at`
      )
      .run(
        input.name,
        input.description,
        input.source,
        input.sourceType ?? 'local',
        input.version,
        input.enabled === false ? 0 : 1,
        input.status ?? (input.enabled === false ? 'disabled' : 'installed'),
        JSON.stringify(input.dependencyErrors ?? []),
        installedAt,
        updatedAt
      );

    const row = this.db
      .prepare("SELECT * FROM installed_skills WHERE name = ?")
      .get(input.name) as InstalledSkillRow | undefined;
    if (!row) {
      throw new Error("Failed to upsert installed skill");
    }

    return toInstalledSkill(row);
  }

  list(): InstalledSkill[] {
    const rows = this.db
      .prepare("SELECT * FROM installed_skills ORDER BY updated_at DESC, installed_at DESC")
      .all() as InstalledSkillRow[];
    return rows.map(toInstalledSkill);
  }

  remove(name: string): void {
    this.db.prepare("DELETE FROM installed_skills WHERE name = ?").run(name);
  }

  setEnabled(name: string, enabled: boolean): InstalledSkill | null {
    this.db
      .prepare("UPDATE installed_skills SET enabled = ?, status = ?, updated_at = ? WHERE name = ?")
      .run(enabled ? 1 : 0, enabled ? 'installed' : 'disabled', nowIso(), name);
    const row = this.db.prepare("SELECT * FROM installed_skills WHERE name = ?").get(name) as InstalledSkillRow | undefined;
    return row ? toInstalledSkill(row) : null;
  }

  updateStatus(name: string, status: "installed" | "disabled" | "error", dependencyErrors: string[] = []): InstalledSkill | null {
    this.db
      .prepare("UPDATE installed_skills SET status = ?, dependency_errors_json = ?, updated_at = ? WHERE name = ?")
      .run(status, JSON.stringify(dependencyErrors), nowIso(), name);
    const row = this.db.prepare("SELECT * FROM installed_skills WHERE name = ?").get(name) as InstalledSkillRow | undefined;
    return row ? toInstalledSkill(row) : null;
  }
}



