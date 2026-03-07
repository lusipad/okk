import type { SqliteConnection } from "./sqlite-adapter.js";
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
  const tableInfo = db.prepare("PRAGMA table_info(knowledge_entries)").all() as Array<{ name: string }>;
  const hasCategory = tableInfo.some((column) => column.name === "category");

  if (!hasCategory) {
    db.exec("ALTER TABLE knowledge_entries ADD COLUMN category TEXT NOT NULL DEFAULT 'general';");
  }

  db.prepare(
    "UPDATE knowledge_entries SET category = 'general' WHERE category IS NULL OR category = '';"
  ).run();
};

const ensureRepositoryContextColumns = (db: SqliteConnection): void => {
  db.exec(createBaseSchemaSql);
  const tableInfo = db.prepare("PRAGMA table_info(repositories)").all() as Array<{ name: string }>;
  const hasSnapshot = tableInfo.some((column) => column.name === "context_snapshot_json");
  const hasLastActivity = tableInfo.some((column) => column.name === "last_activity_at");

  if (!hasSnapshot) {
    db.exec("ALTER TABLE repositories ADD COLUMN context_snapshot_json TEXT NOT NULL DEFAULT '{}';");
  }

  if (!hasLastActivity) {
    db.exec("ALTER TABLE repositories ADD COLUMN last_activity_at TEXT;");
  }

  db.prepare(
    "UPDATE repositories SET context_snapshot_json = '{}' WHERE context_snapshot_json IS NULL OR context_snapshot_json = '';"
  ).run();

  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_activity_log (
      id TEXT PRIMARY KEY,
      repo_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (repo_id) REFERENCES repositories(id)
    );
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_repo_activity_log_repo_created ON repo_activity_log(repo_id, created_at DESC);"
  );
};

const ensureSessionSearchSchema = (db: SqliteConnection): void => {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasSummary = tableInfo.some((column) => column.name === "summary");
  const hasTagsJson = tableInfo.some((column) => column.name === "tags_json");
  const hasArchivedAt = tableInfo.some((column) => column.name === "archived_at");

  if (!hasSummary) {
    db.exec("ALTER TABLE sessions ADD COLUMN summary TEXT NOT NULL DEFAULT ''; ");
  }
  if (!hasTagsJson) {
    db.exec("ALTER TABLE sessions ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';");
  }
  if (!hasArchivedAt) {
    db.exec("ALTER TABLE sessions ADD COLUMN archived_at TEXT;");
  }

  db.prepare("UPDATE sessions SET summary = '' WHERE summary IS NULL;").run();
  db.prepare("UPDATE sessions SET tags_json = '[]' WHERE tags_json IS NULL OR tags_json = '';").run();

  db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS session_fts USING fts5(session_id UNINDEXED, title, summary);");
  db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(message_id UNINDEXED, session_id UNINDEXED, content);");

  db.exec("DROP TRIGGER IF EXISTS sessions_ai;");
  db.exec("DROP TRIGGER IF EXISTS sessions_au;");
  db.exec("DROP TRIGGER IF EXISTS sessions_ad;");
  db.exec("DROP TRIGGER IF EXISTS messages_ai_fts;");
  db.exec("DROP TRIGGER IF EXISTS messages_au_fts;");
  db.exec("DROP TRIGGER IF EXISTS messages_ad_fts;");

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS sessions_ai
    AFTER INSERT ON sessions BEGIN
      INSERT INTO session_fts(session_id, title, summary)
      VALUES (new.id, new.title, new.summary);
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS sessions_au
    AFTER UPDATE ON sessions BEGIN
      DELETE FROM session_fts WHERE session_id = old.id;
      INSERT INTO session_fts(session_id, title, summary)
      VALUES (new.id, new.title, new.summary);
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS sessions_ad
    AFTER DELETE ON sessions BEGIN
      DELETE FROM session_fts WHERE session_id = old.id;
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_ai_fts
    AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(message_id, session_id, content)
      VALUES (new.id, new.session_id, new.content);
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_au_fts
    AFTER UPDATE ON messages BEGIN
      DELETE FROM messages_fts WHERE message_id = old.id;
      INSERT INTO messages_fts(message_id, session_id, content)
      VALUES (new.id, new.session_id, new.content);
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_ad_fts
    AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE message_id = old.id;
    END;
  `);

  db.exec("DELETE FROM session_fts;");
  db.exec("INSERT INTO session_fts(session_id, title, summary) SELECT id, title, summary FROM sessions;");
  db.exec("DELETE FROM messages_fts;");
  db.exec("INSERT INTO messages_fts(message_id, session_id, content) SELECT id, session_id, content FROM messages;");
};


const ensureInstalledSkillsLifecycleColumns = (db: SqliteConnection): void => {
  const tableInfo = db.prepare("PRAGMA table_info(installed_skills)").all() as Array<{ name: string }>;
  const hasSourceType = tableInfo.some((column) => column.name === "source_type");
  const hasEnabled = tableInfo.some((column) => column.name === "enabled");
  const hasStatus = tableInfo.some((column) => column.name === "status");
  const hasDependencyErrors = tableInfo.some((column) => column.name === "dependency_errors_json");
  const hasUpdatedAt = tableInfo.some((column) => column.name === "updated_at");

  if (!hasSourceType) {
    db.exec("ALTER TABLE installed_skills ADD COLUMN source_type TEXT NOT NULL DEFAULT 'local';");
  }
  if (!hasEnabled) {
    db.exec("ALTER TABLE installed_skills ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;");
  }
  if (!hasStatus) {
    db.exec("ALTER TABLE installed_skills ADD COLUMN status TEXT NOT NULL DEFAULT 'installed';");
  }
  if (!hasDependencyErrors) {
    db.exec("ALTER TABLE installed_skills ADD COLUMN dependency_errors_json TEXT NOT NULL DEFAULT '[]';");
  }
  if (!hasUpdatedAt) {
    db.exec("ALTER TABLE installed_skills ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''; ");
  }

  db.prepare("UPDATE installed_skills SET source_type = 'local' WHERE source_type IS NULL OR source_type = ''; ").run();
  db.prepare("UPDATE installed_skills SET enabled = 1 WHERE enabled IS NULL;").run();
  db.prepare("UPDATE installed_skills SET status = 'installed' WHERE status IS NULL OR status = ''; ").run();
  db.prepare("UPDATE installed_skills SET dependency_errors_json = '[]' WHERE dependency_errors_json IS NULL OR dependency_errors_json = ''; ").run();
  db.prepare("UPDATE installed_skills SET updated_at = installed_at WHERE updated_at IS NULL OR updated_at = ''; ").run();
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
  },
  {
    version: 3,
    run: (db) => {
      ensureRepositoryContextColumns(db);
    }
  },
  {
    version: 4,
    run: (db) => {
      ensureSessionSearchSchema(db);
    }
  },
  {
    version: 5,
    run: (db) => {
      ensureInstalledSkillsLifecycleColumns(db);
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
