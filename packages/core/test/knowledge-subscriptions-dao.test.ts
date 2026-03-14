import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "../src/database/sqlite-database.js";

const tempDirs: string[] = [];

const createTempDb = (): SqliteDatabase => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-knowledge-subscriptions-"));
  tempDirs.push(tempDir);
  return new SqliteDatabase({ dbPath: path.join(tempDir, "core.db") });
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("KnowledgeSubscriptionsDao", () => {
  it("支持同步更新与消费状态持久化", () => {
    const db = createTempDb();

    try {
      const subscriber = db.users.create({
        username: "subscriber",
        passwordHash: "hash",
        displayName: "Subscriber"
      });
      const author = db.users.create({
        username: "author",
        passwordHash: "hash",
        displayName: "Author"
      });
      const sourceRepo = db.repositories.create({
        name: "source-repo",
        path: "/tmp/source-repo",
        defaultBackend: "codex"
      });
      const targetRepo = db.repositories.create({
        name: "target-repo",
        path: "/tmp/target-repo",
        defaultBackend: "codex"
      });
      const entry = db.knowledge.create({
        title: "发布知识",
        content: "订阅正文",
        summary: "订阅摘要",
        repoId: sourceRepo.id,
        category: "guide",
        status: "published",
        tags: ["guide", "release"],
        createdBy: author.id
      });
      db.knowledgeSharing.create({
        entryId: entry.id,
        visibility: "team",
        reviewStatus: "published",
        requestedBy: author.id,
        reviewedBy: author.id,
        publishedAt: "2026-03-14T00:00:00.000Z"
      });

      const subscription = db.knowledgeSubscriptions.create({
        userId: subscriber.id,
        source: {
          type: "topic",
          id: "release",
          label: "Release",
          repoId: null,
          tag: "release",
          metadata: {}
        },
        targetRepoId: targetRepo.id
      });

      const synced = db.knowledgeSubscriptions.sync(subscription.id);
      expect(synced?.subscription.lastSyncStatus).toBe("success");
      expect(synced?.updates).toHaveLength(1);
      expect(synced?.updates[0]?.tags).toEqual(["guide", "release"]);
      expect(synced?.updates[0]?.sourceAuthorName).toBe("Author");

      const importedEntry = db.knowledge.create({
        title: "导入后的知识",
        content: "已导入正文",
        summary: "已导入摘要",
        repoId: targetRepo.id,
        category: "guide",
        status: "published",
        tags: ["imported"],
        createdBy: subscriber.id
      });

      const consumed = db.knowledgeSubscriptions.markUpdateConsumed(
        synced?.updates[0]?.id as string,
        "imported",
        importedEntry.id
      );
      expect(consumed?.consumeStatus).toBe("imported");
      expect(consumed?.importedEntryId).toBe(importedEntry.id);

      const listed = db.knowledgeSubscriptions.listByUserId(subscriber.id);
      expect(listed[0]?.pendingUpdateCount).toBe(0);
      expect(listed[0]?.source.tag).toBe("release");
    } finally {
      db.close();
    }
  });

  it("按 team/project/topic 来源过滤已发布共享并支持增量同步", () => {
    const db = createTempDb();

    try {
      const subscriber = db.users.create({
        username: "subscriber-filter",
        passwordHash: "hash",
        displayName: "Subscriber Filter"
      });
      const author = db.users.create({
        username: "author-filter",
        passwordHash: "hash",
        displayName: "Author Filter"
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
      const targetRepo = db.repositories.create({
        name: "target-filter",
        path: "/tmp/target-filter",
        defaultBackend: "codex"
      });

      const repoAEntry = db.knowledge.create({
        title: "Repo A Published",
        content: "repo a content",
        summary: "repo a summary",
        repoId: repoA.id,
        category: "guide",
        status: "published",
        tags: ["topic-a"],
        createdBy: author.id
      });
      db.knowledgeSharing.create({
        entryId: repoAEntry.id,
        visibility: "team",
        reviewStatus: "published",
        requestedBy: author.id,
        reviewedBy: author.id,
        publishedAt: "2026-03-14T00:00:00.000Z"
      });

      const repoBEntry = db.knowledge.create({
        title: "Repo B Published",
        content: "repo b content",
        summary: "repo b summary",
        repoId: repoB.id,
        category: "guide",
        status: "published",
        tags: ["topic-a", "topic-b"],
        createdBy: author.id
      });
      db.knowledgeSharing.create({
        entryId: repoBEntry.id,
        visibility: "team",
        reviewStatus: "published",
        requestedBy: author.id,
        reviewedBy: author.id,
        publishedAt: "2026-03-14T00:01:00.000Z"
      });

      const approvedOnlyEntry = db.knowledge.create({
        title: "Repo A Approved",
        content: "repo a approved content",
        summary: "repo a approved summary",
        repoId: repoA.id,
        category: "guide",
        status: "published",
        tags: ["topic-a"],
        createdBy: author.id
      });
      db.knowledgeSharing.create({
        entryId: approvedOnlyEntry.id,
        visibility: "team",
        reviewStatus: "approved",
        requestedBy: author.id,
        reviewedBy: author.id
      });

      const teamSubscription = db.knowledgeSubscriptions.create({
        userId: subscriber.id,
        source: {
          type: "team",
          id: "team",
          label: "团队知识",
          repoId: null,
          tag: null,
          metadata: {}
        },
        targetRepoId: targetRepo.id
      });
      const projectSubscription = db.knowledgeSubscriptions.create({
        userId: subscriber.id,
        source: {
          type: "project",
          id: repoA.id,
          label: repoA.name,
          repoId: repoA.id,
          tag: null,
          metadata: {}
        },
        targetRepoId: targetRepo.id
      });
      const topicSubscription = db.knowledgeSubscriptions.create({
        userId: subscriber.id,
        source: {
          type: "topic",
          id: "topic-a",
          label: "Topic A",
          repoId: null,
          tag: "topic-a",
          metadata: {}
        },
        targetRepoId: targetRepo.id
      });

      const teamSync = db.knowledgeSubscriptions.sync(teamSubscription.id);
      expect(teamSync.updates.map((item) => item.title)).toEqual(["Repo B Published", "Repo A Published"]);
      expect(teamSync.subscription.lastCursor).toBeTruthy();

      const projectSync = db.knowledgeSubscriptions.sync(projectSubscription.id);
      expect(projectSync.updates).toHaveLength(1);
      expect(projectSync.updates[0]?.title).toBe("Repo A Published");

      const topicSync = db.knowledgeSubscriptions.sync(topicSubscription.id);
      expect(topicSync.updates.map((item) => item.title)).toEqual(["Repo B Published", "Repo A Published"]);

      const incrementalEntry = db.knowledge.create({
        title: "Repo A Incremental",
        content: "repo a incremental content",
        summary: "repo a incremental summary",
        repoId: repoA.id,
        category: "guide",
        status: "published",
        tags: ["topic-a"],
        createdBy: author.id
      });
      db.knowledgeSharing.create({
        entryId: incrementalEntry.id,
        visibility: "team",
        reviewStatus: "published",
        requestedBy: author.id,
        reviewedBy: author.id,
        publishedAt: "2026-03-14T00:02:00.000Z"
      });

      const incrementalSync = db.knowledgeSubscriptions.sync(projectSubscription.id);
      expect(incrementalSync.createdCount).toBe(1);
      expect(incrementalSync.updates.map((item) => item.title)).toEqual([
        "Repo A Incremental",
        "Repo A Published"
      ]);

      const noopSync = db.knowledgeSubscriptions.sync(projectSubscription.id);
      expect(noopSync.createdCount).toBe(0);
      expect(noopSync.updates).toHaveLength(2);
    } finally {
      db.close();
    }
  });
});
