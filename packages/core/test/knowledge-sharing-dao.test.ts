import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "../src/database/sqlite-database.js";

const tempDirs: string[] = [];

const createTempDb = (): SqliteDatabase => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-knowledge-sharing-"));
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, "core.db");
  return new SqliteDatabase({ dbPath });
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("KnowledgeSharingDao", () => {
  it("支持共享请求、审核记录、发布过滤与概览统计", () => {
    const db = createTempDb();

    try {
      const author = db.users.create({
        username: "author",
        passwordHash: "hash",
        displayName: "Author"
      });
      const reviewer = db.users.create({
        username: "reviewer",
        passwordHash: "hash",
        displayName: "Reviewer"
      });
      const repo = db.repositories.create({
        name: "repo-a",
        path: "/tmp/repo-a",
        defaultBackend: "codex"
      });
      const knowledge = db.knowledge.create({
        title: "共享知识",
        content: "共享内容",
        summary: "共享摘要",
        repoId: repo.id,
        category: "guide",
        tags: ["team", "guide"],
        status: "published",
        createdBy: author.id
      });

      const requested = db.knowledgeSharing.create({
        entryId: knowledge.id,
        visibility: "team",
        reviewStatus: "pending_review",
        requestedBy: author.id,
        requestNote: "请审核"
      });
      db.knowledgeSharing.appendReview({
        shareId: requested.id,
        action: "submit",
        note: "提交共享",
        createdBy: author.id
      });

      expect(db.knowledgeSharing.getByEntryId(knowledge.id)?.reviewStatus).toBe("pending_review");
      expect(db.knowledgeSharing.list({ statuses: ["pending_review"] })).toHaveLength(1);

      const approved = db.knowledgeSharing.update(requested.id, {
        reviewStatus: "approved",
        reviewedBy: reviewer.id,
        reviewNote: "可以发布"
      });
      expect(approved?.reviewStatus).toBe("approved");

      db.knowledgeSharing.appendReview({
        shareId: requested.id,
        action: "approve",
        note: "可以发布",
        createdBy: reviewer.id
      });

      const published = db.knowledgeSharing.update(requested.id, {
        reviewStatus: "published",
        reviewedBy: reviewer.id,
        reviewNote: "已发布",
        publishedAt: "2026-03-14T00:00:00.000Z"
      });
      db.knowledgeSharing.appendReview({
        shareId: requested.id,
        action: "publish",
        note: "已发布",
        createdBy: reviewer.id
      });

      expect(published?.publishedAt).toBe("2026-03-14T00:00:00.000Z");
      expect(published?.sourceAuthorName).toBe("Author");
      expect(published?.entryTags).toEqual(["guide", "team"]);

      const publishedItems = db.knowledgeSharing.list({
        statuses: ["published"],
        category: "guide",
        tags: ["team"],
        query: "共享"
      });
      expect(publishedItems).toHaveLength(1);
      expect(publishedItems[0]?.entryId).toBe(knowledge.id);

      const reviews = db.knowledgeSharing.listReviews(requested.id);
      expect(reviews.map((item) => item.action)).toEqual(["publish", "approve", "submit"]);

      const overview = db.knowledgeSharing.getOverview();
      expect(overview.summary.total).toBe(1);
      expect(overview.summary.published).toBe(1);
      expect(overview.summary.pendingReview).toBe(0);
    } finally {
      db.close();
    }
  });
});
