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

test("REST /api/knowledge-sharing 支持请求、审核、发布与团队浏览", async () => {
  const core = await createCore({ dbPath: ":memory:", workspaceRoot: process.cwd() });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const repoId = (await core.repos.list())[0]?.id;
    assert.ok(repoId);
    const adminId = core.database.users.getByUsername("admin")?.id;
    assert.ok(adminId);

    const entry = core.database.knowledge.create({
      title: "共享知识条目",
      content: "团队可复用的知识正文",
      summary: "共享摘要",
      repoId,
      category: "guide",
      status: "published",
      tags: ["team", "guide"],
      createdBy: adminId as string
    });

    const requestResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge-sharing/request",
      headers,
      payload: {
        entryId: entry.id,
        visibility: "team",
        note: "请审核这条知识"
      }
    });
    assert.equal(requestResponse.statusCode, 201, requestResponse.body);
    const shareId = requestResponse.json().item.id as string;

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge-sharing/request",
      headers,
      payload: {
        entryId: entry.id,
        visibility: "team"
      }
    });
    assert.equal(duplicateResponse.statusCode, 409, duplicateResponse.body);

    const approveResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-sharing/${shareId}/review`,
      headers,
      payload: {
        action: "approve",
        note: "内容可发布"
      }
    });
    assert.equal(approveResponse.statusCode, 200, approveResponse.body);
    assert.equal(approveResponse.json().item.reviewStatus, "approved");

    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge-sharing/${shareId}/review`,
      headers,
      payload: {
        action: "publish",
        note: "正式发布"
      }
    });
    assert.equal(publishResponse.statusCode, 200, publishResponse.body);
    assert.equal(publishResponse.json().item.reviewStatus, "published");

    const teamListResponse = await app.inject({
      method: "GET",
      url: "/api/knowledge-sharing/team?category=guide&tags=team",
      headers
    });
    assert.equal(teamListResponse.statusCode, 200, teamListResponse.body);
    const teamItems = teamListResponse.json().items as Array<{ entryId: string; sourceAuthorName: string | null }>;
    assert.equal(teamItems.length, 1);
    assert.equal(teamItems[0]?.entryId, entry.id);
    assert.equal(teamItems[0]?.sourceAuthorName, "Admin");

    const overviewResponse = await app.inject({
      method: "GET",
      url: "/api/knowledge-sharing/overview",
      headers
    });
    assert.equal(overviewResponse.statusCode, 200, overviewResponse.body);
    assert.equal(overviewResponse.json().summary.published, 1);

    const shareDetailResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge-sharing/entry/${entry.id}`,
      headers
    });
    assert.equal(shareDetailResponse.statusCode, 200, shareDetailResponse.body);
    assert.equal(shareDetailResponse.json().reviews.length, 3);

    const knowledgeDetailResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge/${entry.id}`,
      headers
    });
    assert.equal(knowledgeDetailResponse.statusCode, 200, knowledgeDetailResponse.body);
    assert.equal(knowledgeDetailResponse.json().item.metadata.sharing.reviewStatus, "published");
  } finally {
    await app.close();
  }
});
