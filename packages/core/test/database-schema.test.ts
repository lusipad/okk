import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "../src/database/sqlite-database.js";
import { SqliteDriverInitializationError, openSqliteConnection } from "../src/database/sqlite-adapter.js";

const tempDirs: string[] = [];

const createTempDb = (): SqliteDatabase => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-core-schema-"));
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, "core.db");
  return new SqliteDatabase({ dbPath });
};

const createLegacyKnowledgeDb = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-core-legacy-"));
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, "legacy.db");
  const db = new DatabaseSync(dbPath);
  const timestamp = new Date().toISOString();

  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    INSERT INTO schema_migrations(version, applied_at)
    VALUES (1, '${timestamp}');

    CREATE TABLE knowledge_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT NOT NULL,
      repo_id TEXT NOT NULL,
      source_session_id TEXT,
      quality_score REAL NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      upvote_count INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO knowledge_entries(
      id, title, content, summary, repo_id, source_session_id, quality_score, view_count,
      upvote_count, version, status, metadata, created_by, created_at, updated_at
    ) VALUES (
      'legacy-entry', 'Legacy', 'legacy content', 'legacy summary', 'repo-1', NULL, 0, 0,
      0, 1, 'draft', '{}', 'user-1', '${timestamp}', '${timestamp}'
    );
  `);
  db.close();

  return dbPath;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("Sqlite schema and migration", () => {
  it("启用 WAL 并创建关键业务表", () => {
    const db = createTempDb();
    try {
      const journalRow = db.connection
        .prepare("PRAGMA journal_mode")
        .get() as { journal_mode?: string } | undefined;
      expect((journalRow?.journal_mode ?? "").toLowerCase()).toBe("wal");

      const tables = db.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>;
      const tableNames = new Set(tables.map((item) => item.name));

      for (const tableName of [
        "schema_migrations",
        "users",
        "repositories",
        "sessions",
        "messages",
        "knowledge_entries",
        "knowledge_versions",
        "knowledge_tags",
        "agent_runs",
        "team_runs",
        "installed_skills",
        "agent_trace_events",
        "workspaces",
        "workspace_repositories",
        "knowledge_governance_records",
        "knowledge_import_batches",
        "knowledge_import_items",
        "skill_workflows",
        "skill_workflow_runs",
        "memory_shares",
        "memory_share_reviews",
        "knowledge_shares",
        "knowledge_share_reviews"
      ]) {
        expect(tableNames.has(tableName)).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it("能打开旧版本数据库并补齐 knowledge_entries.category 迁移", () => {
    const dbPath = createLegacyKnowledgeDb();
    const db = new SqliteDatabase({ dbPath });

    try {
      const columns = db.connection
        .prepare("PRAGMA table_info(knowledge_entries)")
        .all() as Array<{ name: string }>;
      expect(columns.some((column) => column.name === "category")).toBe(true);

      const migrated = db.connection
        .prepare("SELECT id, category FROM knowledge_entries WHERE id = ?")
        .get("legacy-entry") as { id: string; category: string } | undefined;
      expect(migrated?.id).toBe("legacy-entry");
      expect(migrated?.category).toBe("general");
    } finally {
      db.close();
    }
  });

  it("在 fileMustExist 失败时抛出结构化驱动初始化错误", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-core-missing-"));
    tempDirs.push(tempDir);
    const missingPath = path.join(tempDir, "missing.db");

    try {
      openSqliteConnection({ dbPath: missingPath, fileMustExist: true });
      throw new Error("expected openSqliteConnection to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SqliteDriverInitializationError);
      const typed = error as SqliteDriverInitializationError;
      expect(typed.driver).toBe("node:sqlite");
      expect(typed.databasePath).toContain("missing.db");
      expect(typed.nodeVersion.startsWith("v")).toBe(true);
    }
  });
});
