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


const ensureMemorySchema = (db: SqliteConnection): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      repo_id TEXT,
      memory_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      status TEXT NOT NULL DEFAULT 'active',
      source_kind TEXT NOT NULL DEFAULT 'conversation',
      source_ref TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (repo_id) REFERENCES repositories(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_memory_entries_scope ON memory_entries(user_id, repo_id, memory_type, status, updated_at DESC);");
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_access_log (
      id TEXT PRIMARY KEY,
      memory_id TEXT NOT NULL,
      session_id TEXT,
      access_kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (memory_id) REFERENCES memory_entries(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_memory_access_log_memory ON memory_access_log(memory_id, created_at DESC);");
};

const ensureIdentitySchema = (db: SqliteConnection): void => {
  db.exec(
    "CREATE TABLE IF NOT EXISTS identity_profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, system_prompt TEXT NOT NULL, profile_json TEXT NOT NULL DEFAULT '{}', is_active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);"
  );
};

const ensureAgentTraceSchema = (db: SqliteConnection): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_trace_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      trace_type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      parent_trace_id TEXT,
      span_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      summary TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      file_changes_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_agent_trace_session_created ON agent_trace_events(session_id, created_at DESC);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_agent_trace_parent ON agent_trace_events(parent_trace_id, created_at DESC);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_agent_trace_type_status ON agent_trace_events(trace_type, status, created_at DESC);");

  const tableInfo = db.prepare("PRAGMA table_info(agent_trace_events)").all() as Array<{ name: string }>;
  if (!tableInfo.some((column) => column.name === "parent_trace_id")) {
    db.exec("ALTER TABLE agent_trace_events ADD COLUMN parent_trace_id TEXT;");
  }
  if (!tableInfo.some((column) => column.name === "span_id")) {
    db.exec("ALTER TABLE agent_trace_events ADD COLUMN span_id TEXT NOT NULL DEFAULT ''; ");
  }
  if (!tableInfo.some((column) => column.name === "status")) {
    db.exec("ALTER TABLE agent_trace_events ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';");
  }
  if (!tableInfo.some((column) => column.name === "file_changes_json")) {
    db.exec("ALTER TABLE agent_trace_events ADD COLUMN file_changes_json TEXT NOT NULL DEFAULT '[]';");
  }

  db.prepare("UPDATE agent_trace_events SET span_id = id WHERE span_id IS NULL OR span_id = ''; ").run();
  db.prepare("UPDATE agent_trace_events SET status = 'completed' WHERE status IS NULL OR status = ''; ").run();
  db.prepare("UPDATE agent_trace_events SET file_changes_json = '[]' WHERE file_changes_json IS NULL OR file_changes_json = ''; ").run();
};

const ensureWorkspaceSchema = (db: SqliteConnection): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      active_repo_id TEXT,
      recent_repo_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (active_repo_id) REFERENCES repositories(id)
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_repositories (
      workspace_id TEXT NOT NULL,
      repo_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id, repo_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (repo_id) REFERENCES repositories(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_workspace_repositories_repo ON workspace_repositories(repo_id, workspace_id);");
};

const ensureKnowledgeGovernanceSchema = (db: SqliteConnection): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_governance_records (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL DEFAULT 'system',
      source_label TEXT NOT NULL DEFAULT '自动治理',
      health_score REAL NOT NULL DEFAULT 1,
      governance_status TEXT NOT NULL DEFAULT 'healthy',
      stale_reason TEXT,
      conflict_entry_ids_json TEXT NOT NULL DEFAULT '[]',
      queue_reason TEXT,
      queue_priority INTEGER NOT NULL DEFAULT 0,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      reviewed_at TEXT,
      reviewed_by TEXT,
      rollback_version INTEGER,
      merged_into_entry_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_governance_status ON knowledge_governance_records(governance_status, queue_priority DESC, updated_at DESC);");
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_governance_reviews (
      id TEXT PRIMARY KEY,
      governance_id TEXT NOT NULL,
      action TEXT NOT NULL,
      note TEXT,
      actor_id TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (governance_id) REFERENCES knowledge_governance_records(id)
    );
  `);
};

const ensureKnowledgeImportSchema = (db: SqliteConnection): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_import_batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_types_json TEXT NOT NULL DEFAULT '[]',
      source_summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      item_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_import_items (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      repo_id TEXT,
      source_type TEXT NOT NULL,
      source_ref TEXT,
      dedupe_key TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      merged_entry_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES knowledge_import_batches(id),
      FOREIGN KEY (repo_id) REFERENCES repositories(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_import_items_batch ON knowledge_import_items(batch_id, status, created_at ASC);");
};

const ensureWorkflowSchema = (db: SqliteConnection): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      nodes_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      session_id TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      steps_json TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (workflow_id) REFERENCES skill_workflows(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_skill_workflow_runs_workflow ON skill_workflow_runs(workflow_id, updated_at DESC);");
};

const ensureMemorySharingSchema = (db: SqliteConnection): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_shares (
      id TEXT PRIMARY KEY,
      memory_id TEXT NOT NULL UNIQUE,
      knowledge_entry_id TEXT,
      visibility TEXT NOT NULL DEFAULT 'private',
      review_status TEXT NOT NULL DEFAULT 'draft',
      requested_by TEXT NOT NULL,
      reviewed_by TEXT,
      approval_note TEXT,
      rejection_reason TEXT,
      recommendation_score REAL NOT NULL DEFAULT 0,
      memory_title TEXT NOT NULL,
      memory_summary TEXT NOT NULL,
      repo_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      FOREIGN KEY (memory_id) REFERENCES memory_entries(id),
      FOREIGN KEY (knowledge_entry_id) REFERENCES knowledge_entries(id),
      FOREIGN KEY (repo_id) REFERENCES repositories(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_memory_shares_status ON memory_shares(review_status, visibility, updated_at DESC);");
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_share_reviews (
      id TEXT PRIMARY KEY,
      share_id TEXT NOT NULL,
      action TEXT NOT NULL,
      note TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (share_id) REFERENCES memory_shares(id)
    );
  `);
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
  },
  {
    version: 6,
    run: (db) => {
      ensureMemorySchema(db);
    }
  },
  {
    version: 7,
    run: (db) => {
      ensureIdentitySchema(db);
    }
  },
  {
    version: 8,
    run: (db) => {
      ensureAgentTraceSchema(db);
    }
  },
  {
    version: 9,
    run: (db) => {
      ensureWorkspaceSchema(db);
    }
  },
  {
    version: 10,
    run: (db) => {
      ensureKnowledgeGovernanceSchema(db);
      ensureKnowledgeImportSchema(db);
    }
  },
  {
    version: 11,
    run: (db) => {
      ensureWorkflowSchema(db);
    }
  },
  {
    version: 12,
    run: (db) => {
      ensureMemorySharingSchema(db);
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



