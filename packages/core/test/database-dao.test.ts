import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteDatabase } from "../src/database/sqlite-database.js";

const tempDirs: string[] = [];

const createTempDb = (): { db: SqliteDatabase; tempDir: string } => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "okk-core-"));
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
        name: "okk",
        path: "/tmp/okk",
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

  it("事务失败时会回滚未提交的 DAO 写入", () => {
    const { db } = createTempDb();

    try {
      const tx = db.connection.transaction(() => {
        db.users.create({
          username: "rollback-user",
          passwordHash: "hash",
          displayName: "Rollback User"
        });
        throw new Error("force rollback");
      });

      expect(() => tx()).toThrow(/force rollback/);
      expect(db.users.getByUsername("rollback-user")).toBeNull();
    } finally {
      db.close();
    }
  });
});

it("支持 InstalledSkills 状态流转", () => {
  const { db } = createTempDb();

  try {
    const installed = db.installedSkills.upsert({
      name: "sample-skill",
      description: "sample",
      source: "local:sample",
      sourceType: "local",
      version: "1.0.0",
      enabled: true,
      status: "installed",
      dependencyErrors: []
    });

    expect(installed.enabled).toBe(true);
    expect(installed.status).toBe("installed");

    const disabled = db.installedSkills.setEnabled("sample-skill", false);
    expect(disabled?.enabled).toBe(false);
    expect(disabled?.status).toBe("disabled");

    const errored = db.installedSkills.updateStatus("sample-skill", "error", ["缺少 scripts 目录"]);
    expect(errored?.status).toBe("error");
    expect(errored?.dependencyErrors).toEqual(["缺少 scripts 目录"]);

    db.installedSkills.remove("sample-skill");
    expect(db.installedSkills.list()).toHaveLength(0);
  } finally {
    db.close();
  }
});

it("支持 MemoryDao upsert、list 和 access log", () => {
  const { db } = createTempDb();

  try {
    const user = db.users.create({
      username: "memory-user",
      passwordHash: "hash",
      displayName: "Memory User"
    });
    const repo = db.repositories.create({ name: "memory-repo", path: "/tmp/memory", defaultBackend: "codex" });

    const memory = db.memory.upsert({
      userId: user.id,
      repoId: repo.id,
      memoryType: "project",
      title: "repo-rule",
      content: "always run tests",
      summary: "测试优先",
      sourceKind: "manual"
    });

    const listed = db.memory.list({ userId: user.id, repoId: repo.id, memoryType: "project" });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(memory.id);

    const updated = db.memory.update(memory.id, { summary: "测试优先（更新）", confidence: 0.9 });
    expect(updated?.summary).toBe("测试优先（更新）");

    const access = db.memory.logAccess({ memoryId: memory.id, accessKind: "injected" });
    expect(access.memoryId).toBe(memory.id);
  } finally {
    db.close();
  }
});

it("支持工作区、治理、导入、工作流与共享 DAO", () => {
  const { db } = createTempDb();

  try {
    const user = db.users.create({
      username: "feature-user",
      passwordHash: "hash",
      displayName: "Feature User"
    });
    const repoA = db.repositories.create({ name: "repo-a", path: "/tmp/repo-a", defaultBackend: "codex" });
    const repoB = db.repositories.create({ name: "repo-b", path: "/tmp/repo-b", defaultBackend: "codex" });

    const workspace = db.workspaces.create({
      name: "workspace-a",
      description: "multi repo",
      repoIds: [repoA.id, repoB.id],
      activeRepoId: repoA.id
    });
    expect(workspace.repoIds).toEqual([repoA.id, repoB.id]);
    expect(db.workspaces.activateRepo(workspace.id, repoB.id)?.activeRepoId).toBe(repoB.id);

    const entryA = db.knowledge.create({
      title: "冲突标题",
      content: "content-a",
      summary: "summary-a",
      repoId: repoA.id,
      status: "draft",
      createdBy: user.id
    });
    const entryB = db.knowledge.create({
      title: "冲突标题",
      content: "content-b",
      summary: "summary-b",
      repoId: repoA.id,
      status: "published",
      createdBy: user.id
    });
    const governance = db.knowledgeGovernance.refresh([entryA, entryB]);
    expect(governance.some((item) => item.status === "conflict")).toBe(true);

    const batch = db.knowledgeImports.createBatch({
      name: "batch-a",
      sourceTypes: ["memory"],
      sourceSummary: "memory"
    });
    db.knowledgeImports.addItems([
      {
        batchId: batch.id,
        title: "导入知识",
        summary: "导入摘要",
        content: "导入内容",
        repoId: repoA.id,
        sourceType: "memory",
        dedupeKey: `${repoA.id}:导入知识`
      }
    ]);
    expect(db.knowledgeImports.listItems(batch.id)).toHaveLength(1);

    const workflow = db.skillWorkflows.create({
      name: "wf-a",
      status: "active",
      nodes: [{ id: "n1", type: "prompt", name: "prompt", config: { template: "hello" }, next: [] }]
    });
    const run = db.skillWorkflows.createRun({ workflowId: workflow.id, status: "completed", output: { ok: true } });
    expect(db.skillWorkflows.listRuns(workflow.id)[0]?.id).toBe(run.id);

    const memory = db.memory.upsert({
      userId: user.id,
      repoId: repoA.id,
      memoryType: "project",
      title: "共享记忆",
      content: "share this memory",
      summary: "共享摘要",
      sourceKind: "manual"
    });
    const share = db.memorySharing.upsert({
      memoryId: memory.id,
      visibility: "team",
      reviewStatus: "pending",
      requestedBy: user.id,
      recommendationScore: 0.9,
      memoryTitle: memory.title,
      memorySummary: memory.summary,
      repoId: repoA.id
    });
    expect(db.memorySharing.getByMemoryId(memory.id)?.id).toBe(share.id);
  } finally {
    db.close();
  }
});
