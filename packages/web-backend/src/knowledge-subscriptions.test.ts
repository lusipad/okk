import assert from "node:assert/strict";
import test from "node:test";
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

test("REST /api/knowledge-subscriptions 支持订阅、同步、导入与停用闭环", async () => {
  const core = await createCore({ dbPath: ":memory:", workspaceRoot: process.cwd() });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const sourceRepoId = (await core.repos.list())[0]?.id;
    assert.ok(sourceRepoId);
    const targetRepo = core.database.repositories.create({
      name: "target-repo",
      path: "/tmp/target-repo",
      defaultBackend: "codex"
    });
    const adminId = core.database.users.getByUsername("admin")?.id;
    assert.ok(adminId);

    const entry = core.database.knowledge.create({
      title: "订阅知识条目",
      content: "团队发布的知识正文",
      summary: "订阅摘要",
      repoId: sourceRepoId as string,
      category: "guide",
      status: "published",
      tags: ["release", "team"],
      createdBy: adminId as string
    });
    const share = core.database.knowledgeSharing.create({
      entryId: entry.id,
      visibility: "team",
      reviewStatus: "published",
      requestedBy: adminId as string,
      reviewedBy: adminId as string,
      publishedAt: "2026-03-14T00:00:00.000Z"
    });
    assert.ok(share.id);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge-subscriptions",
      headers,
      payload: {
        sourceType: "project",
        sourceId: sourceRepoId,
        targetRepoId: targetRepo.id
      }
    });
    assert.equal(createResponse.statusCode, 201, createResponse.body);
    const subscriptionId = createResponse.json().item.id as string;

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/knowledge-subscriptions",
      headers
    });
    assert.equal(listResponse.statusCode, 200, listResponse.body);
    assert.equal(listResponse.json().items.length, 1);

    const updatesResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge-subscriptions/${subscriptionId}/updates`,
      headers
    });
    assert.equal(updatesResponse.statusCode, 200, updatesResponse.body);
    assert.equal(updatesResponse.json().items.length, 1);
    assert.equal(updatesResponse.json().item.lastSyncStatus, "success");
    assert.ok(updatesResponse.json().item.lastCursor);
    const updateId = updatesResponse.json().items[0].id as string;

    const importResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-subscriptions/updates/${updateId}/import`,
      headers
    });
    assert.equal(importResponse.statusCode, 200, importResponse.body);
    assert.equal(importResponse.json().item.consumeStatus, "imported");
    assert.equal(importResponse.json().entry.repoId, targetRepo.id);
    assert.equal(importResponse.json().entry.metadata.subscription.subscriptionId, subscriptionId);
    assert.equal(importResponse.json().entry.metadata.subscription.updateId, updateId);

    const duplicateImportResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-subscriptions/updates/${updateId}/import`,
      headers
    });
    assert.equal(duplicateImportResponse.statusCode, 409, duplicateImportResponse.body);

    const duplicateSourceEntry = core.database.knowledge.create({
      title: "订阅知识条目",
      content: "重复标题的新来源正文",
      summary: "重复标题摘要",
      repoId: sourceRepoId as string,
      category: "guide",
      status: "published",
      tags: ["release", "team"],
      createdBy: adminId as string
    });
    core.database.knowledgeSharing.create({
      entryId: duplicateSourceEntry.id,
      visibility: "team",
      reviewStatus: "published",
      requestedBy: adminId as string,
      reviewedBy: adminId as string,
      publishedAt: "2026-03-14T00:01:00.000Z"
    });

    const duplicateSyncResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-subscriptions/${subscriptionId}/sync`,
      headers
    });
    assert.equal(duplicateSyncResponse.statusCode, 200, duplicateSyncResponse.body);
    assert.equal(duplicateSyncResponse.json().items.length, 2);
    const duplicateUpdate = duplicateSyncResponse
      .json()
      .items.find((item: { sourceEntryId: string }) => item.sourceEntryId === duplicateSourceEntry.id);
    assert.ok(duplicateUpdate);

    const duplicateConsumeResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-subscriptions/updates/${duplicateUpdate.id}/import`,
      headers
    });
    assert.equal(duplicateConsumeResponse.statusCode, 200, duplicateConsumeResponse.body);
    assert.equal(duplicateConsumeResponse.json().item.consumeStatus, "duplicate");
    assert.equal(
      duplicateConsumeResponse.json().item.importedEntryId,
      importResponse.json().entry.id
    );

    const pauseResponse = await app.inject({
      method: "PATCH",
      url: `/api/knowledge-subscriptions/${subscriptionId}`,
      headers,
      payload: { enabled: false }
    });
    assert.equal(pauseResponse.statusCode, 200, pauseResponse.body);
    assert.equal(pauseResponse.json().item.status, "paused");

    const pausedEntry = core.database.knowledge.create({
      title: "停用后新增知识",
      content: "新增内容",
      summary: "新增摘要",
      repoId: sourceRepoId as string,
      category: "guide",
      status: "published",
      tags: ["release"],
      createdBy: adminId as string
    });
    core.database.knowledgeSharing.create({
      entryId: pausedEntry.id,
      visibility: "team",
      reviewStatus: "published",
      requestedBy: adminId as string,
      reviewedBy: adminId as string,
      publishedAt: "2026-03-14T00:02:00.000Z"
    });

    const pausedSyncResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-subscriptions/${subscriptionId}/sync`,
      headers
    });
    assert.equal(pausedSyncResponse.statusCode, 400, pausedSyncResponse.body);

    const pausedUpdatesResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge-subscriptions/${subscriptionId}/updates`,
      headers
    });
    assert.equal(pausedUpdatesResponse.statusCode, 200, pausedUpdatesResponse.body);
    assert.equal(pausedUpdatesResponse.json().items.length, 2);
    assert.equal(
      pausedUpdatesResponse
        .json()
        .items.some((item: { sourceEntryId: string }) => item.sourceEntryId === pausedEntry.id),
      false
    );
  } finally {
    await app.close();
  }
});

test("REST /api/knowledge-sharing 与 /api/knowledge-subscriptions 打通发布到导入闭环", async () => {
  const core = await createCore({ dbPath: ":memory:", workspaceRoot: process.cwd() });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const sourceRepo = await core.repos.create({
      name: "subscription-source",
      path: "/tmp/subscription-source"
    });
    const targetRepo = await core.repos.create({
      name: "subscription-target",
      path: "/tmp/subscription-target"
    });

    const createKnowledgeResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge",
      headers,
      payload: {
        title: "路由闭环知识",
        content: "通过发布流程进入订阅的知识正文",
        summary: "路由闭环摘要",
        repoId: sourceRepo.id,
        category: "guide",
        status: "published",
        tags: ["subscription", "route"]
      }
    });
    assert.equal(createKnowledgeResponse.statusCode, 201, createKnowledgeResponse.body);
    const entryId = createKnowledgeResponse.json().id as string;

    const requestShareResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge-sharing/request",
      headers,
      payload: {
        entryId,
        visibility: "team",
        note: "用于订阅闭环"
      }
    });
    assert.equal(requestShareResponse.statusCode, 201, requestShareResponse.body);
    const shareId = requestShareResponse.json().item.id as string;

    const approveShareResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-sharing/${shareId}/review`,
      headers,
      payload: { action: "approve" }
    });
    assert.equal(approveShareResponse.statusCode, 200, approveShareResponse.body);
    assert.equal(approveShareResponse.json().item.reviewStatus, "approved");

    const publishShareResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-sharing/${shareId}/review`,
      headers,
      payload: { action: "publish" }
    });
    assert.equal(publishShareResponse.statusCode, 200, publishShareResponse.body);
    assert.equal(publishShareResponse.json().item.reviewStatus, "published");

    const createSubscriptionResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge-subscriptions",
      headers,
      payload: {
        sourceType: "project",
        sourceId: sourceRepo.id,
        targetRepoId: targetRepo.id
      }
    });
    assert.equal(createSubscriptionResponse.statusCode, 201, createSubscriptionResponse.body);
    const subscriptionId = createSubscriptionResponse.json().item.id as string;

    const updatesResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge-subscriptions/${subscriptionId}/updates`,
      headers
    });
    assert.equal(updatesResponse.statusCode, 200, updatesResponse.body);
    assert.equal(updatesResponse.json().items.length, 1);
    assert.equal(updatesResponse.json().items[0].sourceEntryId, entryId);
    const updateId = updatesResponse.json().items[0].id as string;

    const importResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-subscriptions/updates/${updateId}/import`,
      headers
    });
    assert.equal(importResponse.statusCode, 200, importResponse.body);
    assert.equal(importResponse.json().item.consumeStatus, "imported");
    assert.equal(importResponse.json().entry.repoId, targetRepo.id);
    assert.equal(importResponse.json().entry.metadata.subscription.sourceEntryId, entryId);

    const targetKnowledgeResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge?repoId=${targetRepo.id}`,
      headers
    });
    assert.equal(targetKnowledgeResponse.statusCode, 200, targetKnowledgeResponse.body);
    assert.equal(targetKnowledgeResponse.json().items.length, 1);
    assert.equal(targetKnowledgeResponse.json().items[0].title, "路由闭环知识");
  } finally {
    await app.close();
  }
});
