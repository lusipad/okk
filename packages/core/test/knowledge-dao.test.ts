import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "../src/database/sqlite-database.js";

const tempDirs: string[] = [];

const createTempDb = (): SqliteDatabase => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okclaw-knowledge-"));
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, "core.db");
  return new SqliteDatabase({ dbPath });
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("KnowledgeDao", () => {
  it("支持知识 CRUD、版本记录与状态流转", () => {
    const db = createTempDb();

    try {
      const user = db.users.create({
        username: "writer",
        passwordHash: "hash",
        displayName: "Writer"
      });
      const repo = db.repositories.create({
        name: "repo-a",
        path: "/tmp/repo-a",
        defaultBackend: "codex"
      });

      const created = db.knowledge.create({
        title: "Draft Note",
        content: "first",
        summary: "first summary",
        repoId: repo.id,
        tags: ["tag-a", "tag-b"],
        status: "draft",
        createdBy: user.id
      });

      expect(created.version).toBe(1);
      expect(created.status).toBe("draft");

      const updated = db.knowledge.update(created.id, {
        content: "second content",
        summary: "second summary",
        tags: ["tag-a", "tag-c"],
        status: "published",
        changeSummary: "publish",
        editedBy: user.id
      });

      expect(updated).not.toBeNull();
      expect(updated?.version).toBe(2);
      expect(updated?.status).toBe("published");
      expect(updated?.tags).toEqual(["tag-a", "tag-c"]);

      const stale = db.knowledge.updateStatus(created.id, "stale", user.id);
      expect(stale?.version).toBe(3);
      expect(stale?.status).toBe("stale");

      const archived = db.knowledge.updateStatus(created.id, "archived", user.id);
      expect(archived?.version).toBe(4);
      expect(archived?.status).toBe("archived");

      expect(() => db.knowledge.updateStatus(created.id, "published", user.id)).toThrow(
        /Invalid knowledge status transition/
      );

      const versions = db.knowledge.getVersionsByEntryId(created.id);
      expect(versions.map((item) => item.version)).toEqual([1, 2, 3, 4]);
      expect(versions[1]?.changeSummary).toBe("publish");

      expect(db.knowledge.delete(created.id)).toBe(true);
      expect(db.knowledge.getById(created.id)).toBeNull();
      expect(db.knowledge.getVersionsByEntryId(created.id)).toHaveLength(0);
      expect(db.knowledge.delete(created.id)).toBe(false);
    } finally {
      db.close();
    }
  });

  it("支持 FTS 搜索与 repo/category/tags 过滤，并按相关性+质量排序", () => {
    const db = createTempDb();

    try {
      const user = db.users.create({
        username: "searcher",
        passwordHash: "hash",
        displayName: "Searcher"
      });
      const repoA = db.repositories.create({
        name: "repo-a",
        path: "/tmp/repo-a",
        defaultBackend: "codex"
      });
      const repoB = db.repositories.create({
        name: "repo-b",
        path: "/tmp/repo-b",
        defaultBackend: "codex"
      });

      const lowQuality = db.knowledge.create({
        title: "Cache Notes",
        content: "cache search cache strategy",
        summary: "cache summary",
        repoId: repoA.id,
        category: "guide",
        qualityScore: 1,
        tags: ["api", "cache"],
        status: "published",
        createdBy: user.id
      });

      const highQuality = db.knowledge.create({
        title: "Cache Notes",
        content: "cache search cache strategy",
        summary: "cache summary",
        repoId: repoA.id,
        category: "guide",
        qualityScore: 9,
        tags: ["api", "cache"],
        status: "published",
        createdBy: user.id
      });

      db.knowledge.create({
        title: "Deploy Playbook",
        content: "cache but in another repo",
        summary: "ops summary",
        repoId: repoB.id,
        category: "ops",
        qualityScore: 10,
        tags: ["cache"],
        status: "published",
        createdBy: user.id
      });

      const results = db.knowledge.search({
        keyword: "cache",
        repoId: repoA.id,
        category: "guide",
        tags: ["api"],
        status: "published"
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe(highQuality.id);
      expect(results[1]?.id).toBe(lowQuality.id);
      expect(results.every((item) => item.snippet.includes("<mark>"))).toBe(true);

      const fallbackList = db.knowledge.search({
        repoId: repoA.id,
        tags: ["cache"],
        status: "published"
      });
      expect(fallbackList).toHaveLength(2);
      expect(fallbackList.every((item) => item.relevance === 0)).toBe(true);
    } finally {
      db.close();
    }
  });
});
