import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "../src/database/sqlite-database.js";
import { RepositoryContextService } from "../src/repository/repository-context-service.js";

const tempDirs: string[] = [];

function createTempDb(): SqliteDatabase {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-context-"));
  tempDirs.push(tempDir);
  return new SqliteDatabase({ dbPath: path.join(tempDir, "core.db") });
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("RepositoryContextService", () => {
  it("构建背景知识与 query-dependent 相关知识两层上下文", async () => {
    const db = createTempDb();
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-repo-"));
    tempDirs.push(repoDir);
    fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "CLAUDE.md"), "仓库级说明");

    try {
      const user = db.users.create({
        username: "writer",
        passwordHash: "hash",
        displayName: "Writer"
      });
      const repo = db.repositories.create({
        name: "repo-a",
        path: repoDir,
        defaultBackend: "codex"
      });

      db.knowledge.create({
        title: "仓库约定",
        content: "统一使用 pnpm 和 vitest",
        summary: "仓库背景知识",
        repoId: repo.id,
        qualityScore: 10,
        status: "published",
        createdBy: user.id
      });
      db.knowledge.create({
        title: "SQLite 迁移",
        content: "sqlite migration strategy and rollback",
        summary: "SQLite 相关知识",
        repoId: repo.id,
        qualityScore: 5,
        status: "published",
        createdBy: user.id
      });

      const service = new RepositoryContextService(db.knowledge);
      const context = await service.buildContext({
        repositoryPath: repoDir,
        repoId: repo.id,
        backgroundKnowledgeLimit: 1,
        relatedKnowledgeLimit: 2,
        query: "sqlite migration"
      });

      expect(context.claudeMd).toContain("仓库级说明");
      expect(context.knowledgeReferences).toHaveLength(2);
      expect(context.knowledgeReferences.map((item) => item.injectionKind)).toEqual(["background", "related"]);
      expect(context.systemPromptAppendix).toContain("## Background Knowledge");
      expect(context.systemPromptAppendix).toContain("## Related Knowledge");
      expect(context.systemPromptAppendix).toContain("SQLite");
    } finally {
      db.close();
    }
  });
});
