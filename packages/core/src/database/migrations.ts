import type { SqliteConnection } from "./sqlite-database.js";
import { CURRENT_SCHEMA_VERSION, createBaseSchemaSql } from "./schema.js";

interface Migration {
  version: number;
  run: (db: SqliteConnection) => void;
}

const isIgnorableMigrationError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return (
    normalized.includes("duplicate column name") ||
    normalized.includes("already exists") ||
    normalized.includes("duplicate key")
  );
};

const ensureCategoryColumn = (db: SqliteConnection): void => {
  const tableInfo = db.prepare("PRAGMA table_info(knowledge_entries)").all() as Array<{
    name: string;
  }>;
  const hasCategory = tableInfo.some((column) => column.name === "category");

  if (!hasCategory) {
    db.exec(
      "ALTER TABLE knowledge_entries ADD COLUMN category TEXT NOT NULL DEFAULT 'general';"
    );
  }

  db.prepare(
    "UPDATE knowledge_entries SET category = 'general' WHERE category IS NULL OR category = '';"
  ).run();
};

const migrations: Migration[] = [
  {
    version: 1,
    run: (db) => {
      db.exec(createBaseSchemaSql);
    }
  },
  {
    version: 2,
    run: (db) => {
      ensureCategoryColumn(db);
    }
  }
];

const getCurrentVersion = (db: SqliteConnection): number => {
  const result = db
    .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
    .get() as { version: number } | undefined;
  return result?.version ?? 0;
};

export const runMigrations = (db: SqliteConnection): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);"
  );

  let currentVersion = getCurrentVersion(db);

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    const transaction = db.transaction(() => {
      try {
        migration.run(db);
      } catch (error) {
        if (!isIgnorableMigrationError(error)) {
          throw error;
        }
      }

      db.prepare(
        "INSERT OR REPLACE INTO schema_migrations(version, applied_at) VALUES (?, ?)"
      ).run(migration.version, new Date().toISOString());
    });

    transaction();
    currentVersion = migration.version;
  }

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Schema migration incomplete: expected ${CURRENT_SCHEMA_VERSION}, got ${currentVersion}`
    );
  }
};

