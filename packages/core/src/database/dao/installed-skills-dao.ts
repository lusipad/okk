import type { InstalledSkill } from "../../types.js";
import type { SqliteConnection } from "../sqlite-database.js";
import { nowIso } from "../../utils/id.js";

interface InstalledSkillRow {
  name: string;
  description: string;
  source: string;
  version: string;
  installed_at: string;
}

const toInstalledSkill = (row: InstalledSkillRow): InstalledSkill => ({
  name: row.name,
  description: row.description,
  source: row.source,
  version: row.version,
  installedAt: row.installed_at
});

export interface UpsertInstalledSkillInput {
  name: string;
  description: string;
  source: string;
  version: string;
}

export class InstalledSkillsDao {
  constructor(private readonly db: SqliteConnection) {}

  upsert(input: UpsertInstalledSkillInput): InstalledSkill {
    const installedAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO installed_skills(name, description, source, version, installed_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           description = excluded.description,
           source = excluded.source,
           version = excluded.version,
           installed_at = excluded.installed_at`
      )
      .run(input.name, input.description, input.source, input.version, installedAt);

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
      .prepare("SELECT * FROM installed_skills ORDER BY installed_at DESC")
      .all() as InstalledSkillRow[];
    return rows.map(toInstalledSkill);
  }
}

