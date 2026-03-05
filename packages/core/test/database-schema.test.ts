import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "../src/database/sqlite-database.js";

const tempDirs: string[] = [];

const createTempDb = (): SqliteDatabase => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-core-schema-"));
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, "core.db");
  return new SqliteDatabase({ dbPath });
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
        "installed_skills"
      ]) {
        expect(tableNames.has(tableName)).toBe(true);
      }
    } finally {
      db.close();
    }
  });
});

