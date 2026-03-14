import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";
import { createCore } from "../../core/src/create-core.js";

async function loginToken(app: Awaited<ReturnType<typeof createApp>>): Promise<string> {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "admin", password: "admin" }
  });

  assert.equal(loginResponse.statusCode, 200, loginResponse.body);
  return loginResponse.json().token as string;
}

test("REST /api/knowledge 与 /api/knowledge-imports 支持标准知识文件闭环", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-knowledge-portability-"));
  const workspaceRoot = path.join(tempDir, "workspace");
  const secondRepoPath = path.join(tempDir, "repo-b");
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.mkdir(secondRepoPath, { recursive: true });

  const core = await createCore({ dbPath: ":memory:", workspaceRoot });
  const secondRepo = await core.repos.create({ name: "repo-b", path: secondRepoPath });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const adminId = core.database.users.getByUsername("admin")?.id;
    assert.ok(adminId);

    const primaryRepo = (await core.repos.list())[0];
    assert.ok(primaryRepo);

    const entry = core.database.knowledge.create({
      title: "SQLite 指南",
      content: "# SQLite\n\n先跑测试。",
      summary: "标准知识摘要",
      repoId: primaryRepo?.id ?? secondRepo.id,
      category: "guide",
      status: "published",
      tags: ["sqlite", "guide"],
      createdBy: adminId as string,
      metadata: {
        sourceRef: "memory:sqlite-guide"
      }
    });

    const singleExport = await app.inject({
      method: "GET",
      url: `/api/knowledge/${entry.id}/export`,
      headers
    });
    assert.equal(singleExport.statusCode, 200, singleExport.body);
    assert.match(String(singleExport.headers["content-type"] ?? ""), /text\/markdown/);
    assert.match(String(singleExport.headers["content-disposition"] ?? ""), /filename\*=UTF-8''/);
    assert.equal(singleExport.headers["x-okk-knowledge-format-version"], "1");
    assert.match(singleExport.body, /okk_format: "knowledge_entry"/);
    assert.match(singleExport.body, /format_version: 1/);
    assert.match(singleExport.body, /title: "SQLite 指南"/);

    const batchExport = await app.inject({
      method: "POST",
      url: "/api/knowledge/export",
      headers,
      payload: { entryIds: [entry.id] }
    });
    assert.equal(batchExport.statusCode, 200, batchExport.body);
    const batchPayload = batchExport.json() as {
      formatVersion: number;
      manifest: { itemCount: number };
      manifestFile: { fileName: string; content: string };
      files: Array<{ fileName: string; content: string }>;
    };
    assert.equal(batchPayload.formatVersion, 1);
    assert.equal(batchPayload.manifest.itemCount, 1);
    assert.equal(batchPayload.files.length, 1);
    assert.match(batchPayload.manifestFile.fileName, /knowledge-export-manifest-/);
    assert.match(batchPayload.manifestFile.content, /"itemCount": 1/);

    const previewImport = await app.inject({
      method: "POST",
      url: "/api/knowledge-imports/preview",
      headers,
      payload: {
        name: "标准文件导入",
        targetRepoId: secondRepo.id,
        files: [
          {
            name: batchPayload.files[0]?.fileName,
            content: batchPayload.files[0]?.content
          }
        ]
      }
    });
    assert.equal(previewImport.statusCode, 201, previewImport.body);
    const previewPayload = previewImport.json() as {
      item: { id: string };
      items: Array<{
        title: string;
        repoId: string | null;
        sourceType: string;
        evidence: Record<string, unknown>;
      }>;
    };
    assert.equal(previewPayload.items[0]?.title, "SQLite 指南");
    assert.equal(previewPayload.items[0]?.repoId, secondRepo.id);
    assert.equal(previewPayload.items[0]?.sourceType, "standard_file");
    assert.equal(previewPayload.items[0]?.evidence.category, "guide");
    assert.deepEqual(previewPayload.items[0]?.evidence.tags, ["guide", "sqlite"]);

    const confirmImport = await app.inject({
      method: "POST",
      url: `/api/knowledge-imports/${previewPayload.item.id}/confirm`,
      headers
    });
    assert.equal(confirmImport.statusCode, 200, confirmImport.body);
    const confirmPayload = confirmImport.json() as {
      results: Array<{ status: string; entryId?: string }>;
    };
    const importedEntryId = confirmPayload.results.find((item) => item.status === "imported")?.entryId;
    assert.ok(importedEntryId);

    const importedKnowledge = await app.inject({
      method: "GET",
      url: `/api/knowledge/${importedEntryId}`,
      headers
    });
    assert.equal(importedKnowledge.statusCode, 200, importedKnowledge.body);
    const importedPayload = importedKnowledge.json() as {
      item: {
        repoId: string;
        category: string;
        status: string;
        tags: string[];
        metadata: { portability?: { fileName?: string; formatVersion?: number } };
      };
    };
    assert.equal(importedPayload.item.repoId, secondRepo.id);
    assert.equal(importedPayload.item.category, "guide");
    assert.equal(importedPayload.item.status, "published");
    assert.deepEqual(importedPayload.item.tags, ["guide", "sqlite"]);
    assert.equal(importedPayload.item.metadata.portability?.fileName, batchPayload.files[0]?.fileName);
    assert.equal(importedPayload.item.metadata.portability?.formatVersion, 1);

    const invalidPreview = await app.inject({
      method: "POST",
      url: "/api/knowledge-imports/preview",
      headers,
      payload: {
        files: [
          {
            name: "bad.md",
            content: `---
okk_format: "knowledge_entry"
format_version: 99
title: "bad"
summary: "bad"
category: "guide"
status: "published"
tags: []
source_refs: []
---

body
`
          }
        ]
      }
    });
    assert.equal(invalidPreview.statusCode, 400, invalidPreview.body);
    const invalidPayload = invalidPreview.json() as {
      errors: Array<{ code: string; fileName: string; field?: string }>;
    };
    assert.equal(invalidPayload.errors[0]?.code, "unsupported_version");
    assert.equal(invalidPayload.errors[0]?.fileName, "bad.md");
    assert.equal(invalidPayload.errors[0]?.field, "format_version");
  } finally {
    await app.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
