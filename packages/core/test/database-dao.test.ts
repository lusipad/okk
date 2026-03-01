import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "../src/database/sqlite-database.js";

const tempDirs: string[] = [];

const createTempDb = (): { db: SqliteDatabase; tempDir: string } => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okclaw-core-"));
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, "core.db");
  return { db: new SqliteDatabase({ dbPath }), tempDir };
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("SqliteDatabase DAO", () => {
  it("支持核心 DAO 基本读写，并确保 knowledge_entries.category 可用", () => {
    const { db } = createTempDb();

    try {
      const user = db.users.create({
        username: "alice",
        passwordHash: "hashed-password",
        displayName: "Alice"
      });

      const repository = db.repositories.create({
        name: "okclaw",
        path: "/tmp/okclaw",
        defaultBackend: "codex"
      });

      const session = db.sessions.create({
        userId: user.id,
        repoId: repository.id,
        title: "session 1",
        backend: "codex"
      });

      const message = db.messages.create({
        sessionId: session.id,
        role: "user",
        content: "hello",
        metadata: { client: "test" }
      });

      const entry = db.knowledge.create({
        title: "How to run",
        content: "Run npm test",
        summary: "Project test command",
        repoId: repository.id,
        createdBy: user.id,
        tags: ["test"],
        status: "published"
      });

      expect(db.users.getByUsername("alice")?.id).toBe(user.id);
      expect(db.messages.listBySessionId(session.id).map((item) => item.id)).toContain(message.id);
      expect(entry.category).toBe("general");
      expect(db.knowledge.listPublishedSummariesByRepo(repository.id)).toHaveLength(1);

      const columns = db.connection
        .prepare("PRAGMA table_info(knowledge_entries)")
        .all() as Array<{ name: string }>;
      expect(columns.some((column) => column.name === "category")).toBe(true);
    } finally {
      db.close();
    }
  });
});

