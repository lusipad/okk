import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { createApp } from "./app.js";
import { createCore } from "../../core/src/create-core.js";
import type { BackendEventEnvelope } from "./types/contracts.js";

function waitForQaCompletion(
  socket: WebSocket,
  timeoutMs = 1500,
): Promise<BackendEventEnvelope<Record<string, unknown>>[]> {
  return new Promise((resolve, reject) => {
    const events: BackendEventEnvelope<Record<string, unknown>>[] = [];
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待 qa.completed 超时"));
    }, timeoutMs);

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onMessage = (raw: WebSocket.RawData) => {
      const event = JSON.parse(raw.toString()) as BackendEventEnvelope<Record<string, unknown>>;
      events.push(event);
      if (event.type === "qa.completed") {
        cleanup();
        resolve(events);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("error", onError);
      socket.off("message", onMessage);
    };

    socket.on("error", onError);
    socket.on("message", onMessage);
  });
}

function waitForQaEvent(
  socket: WebSocket,
  targetType: string,
  timeoutMs = 2000,
): Promise<BackendEventEnvelope<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`等待 ${targetType} 超时`));
    }, timeoutMs);

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onMessage = (raw: WebSocket.RawData) => {
      const event = JSON.parse(raw.toString()) as BackendEventEnvelope<Record<string, unknown>>;
      if (event.type !== targetType) {
        return;
      }
      cleanup();
      resolve(event);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("error", onError);
      socket.off("message", onMessage);
    };

    socket.on("error", onError);
    socket.on("message", onMessage);
  });
}

function waitForTeamEvent(
  socket: WebSocket,
  timeoutMs = 1500,
): Promise<{ type: string; teamId: string; payload: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待 team 事件超时"));
    }, timeoutMs);

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onMessage = (raw: WebSocket.RawData) => {
      const event = JSON.parse(raw.toString()) as {
        type: string;
        teamId: string;
        payload: Record<string, unknown>;
      };
      cleanup();
      resolve(event);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("error", onError);
      socket.off("message", onMessage);
    };

    socket.on("error", onError);
    socket.on("message", onMessage);
  });
}

async function loginToken(app: Awaited<ReturnType<typeof createApp>>): Promise<string> {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "admin", password: "admin" },
  });

  assert.equal(loginResponse.statusCode, 200);
  return loginResponse.json().token as string;
}

test("ws /qa 会按统一事件结构返回，且 ask 幂等去重可重放", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const { port } = app.server.address() as AddressInfo;

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/qa/session-a`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    await once(socket, "open");

    const message = {
      action: "ask",
      backend: "codex",
      agent_name: "code-reviewer",
      client_message_id: "msg-001",
      content: "请解释这段代码",
    };

    const firstPromise = waitForQaCompletion(socket);
    socket.send(JSON.stringify(message));
    const firstBatch = await firstPromise;

    const secondPromise = waitForQaCompletion(socket);
    socket.send(JSON.stringify(message));
    const secondBatch = await secondPromise;

    assert.ok(firstBatch.length >= 3);
    assert.deepEqual(secondBatch, firstBatch);
    assert.ok(
      firstBatch.every(
        (event) =>
          typeof event.type === "string" &&
          event.sessionId === "session-a" &&
          typeof event.event_id === "number" &&
          typeof event.timestamp === "string" &&
          typeof event.payload === "object" &&
          event.payload !== null,
      ),
    );

    socket.close();
  } finally {
    await app.close();
  }
});

test("知识建议链路支持 save/ignore", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const { port } = app.server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/qa/session-knowledge`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    await once(socket, "open");

    socket.send(
      JSON.stringify({
        action: "ask",
        backend: "codex",
        agent_name: "code-reviewer",
        client_message_id: "msg-knowledge-1",
        content: "总结一下如何运行项目测试",
      }),
    );

    const [completionEvents, suggestionEvent] = await Promise.all([
      waitForQaCompletion(socket),
      waitForQaEvent(socket, "knowledge_suggestion")
    ]);
    const completionEvent = completionEvents.find((event) => event.type === "qa.completed");
    assert.ok(completionEvent);
    assert.ok(Array.isArray(completionEvent.payload.knowledgeReferences));
    assert.equal((completionEvent.payload.knowledgeReferences as Array<Record<string, unknown>>).length, 1);
    const suggestion = suggestionEvent.payload.suggestion as { id: string; title: string; content: string };
    assert.equal(typeof suggestion.id, "string");
    assert.equal(typeof suggestion.content, "string");

    const saveResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge/suggestions/${suggestion.id}/save`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sessionId: "session-knowledge",
        title: "修订后的知识标题",
        content: "修订后的知识内容",
        tags: ["refined", "knowledge"]
      },
    });
    assert.equal(saveResponse.statusCode, 200, saveResponse.body);
    assert.equal(saveResponse.json().status, "saved");
    assert.equal(saveResponse.json().knowledgeEntryId !== null, true);

    const knowledgeListAfterSave = await app.inject({
      method: "GET",
      url: "/api/knowledge",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(knowledgeListAfterSave.statusCode, 200);
    const itemsAfterSave = knowledgeListAfterSave.json().items as Array<{ title: string }>;
    assert.ok(itemsAfterSave.some((item) => item.title === "修订后的知识标题"));

    socket.send(
      JSON.stringify({
        action: "ask",
        backend: "codex",
        agent_name: "code-reviewer",
        client_message_id: "msg-knowledge-2",
        content: "再给一个提炼示例",
      }),
    );
    const secondSuggestionEvent = await waitForQaEvent(socket, "knowledge_suggestion");
    const secondSuggestion = secondSuggestionEvent.payload.suggestion as { id: string };

    const ignoreResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge/suggestions/${secondSuggestion.id}/ignore`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sessionId: "session-knowledge",
      },
    });
    assert.equal(ignoreResponse.statusCode, 204, ignoreResponse.body);

    const knowledgeListAfterIgnore = await app.inject({
      method: "GET",
      url: "/api/knowledge",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(knowledgeListAfterIgnore.statusCode, 200);
    const itemsAfterIgnore = knowledgeListAfterIgnore.json().items as Array<{ title: string }>;
    assert.equal(itemsAfterIgnore.length, itemsAfterSave.length);

    socket.close();
  } finally {
    await app.close();
  }
});

test("ws /team 推送结构化 team payload", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const { port } = app.server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/team/team-qa`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    await once(socket, "open");

    const incomingEvent = waitForTeamEvent(socket);
    const publishResponse = await app.inject({
      method: "POST",
      url: "/api/agents/teams/team-qa/events",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        type: "team_member_update",
        payload: {
          member_id: "codex:reviewer",
          agent_name: "code-reviewer",
          status: "running",
          current_task: "分析请求",
          backend: "codex",
          started_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      },
    });
    assert.equal(publishResponse.statusCode, 202, publishResponse.body);

    const event = await incomingEvent;
    assert.equal(event.type, "team_member_update");
    assert.equal(event.teamId, "team-qa");
    assert.equal(event.payload.member_id, "codex:reviewer");

    socket.close();
  } finally {
    await app.close();
  }
});

test("REST /api/agents 支持 runtime backends 与 team runs", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });

  try {
    const token = await loginToken(app);
    const authHeaders = { Authorization: `Bearer ${token}` };

    const runtimeResponse = await app.inject({
      method: "GET",
      url: "/api/agents/runtime/backends",
      headers: authHeaders,
    });
    assert.equal(runtimeResponse.statusCode, 200, runtimeResponse.body);
    const runtimeItems = runtimeResponse.json().items as Array<{ backend: string; available: boolean }>;
    assert.ok(runtimeItems.some((item) => item.backend === "codex"));

    const sessionResponse = await app.inject({
      method: "POST",
      url: "/api/sessions",
      headers: authHeaders,
      payload: { title: "team-run-session" },
    });
    assert.equal(sessionResponse.statusCode, 201, sessionResponse.body);
    const sessionId = String(sessionResponse.json().id ?? "");
    assert.notEqual(sessionId, "");

    const createRunResponse = await app.inject({
      method: "POST",
      url: "/api/agents/teams/runs",
      headers: authHeaders,
      payload: {
        teamId: `team-${sessionId}`,
        sessionId,
        teamName: "多 Agent 协作",
        members: [
          {
            agentName: "code-reviewer",
            backend: "codex",
            prompt: "请汇总当前改动要点",
            taskTitle: "汇总改动",
          },
        ],
      },
    });
    assert.equal(createRunResponse.statusCode, 202, createRunResponse.body);
    const createdRun = createRunResponse.json() as { id: string; status: string };
    assert.equal(createdRun.status, "running");

    const getRunningResponse = await app.inject({
      method: "GET",
      url: `/api/agents/teams/runs/${createdRun.id}`,
      headers: authHeaders,
    });
    assert.equal(getRunningResponse.statusCode, 200, getRunningResponse.body);
    assert.equal(getRunningResponse.json().item.id, createdRun.id);

    let finalRunStatus = "running";
    for (let index = 0; index < 20; index += 1) {
      const pollResponse = await app.inject({
        method: "GET",
        url: `/api/agents/teams/runs/${createdRun.id}`,
        headers: authHeaders,
      });
      assert.equal(pollResponse.statusCode, 200, pollResponse.body);
      finalRunStatus = String(pollResponse.json().item?.status ?? "running");
      if (finalRunStatus !== "running") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(finalRunStatus, "done");

    const listRunsResponse = await app.inject({
      method: "GET",
      url: `/api/agents/teams/runs?sessionId=${encodeURIComponent(sessionId)}`,
      headers: authHeaders,
    });
    assert.equal(listRunsResponse.statusCode, 200, listRunsResponse.body);
    const runItems = listRunsResponse.json().items as Array<{ id: string; status: string }>;
    assert.ok(runItems.some((item) => item.id === createdRun.id && item.status === "done"));
  } finally {
    await app.close();
  }
});

test("REST 路由兼容前端页面：sessions/mcp/skills", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  const previousSkillMarketPath = process.env.OKK_SKILL_MARKET_PATH;
  let marketTempDir: string | null = null;

  try {
    const token = await loginToken(app);
    const authHeaders = { Authorization: `Bearer ${token}` };

    const createdSession = await app.inject({
      method: "POST",
      url: "/api/sessions",
      headers: authHeaders,
      payload: { title: "验证会话" },
    });

    assert.equal(createdSession.statusCode, 201);
    const sessionBody = createdSession.json();
    assert.equal(typeof sessionBody.id, "string");
    assert.equal(typeof sessionBody.repoId, "string");

    const mcpList = await app.inject({
      method: "GET",
      url: "/api/mcp/servers",
      headers: authHeaders,
    });
    assert.equal(mcpList.statusCode, 200);
    const mcpItems = mcpList.json().items as Array<{ id: string; enabled: boolean; status: string }>;
    assert.ok(Array.isArray(mcpItems));
    assert.ok(mcpItems.length > 0);

    const toggled = await app.inject({
      method: "PATCH",
      url: `/api/mcp/servers/${mcpItems[0].id}`,
      headers: authHeaders,
      payload: { enabled: false },
    });
    assert.equal(toggled.statusCode, 200);

    const mockMcpScriptPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../scripts/mock-mcp-server.mjs"
    );
    const createdServer = await app.inject({
      method: "POST",
      url: "/api/mcp/servers",
      headers: authHeaders,
      payload: {
        name: "test-mcp",
        description: "test",
        command: "node",
        args: [mockMcpScriptPath],
        enabled: false,
      },
    });
    assert.equal(createdServer.statusCode, 201);
    const createdServerBody = createdServer.json() as { id: string; status: string };
    assert.equal(createdServerBody.status, "stopped");

    const startedServer = await app.inject({
      method: "POST",
      url: `/api/mcp/servers/${createdServerBody.id}/start`,
      headers: authHeaders,
    });
    assert.equal(startedServer.statusCode, 200, startedServer.body);
    assert.equal(startedServer.json().status, "running");

    const toolsList = await app.inject({
      method: "GET",
      url: `/api/mcp/servers/${createdServerBody.id}/tools`,
      headers: authHeaders,
    });
    assert.equal(toolsList.statusCode, 200);
    const toolsItems = toolsList.json().items as Array<{ name: string }>;
    assert.ok(toolsItems.some((item) => item.name === "echo"));

    const toolCall = await app.inject({
      method: "POST",
      url: `/api/mcp/servers/${createdServerBody.id}/tools/call`,
      headers: authHeaders,
      payload: {
        name: "echo",
        arguments: {
          text: "okk",
        },
      },
    });
    assert.equal(toolCall.statusCode, 200);
    assert.match(String(toolCall.json().content ?? ""), /echo:okk/);

    const resourcesList = await app.inject({
      method: "GET",
      url: `/api/mcp/servers/${createdServerBody.id}/resources`,
      headers: authHeaders,
    });
    assert.equal(resourcesList.statusCode, 200);
    const resourceItems = resourcesList.json().items as Array<{ uri: string }>;
    assert.ok(resourceItems.length > 0);

    const resourceRead = await app.inject({
      method: "POST",
      url: `/api/mcp/servers/${createdServerBody.id}/resources/read`,
      headers: authHeaders,
      payload: {
        uri: "memo://hello",
      },
    });
    assert.equal(resourceRead.statusCode, 200);
    assert.match(String(resourceRead.json().contents?.[0]?.text ?? ""), /hello from mock mcp/);

    const stoppedServer = await app.inject({
      method: "POST",
      url: `/api/mcp/servers/${createdServerBody.id}/stop`,
      headers: authHeaders,
    });
    assert.equal(stoppedServer.statusCode, 200);
    assert.equal(stoppedServer.json().status, "stopped");

    const deletedServer = await app.inject({
      method: "DELETE",
      url: `/api/mcp/servers/${createdServerBody.id}`,
      headers: authHeaders,
    });
    assert.equal(deletedServer.statusCode, 204);

    const importDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-skill-test-"));
    const importedSkillFolder = path.join(importDir, "sample-skill");
    await fs.mkdir(importedSkillFolder, { recursive: true });
    await fs.writeFile(
      path.join(importedSkillFolder, "SKILL.md"),
      `---
name: sample-skill
description: sample description
version: 1.0.0
---
# sample
echo "hello"
`,
      "utf-8",
    );

    const imported = await app.inject({
      method: "POST",
      url: "/api/skills/import-folder",
      headers: authHeaders,
      payload: {
        folderPath: importedSkillFolder,
        targetName: "sample-skill-test",
        overwrite: true,
      },
    });
    assert.equal(imported.statusCode, 201);

    const skillsList = await app.inject({
      method: "GET",
      url: "/api/skills",
      headers: authHeaders,
    });
    assert.equal(skillsList.statusCode, 200);
    const skills = skillsList.json().items as Array<{ id: string; installed: boolean }>;
    assert.ok(skills.length > 0);
    const targetSkill = skills.find((item) => item.id === "sample-skill-test");
    assert.ok(targetSkill);

    const installed = await app.inject({
      method: "POST",
      url: `/api/skills/${targetSkill.id}/install`,
      headers: authHeaders,
    });
    assert.equal(installed.statusCode, 200);
    assert.equal(installed.json().installed, true);

    const skillsAfterInstall = await app.inject({
      method: "GET",
      url: "/api/skills",
      headers: authHeaders,
    });
    assert.equal(skillsAfterInstall.statusCode, 200);
    const installedEntry = (skillsAfterInstall.json().items as Array<{ id: string; installed: boolean }>).find(
      (item) => item.id === targetSkill.id,
    );
    assert.ok(installedEntry);
    assert.equal(installedEntry.installed, true);

    const detail = await app.inject({
      method: "GET",
      url: `/api/skills/${targetSkill.id}`,
      headers: authHeaders,
    });
    assert.equal(detail.statusCode, 200);
    assert.equal(typeof detail.json().item.content, "string");

    const fileList = await app.inject({
      method: "GET",
      url: `/api/skills/${targetSkill.id}/files`,
      headers: authHeaders,
    });
    assert.equal(fileList.statusCode, 200);
    assert.ok(Array.isArray(fileList.json().items));

    const riskScan = await app.inject({
      method: "GET",
      url: `/api/skills/${targetSkill.id}/risk-scan`,
      headers: authHeaders,
    });
    assert.equal(riskScan.statusCode, 200);
    assert.equal(typeof riskScan.json().summary.level, "string");

    const removedSkill = await app.inject({
      method: "DELETE",
      url: `/api/skills/${targetSkill.id}`,
      headers: authHeaders,
    });
    assert.equal(removedSkill.statusCode, 204);

    marketTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-skill-market-"));
    const marketSourceSkill = path.join(marketTempDir, "market-skill-source");
    await fs.mkdir(marketSourceSkill, { recursive: true });
    await fs.writeFile(
      path.join(marketSourceSkill, "SKILL.md"),
      `---
name: market-skill
description: market skill from catalog
version: 1.2.3
---
# market
echo "market"
`,
      "utf-8",
    );
    const marketIndexPath = path.join(marketTempDir, "market.json");
    await fs.writeFile(
      marketIndexPath,
      JSON.stringify(
        {
          items: [
            {
              id: "market-skill",
              name: "market-skill",
              description: "from market",
              version: "1.2.3",
              source: "market:test",
              tags: ["demo", "market"],
              sourceType: "folder",
              sourceLocation: marketSourceSkill,
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );
    process.env.OKK_SKILL_MARKET_PATH = marketIndexPath;

    const marketList = await app.inject({
      method: "GET",
      url: "/api/skills/market?q=market",
      headers: authHeaders,
    });
    assert.equal(marketList.statusCode, 200);
    const marketItems = marketList.json().items as Array<{ id: string }>;
    assert.ok(marketItems.some((item) => item.id === "market-skill"));

    const marketInstall = await app.inject({
      method: "POST",
      url: "/api/skills/market/install",
      headers: authHeaders,
      payload: {
        skillId: "market-skill",
        targetName: "market-skill-installed",
        overwrite: true,
      },
    });
    assert.equal(marketInstall.statusCode, 201, marketInstall.body);
    assert.equal(marketInstall.json().item?.installed, true);

    const skillsAfterMarketInstall = await app.inject({
      method: "GET",
      url: "/api/skills",
      headers: authHeaders,
    });
    assert.equal(skillsAfterMarketInstall.statusCode, 200);
    const marketInstalled = (
      skillsAfterMarketInstall.json().items as Array<{ id: string; installed: boolean }>
    ).find((item) => item.id === "market-skill-installed");
    assert.ok(marketInstalled);
    assert.equal(marketInstalled.installed, true);

    const removedMarketSkill = await app.inject({
      method: "DELETE",
      url: "/api/skills/market-skill-installed",
      headers: authHeaders,
    });
    assert.equal(removedMarketSkill.statusCode, 204);

    await fs.rm(importDir, { recursive: true, force: true });
  } finally {
    if (previousSkillMarketPath === undefined) {
      delete process.env.OKK_SKILL_MARKET_PATH;
    } else {
      process.env.OKK_SKILL_MARKET_PATH = previousSkillMarketPath;
    }
    if (marketTempDir) {
      await fs.rm(marketTempDir, { recursive: true, force: true });
    }
    await app.close();
  }
});

test("REST /api/knowledge 支持 CRUD、版本与 FTS 过滤搜索", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-knowledge-api-"));
  const workspaceRoot = path.join(tempDir, "workspace");
  await fs.mkdir(workspaceRoot, { recursive: true });

  const core = await createCore({
    dbPath: path.join(tempDir, "core.db"),
    workspaceRoot,
    codexCommand: "__missing_codex__",
    claudeCommand: "__missing_claude__"
  });

  const app = await createApp({
    jwtSecret: "test-secret",
    logger: false,
    core
  });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };

    const reposResponse = await app.inject({
      method: "GET",
      url: "/api/repos",
      headers
    });
    assert.equal(reposResponse.statusCode, 200);
    const repoId = (reposResponse.json().items as Array<{ id: string }>)[0]?.id;
    assert.equal(typeof repoId, "string");

    const lowEntryResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge",
      headers,
      payload: {
        title: "SQLite Cache Notes",
        content: "sqlite cache sqlite fts strategy",
        summary: "low quality",
        repoId,
        category: "guide",
        tags: ["sqlite", "cache"],
        status: "published",
        qualityScore: 1
      }
    });
    assert.equal(lowEntryResponse.statusCode, 201, lowEntryResponse.body);
    const lowEntry = lowEntryResponse.json() as { id: string };

    const highEntryResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge",
      headers,
      payload: {
        title: "SQLite Cache Notes",
        content: "sqlite cache sqlite fts strategy",
        summary: "high quality",
        repoId,
        category: "guide",
        tags: ["sqlite", "cache"],
        status: "published",
        qualityScore: 9
      }
    });
    assert.equal(highEntryResponse.statusCode, 201, highEntryResponse.body);
    const highEntry = highEntryResponse.json() as { id: string; version: number };
    assert.equal(highEntry.version, 1);

    const detailResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge/${highEntry.id}`,
      headers
    });
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.json().item.id, highEntry.id);

    const searchResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge?q=sqlite&repoId=${repoId}&category=guide&tags=sqlite&status=published`,
      headers
    });
    assert.equal(searchResponse.statusCode, 200, searchResponse.body);
    const searchItems = searchResponse.json().items as Array<{
      id: string;
      snippet: string;
      highlightedTitle: string;
    }>;
    assert.equal(searchItems.length, 2);
    assert.equal(searchItems[0]?.id, highEntry.id);
    assert.equal(searchItems[1]?.id, lowEntry.id);
    assert.ok(searchItems[0]?.snippet.includes("<mark>"));
    assert.ok(searchItems[0]?.highlightedTitle.includes("<mark>"));

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/knowledge/${highEntry.id}`,
      headers,
      payload: {
        content: "sqlite cache sqlite fts strategy updated",
        changeSummary: "update content"
      }
    });
    assert.equal(updateResponse.statusCode, 200, updateResponse.body);
    assert.equal(updateResponse.json().version, 2);

    const versionsResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge/${highEntry.id}/versions`,
      headers
    });
    assert.equal(versionsResponse.statusCode, 200);
    const versions = versionsResponse.json().items as Array<{ version: number; changeSummary: string | null }>;
    assert.deepEqual(
      versions.map((item) => item.version),
      [1, 2]
    );
    assert.equal(versions[1]?.changeSummary, "update content");

    const staleResponse = await app.inject({
      method: "PATCH",
      url: `/api/knowledge/${highEntry.id}/status`,
      headers,
      payload: { status: "stale" }
    });
    assert.equal(staleResponse.statusCode, 200, staleResponse.body);
    assert.equal(staleResponse.json().status, "stale");

    const archivedResponse = await app.inject({
      method: "PATCH",
      url: `/api/knowledge/${highEntry.id}/status`,
      headers,
      payload: { status: "archived" }
    });
    assert.equal(archivedResponse.statusCode, 200, archivedResponse.body);
    assert.equal(archivedResponse.json().status, "archived");

    const invalidTransition = await app.inject({
      method: "PATCH",
      url: `/api/knowledge/${highEntry.id}/status`,
      headers,
      payload: { status: "published" }
    });
    assert.equal(invalidTransition.statusCode, 400);

    const deletedResponse = await app.inject({
      method: "DELETE",
      url: `/api/knowledge/${highEntry.id}`,
      headers
    });
    assert.equal(deletedResponse.statusCode, 204);

    const missingDetail = await app.inject({
      method: "GET",
      url: `/api/knowledge/${highEntry.id}`,
      headers
    });
    assert.equal(missingDetail.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("REST /api/agents/runtime/backends 返回结构化诊断信息", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-runtime-backends-"));
  const workspaceRoot = path.join(tempDir, "workspace");
  await fs.mkdir(workspaceRoot, { recursive: true });

  const core = await createCore({
    dbPath: path.join(tempDir, "core.db"),
    workspaceRoot,
    codexCommand: "__missing_codex__",
    claudeCommand: "__missing_claude__"
  });

  const app = await createApp({
    jwtSecret: "test-secret",
    logger: false,
    core
  });

  try {
    const token = await loginToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/agents/runtime/backends",
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(response.statusCode, 200, response.body);
    const items = response.json().items as Array<{
      backend: string;
      available: boolean;
      runtimeStatus?: string;
      diagnostics?: { code?: string; detail?: string; severity?: string; retryable?: boolean };
      actions?: Array<{ kind: string }>;
    }>;
    const codexRuntime = items.find((item) => item.backend === "codex");
    assert.ok(codexRuntime);
    assert.equal(codexRuntime?.available, false);
    assert.equal(codexRuntime?.runtimeStatus, "unavailable");
    assert.equal(codexRuntime?.diagnostics?.code, "command_not_found_or_not_executable");
    assert.equal(codexRuntime?.diagnostics?.severity, "error");
    assert.equal(codexRuntime?.diagnostics?.retryable, true);
    assert.match(String(codexRuntime?.diagnostics?.detail ?? ""), /命令来源/);
    assert.ok((codexRuntime?.actions ?? []).some((item) => item.kind === "refresh"));
    assert.ok((codexRuntime?.actions ?? []).some((item) => item.kind === "copy_diagnostic"));
  } finally {
    await app.close();
    core.database?.close?.();
    await fs.rm(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
test("ws /qa 在无可回放事件时返回 qa.resume_failed", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const { port } = app.server.address() as AddressInfo;

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/qa/session-resume-failed`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    await once(socket, "open");

    socket.send(
      JSON.stringify({
        action: "resume",
        backend: "codex",
        agent_name: "code-reviewer",
        client_message_id: "resume-001",
        last_event_id: 99,
      }),
    );

    const event = await waitForQaEvent(socket, "qa.resume_failed");
    assert.equal(event.payload.last_event_id, 99);
    assert.equal(typeof event.payload.latest_event_id, "number");

    socket.close();
  } finally {
    await app.close();
  }
});

test("ws /qa 在没有进行中请求时返回 qa.abort_ignored", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const { port } = app.server.address() as AddressInfo;

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/qa/session-abort-ignored`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    await once(socket, "open");

    socket.send(
      JSON.stringify({
        action: "abort",
        backend: "codex",
        agent_name: "code-reviewer",
        client_message_id: "abort-001",
      }),
    );

    const event = await waitForQaEvent(socket, "qa.abort_ignored");
    assert.equal(event.payload.client_message_id, "abort-001");

    socket.close();
  } finally {
    await app.close();
  }
});

test("REST /api/repos/context 支持读取、更新和继续工作摘要", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };

    const createRepoResponse = await app.inject({
      method: "POST",
      url: "/api/repos",
      headers,
      payload: { name: "okk", path: process.cwd() }
    });
    assert.equal(createRepoResponse.statusCode, 201, createRepoResponse.body);
    const repoId = createRepoResponse.json().id as string;
    assert.equal(typeof repoId, "string");

    const getResponse = await app.inject({ method: "GET", url: `/api/repos/${repoId}/context`, headers });
    assert.equal(getResponse.statusCode, 200, getResponse.body);
    assert.equal(getResponse.json().repoId, repoId);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/repos/${repoId}/context`,
      headers,
      payload: {
        preferredAgentName: "code-reviewer",
        preferredBackend: "codex",
        preferredMode: "ask",
        preferredSkillIds: ["skill-a"],
        continuePrompt: "请继续修复登录流程"
      }
    });
    assert.equal(patchResponse.statusCode, 200, patchResponse.body);
    assert.equal(patchResponse.json().snapshot.preferredAgentName, "code-reviewer");
    assert.equal(patchResponse.json().snapshot.continuePrompt, "请继续修复登录流程");

    const continueResponse = await app.inject({ method: "POST", url: `/api/repos/${repoId}/continue`, headers });
    assert.equal(continueResponse.statusCode, 200, continueResponse.body);
    assert.equal(continueResponse.json().repoId, repoId);
    assert.equal(typeof continueResponse.json().prompt, "string");
  } finally {
    await app.close();
  }
});


test("REST /api/sessions 支持搜索、归档、恢复和引用片段", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-session-search-"));
  const workspaceRoot = path.join(tempDir, "workspace");
  await fs.mkdir(workspaceRoot, { recursive: true });

  const core = await createCore({
    dbPath: path.join(tempDir, "core.db"),
    workspaceRoot,
  });

  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const createSessionResponse = await app.inject({
      method: "POST",
      url: "/api/sessions",
      headers,
      payload: { title: "登录排查" }
    });
    assert.equal(createSessionResponse.statusCode, 201, createSessionResponse.body);
    const session = createSessionResponse.json() as { id: string };

    core.database.messages.create({
      sessionId: session.id,
      role: "user",
      content: "请处理 login callback 失败问题",
    });
    core.database.messages.create({
      sessionId: session.id,
      role: "assistant",
      content: "建议先检查 login callback 的重定向参数与 token 处理。",
    });
    core.database.sessions.updateSummary(session.id, "处理 login callback 失败问题");

    const searchResponse = await app.inject({
      method: "GET",
      url: "/api/sessions?q=login",
      headers,
    });
    assert.equal(searchResponse.statusCode, 200, searchResponse.body);
    const searchItems = searchResponse.json().items as Array<{ id: string; summary: string }>;
    assert.equal(searchItems.length, 1);
    assert.equal(searchItems[0]?.id, session.id);

    const refsResponse = await app.inject({
      method: "GET",
      url: `/api/sessions/${session.id}/references?q=callback`,
      headers,
    });
    assert.equal(refsResponse.statusCode, 200, refsResponse.body);
    const refs = refsResponse.json().items as Array<{ snippet: string }>;
    assert.ok(refs.length > 0);

    const archiveResponse = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/archive`,
      headers,
    });
    assert.equal(archiveResponse.statusCode, 200, archiveResponse.body);
    assert.ok(archiveResponse.json().archivedAt);

    const archivedList = await app.inject({
      method: "GET",
      url: "/api/sessions?archived=true",
      headers,
    });
    assert.equal(archivedList.statusCode, 200, archivedList.body);
    assert.equal((archivedList.json().items as Array<{ id: string }>).length, 1);

    const restoreResponse = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/restore`,
      headers,
    });
    assert.equal(restoreResponse.statusCode, 200, restoreResponse.body);
    assert.equal(restoreResponse.json().archivedAt, null);
  } finally {
    await app.close();
  }
});


test("REST /api/skills 支持启用切换与诊断", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  await app.listen({ host: "127.0.0.1", port: 0 });

  const importDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-skill-diagnose-"));
  const importedSkillFolder = path.join(importDir, "diagnose-skill");
  await fs.mkdir(importedSkillFolder, { recursive: true });
  await fs.writeFile(
    path.join(importedSkillFolder, "SKILL.md"),
    `---
name: diagnose-skill
description: diagnose skill
version: 1.0.0
compatibility: codex, claude-code
---
# diagnose
Use scripts/example.ts
`,
    "utf-8",
  );

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };

    const imported = await app.inject({
      method: "POST",
      url: "/api/skills/import-folder",
      headers,
      payload: {
        folderPath: importedSkillFolder,
        targetName: "diagnose-skill-test",
        overwrite: true,
      },
    });
    assert.equal(imported.statusCode, 201, imported.body);

    const installResponse = await app.inject({
      method: "POST",
      url: "/api/skills/diagnose-skill-test/install",
      headers,
    });
    assert.equal(installResponse.statusCode, 200, installResponse.body);

    const disableResponse = await app.inject({
      method: "PATCH",
      url: "/api/skills/diagnose-skill-test/enabled",
      headers,
      payload: { enabled: false },
    });
    assert.equal(disableResponse.statusCode, 200, disableResponse.body);
    assert.equal(disableResponse.json().item.enabled, false);
    assert.equal(disableResponse.json().item.status, "disabled");

    const diagnoseResponse = await app.inject({
      method: "POST",
      url: "/api/skills/diagnose-skill-test/diagnose",
      headers,
      payload: {},
    });
    assert.equal(diagnoseResponse.statusCode, 200, diagnoseResponse.body);
    assert.deepEqual(diagnoseResponse.json().diagnosis.compatibility, ["codex", "claude-code"]);
    assert.ok(Array.isArray(diagnoseResponse.json().diagnosis.dependencyErrors));
  } finally {
    await fs.rm(importDir, { recursive: true, force: true });
    await app.close();
  }
});

test("REST /api/memory 支持列出、创建、更新和 sync", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-memory-api-"));
  const workspaceRoot = path.join(tempDir, "workspace");
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, "CLAUDE.md"), "# repo memory\nremember this repo", "utf-8");

  const core = await createCore({
    dbPath: path.join(tempDir, "core.db"),
    workspaceRoot,
  });

  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const repos = await app.inject({ method: "GET", url: "/api/repos", headers });
    const repoId = (repos.json().items as Array<{ id: string }>)[0]?.id;

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/memory",
      headers,
      payload: {
        repoId,
        memoryType: "project",
        title: "repo-rule",
        content: "use npm test before push",
        summary: "测试优先",
      }
    });
    assert.equal(createResponse.statusCode, 201, createResponse.body);
    const created = createResponse.json().item as { id: string };

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/memory?repoId=${repoId}`,
      headers,
    });
    assert.equal(listResponse.statusCode, 200, listResponse.body);
    const items = listResponse.json().items as Array<{ id: string }>;
    assert.ok(items.some((item) => item.id === created.id));

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/memory/${created.id}`,
      headers,
      payload: { summary: "测试优先（更新）", confidence: 0.9 }
    });
    assert.equal(updateResponse.statusCode, 200, updateResponse.body);
    assert.equal(updateResponse.json().item.summary, "测试优先（更新）");

    const syncResponse = await app.inject({
      method: "POST",
      url: "/api/memory/sync",
      headers,
      payload: { repoId }
    });
    assert.equal(syncResponse.statusCode, 200, syncResponse.body);
    assert.equal(typeof syncResponse.json().imported, "number");
  } finally {
    await app.close();
  }
});

test("REST /api/identity 支持列出、创建与激活", async () => {
  const core = await createCore({ dbPath: ":memory:", workspaceRoot: process.cwd() });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/identity",
      headers,
      payload: {
        name: "严格代码审查者",
        systemPrompt: "请以严格代码审查者身份回复。",
        isActive: true,
      }
    });
    assert.equal(createResponse.statusCode, 201, createResponse.body);
    const created = createResponse.json().item as { id: string; isActive: boolean };
    assert.equal(created.isActive, true);

    const listResponse = await app.inject({ method: "GET", url: "/api/identity", headers });
    assert.equal(listResponse.statusCode, 200, listResponse.body);
    assert.ok((listResponse.json().items as Array<{ id: string }>).some((item) => item.id === created.id));

    const activeResponse = await app.inject({ method: "GET", url: "/api/identity/active", headers });
    assert.equal(activeResponse.statusCode, 200, activeResponse.body);
    assert.equal(activeResponse.json().item.id, created.id);
  } finally {
    await app.close();
  }
});

test("REST /api/partner/summary 支持返回聚合摘要并在空数据时降级", async () => {
  const core = await createCore({ dbPath: ":memory:", workspaceRoot: process.cwd() });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const repoId = (await core.repos.list())[0]?.id;
    assert.ok(repoId);

    await core.identity.upsert({
      name: "OKK Copilot",
      systemPrompt: "请记住当前用户的协作偏好。",
      profileJson: { summary: "熟悉你的仓库偏好与协作方式" },
      isActive: true
    });
    await core.memory.upsert({
      userId: "u-admin",
      repoId,
      memoryType: "process",
      title: "测试优先",
      content: "提交前先运行测试",
      summary: "提交前先运行测试",
      confidence: 0.9,
      status: "active",
      sourceKind: "manual",
      sourceRef: null,
      metadata: {}
    });
    await core.memory.upsert({
      userId: "u-admin",
      repoId: null,
      memoryType: "preference",
      title: "中文回复",
      content: "默认使用中文简体回复",
      summary: "默认中文简体",
      confidence: 0.8,
      status: "active",
      sourceKind: "manual",
      sourceRef: null,
      metadata: {}
    });

    const summaryResponse = await app.inject({ method: "GET", url: "/api/partner/summary", headers });
    assert.equal(summaryResponse.statusCode, 200, summaryResponse.body);
    assert.equal(summaryResponse.json().item.identity.name, "OKK Copilot");
    assert.equal(summaryResponse.json().item.memoryCount, 2);
    assert.ok(Array.isArray(summaryResponse.json().item.recentMemories));
    assert.ok(summaryResponse.json().item.recentMemories.length <= 3);
  } finally {
    await app.close();
  }
});

test("REST /api/repos/:repoId/continue 在缺少 continuePrompt 时回退到 recentActivities", async () => {
  const core = await createCore({ dbPath: ":memory:", workspaceRoot: process.cwd() });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const repoId = (await core.repos.list())[0]?.id;
    assert.ok(repoId);

    await core.repos.updateContext(repoId, {
      continuePrompt: null,
      lastActivitySummary: null
    });

    const continueResponse = await app.inject({ method: "POST", url: `/api/repos/${repoId}/continue`, headers });
    assert.equal(continueResponse.statusCode, 200, continueResponse.body);
    assert.match(continueResponse.json().prompt, /最近活动|继续上次工作/);
    assert.equal(typeof continueResponse.json().summary, "string");
  } finally {
    await app.close();
  }
});

test("REST /api/partner/summary 在 memory core 下返回可降级摘要", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };
    const summaryResponse = await app.inject({ method: "GET", url: "/api/partner/summary", headers });
    assert.equal(summaryResponse.statusCode, 200, summaryResponse.body);
    assert.equal(summaryResponse.json().item.identity, null);
    assert.equal(summaryResponse.json().item.memoryCount, 0);
    assert.deepEqual(summaryResponse.json().item.recentMemories, []);
  } finally {
    await app.close();
  }
});

test("REST /api/missions 支持创建、汇总、workstreams 与 checkpoints", async () => {
  const app = await createApp({ jwtSecret: "test-secret", logger: false, coreMode: "memory" });

  try {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "admin" }
    });
    assert.equal(loginResponse.statusCode, 200, loginResponse.body);
    const token = loginResponse.json().token as string;
    const headers = { Authorization: `Bearer ${token}` };

    const missionCreate = await app.inject({
      method: "POST",
      url: "/api/missions",
      headers,
      payload: {
        title: "统一 Figma 页面拆分",
        goal: "把首页与任务页拆开"
      }
    });
    assert.equal(missionCreate.statusCode, 201, missionCreate.body);
    const missionId = missionCreate.json().item.id as string;

    const missionList = await app.inject({
      method: "GET",
      url: "/api/missions?summaries=true",
      headers
    });
    assert.equal(missionList.statusCode, 200, missionList.body);
    assert.ok((missionList.json().items as Array<{ id: string }>).some((item) => item.id === missionId));

    const checkpoints = await app.inject({
      method: "GET",
      url: `/api/missions/${missionId}/checkpoints`,
      headers
    });
    assert.equal(checkpoints.statusCode, 200, checkpoints.body);
    assert.deepEqual(checkpoints.json().items, []);

    const workstreams = await app.inject({
      method: "GET",
      url: `/api/missions/${missionId}/workstreams`,
      headers
    });
    assert.equal(workstreams.statusCode, 200, workstreams.body);
    assert.deepEqual(workstreams.json().items, []);
  } finally {
    await app.close();
  }
});

test("REST 新增工作区/治理/导入/工作流/共享/Trace 接口可联通", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-ops-api-"));
  const workspaceRoot = path.join(tempDir, "workspace-a");
  const repoBPath = path.join(tempDir, "workspace-b");
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.mkdir(repoBPath, { recursive: true });

  const core = await createCore({ dbPath: ":memory:", workspaceRoot });
  const repoB = await core.repos.create({ name: "workspace-b", path: repoBPath });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };

    const reposResponse = await app.inject({ method: "GET", url: "/api/repos", headers });
    assert.equal(reposResponse.statusCode, 200, reposResponse.body);
    const repos = reposResponse.json().items as Array<{ id: string; path: string }>;
    const repoA = repos.find((item) => item.path === workspaceRoot);
    assert.ok(repoA);

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      headers,
      payload: {
        name: "multi-repo",
        repoIds: [repoA?.id, repoB.id]
      }
    });
    assert.equal(workspaceResponse.statusCode, 201, workspaceResponse.body);
    const workspaceId = workspaceResponse.json().item.id as string;

    const workspaceStatus = await app.inject({ method: "GET", url: `/api/workspaces/${workspaceId}/status`, headers });
    assert.equal(workspaceStatus.statusCode, 200, workspaceStatus.body);
    assert.equal((workspaceStatus.json().repositories as unknown[]).length, 2);

    const adminId = core.database.users.getByUsername("admin")?.id;
    assert.ok(adminId);
    const entryA = core.database.knowledge.create({
      title: "冲突条目",
      content: "draft content",
      summary: "draft",
      repoId: repoA?.id ?? repoB.id,
      status: "draft",
      createdBy: adminId as string
    });
    core.database.knowledge.create({
      title: "冲突条目",
      content: "published content",
      summary: "published",
      repoId: repoA?.id ?? repoB.id,
      status: "published",
      createdBy: adminId as string
    });

    const governanceRefresh = await app.inject({ method: "POST", url: "/api/governance/refresh", headers });
    assert.equal(governanceRefresh.statusCode, 200, governanceRefresh.body);
    const governanceList = await app.inject({ method: "GET", url: "/api/governance", headers });
    assert.equal(governanceList.statusCode, 200, governanceList.body);
    const governanceItems = governanceList.json().items as Array<{ id: string; entryId: string }>;
    const governanceItem = governanceItems.find((item) => item.entryId === entryA.id);
    assert.ok(governanceItem);

    const governanceReview = await app.inject({
      method: "POST",
      url: `/api/governance/${governanceItem?.id}/review`,
      headers,
      payload: { action: "approve" }
    });
    assert.equal(governanceReview.statusCode, 200, governanceReview.body);

    const memory = core.database.memory.upsert({
      userId: adminId as string,
      repoId: repoA?.id ?? repoB.id,
      memoryType: "project",
      title: "导入来源",
      content: "shared memory content",
      summary: "shared memory",
      sourceKind: "manual"
    });
    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge-imports/preview",
      headers,
      payload: { sourceTypes: ["memory"], repoIds: [repoA?.id ?? repoB.id] }
    });
    assert.equal(previewResponse.statusCode, 201, previewResponse.body);
    const batchId = previewResponse.json().item.id as string;

    const confirmResponse = await app.inject({ method: "POST", url: `/api/knowledge-imports/${batchId}/confirm`, headers });
    assert.equal(confirmResponse.statusCode, 200, confirmResponse.body);

    core.database.knowledge.create({
      title: "工作流知识节点",
      content: "workflow knowledge input for run details",
      summary: "工作流知识摘要",
      repoId: repoA?.id ?? repoB.id,
      category: "workflow",
      status: "published",
      tags: ["workflow", "knowledge"],
      createdBy: adminId as string
    });

    const availableAgents = await core.agents.list();
    const availableSkills = await core.skills.list();
    const workflowExecutionNode = availableAgents[0]
      ? {
          id: "agent-1",
          type: "agent",
          name: "审查",
          config: { agentName: availableAgents[0].name, outputKey: "result" },
          next: []
        }
      : {
          id: "skill-1",
          type: "skill",
          name: "技能摘要",
          config: { skillName: availableSkills[0]?.name ?? "repo-stats", outputKey: "result" },
          next: []
        };

    const templatesResponse = await app.inject({
      method: "GET",
      url: "/api/workflows/templates",
      headers
    });
    assert.equal(templatesResponse.statusCode, 200, templatesResponse.body);
    const templateItems = templatesResponse.json().items as Array<{
      id: string;
      metadata?: { knowledgePublishing?: { defaultMode?: string } };
    }>;
    assert.ok(templateItems.some((item) => item.id === "template-review" && item.metadata?.knowledgePublishing?.defaultMode === "summary"));

    const workflowCreate = await app.inject({
      method: "POST",
      url: "/api/workflows",
      headers,
      payload: {
        name: "review-flow",
        status: "active",
        metadata: {
          templateId: "template-review",
          knowledgePublishing: {
            enabled: true,
            defaultMode: "summary",
            titlePrefix: "代码审查沉淀",
            category: "code-review",
            tags: ["review", "workflow"],
            sourceStepIds: ["prompt-1", workflowExecutionNode.id]
          }
        },
        nodes: [
          {
            id: "knowledge-1",
            type: "knowledge_ref",
            name: "加载知识",
            config: { query: "workflow knowledge", limit: 2, outputKey: "knowledgeBundle" },
            next: ["prompt-1"]
          },
          {
            id: "prompt-1",
            type: "prompt",
            name: "准备",
            config: { template: "topic={{topic}}\nknowledge={{knowledgeBundle.summary}}", outputKey: "brief" },
            next: [workflowExecutionNode.id]
          },
          workflowExecutionNode
        ]
      }
    });
    assert.equal(workflowCreate.statusCode, 201, workflowCreate.body);
    const workflowId = workflowCreate.json().item.id as string;
    assert.equal(workflowCreate.json().item.metadata.templateId, "template-review");

    const workflowRun = await app.inject({
      method: "POST",
      url: `/api/workflows/${workflowId}/run`,
      headers,
      payload: { input: { topic: "trace", severity: "high" } }
    });
    assert.equal(workflowRun.statusCode, 200, workflowRun.body);
    assert.equal(workflowRun.json().item.status, "completed");
    assert.equal(Array.isArray(workflowRun.json().item.output.knowledgeBundle.entries), true);
    assert.equal(workflowRun.json().item.output.knowledgeBundle.entries.length > 0, true);
    assert.equal(typeof workflowRun.json().item.output.knowledgeBundle.summary, "string");
    assert.equal(workflowRun.json().item.metadata.workflowName, "review-flow");
    assert.deepEqual(workflowRun.json().item.metadata.availablePublishModes, ["summary", "full"]);
    const workflowRunId = workflowRun.json().item.id as string;

    const knowledgeDraft = await app.inject({
      method: "GET",
      url: `/api/workflows/runs/${workflowRunId}/knowledge-draft?mode=full`,
      headers
    });
    assert.equal(knowledgeDraft.statusCode, 200, knowledgeDraft.body);
    assert.equal(knowledgeDraft.json().item.mode, "full");
    assert.equal(knowledgeDraft.json().item.category, "code-review");
    assert.ok((knowledgeDraft.json().item.tags as string[]).includes("workflow"));
    assert.match(String(knowledgeDraft.json().item.content ?? ""), /运行输入/);

    const publishKnowledge = await app.inject({
      method: "POST",
      url: `/api/workflows/runs/${workflowRunId}/publish-knowledge`,
      headers,
      payload: {
        mode: "summary",
        title: "代码审查沉淀 - trace",
        summary: "审查结论已沉淀",
        category: "review-note",
        tags: ["review", "published"]
      }
    });
    assert.equal(publishKnowledge.statusCode, 201, publishKnowledge.body);
    const publishedEntryId = publishKnowledge.json().item.id as string;
    assert.equal(publishKnowledge.json().relation.runId, workflowRunId);

    const publishedKnowledge = await app.inject({
      method: "GET",
      url: `/api/knowledge/${publishedEntryId}`,
      headers
    });
    assert.equal(publishedKnowledge.statusCode, 200, publishedKnowledge.body);
    assert.equal(publishedKnowledge.json().item.title, "代码审查沉淀 - trace");
    assert.equal(publishedKnowledge.json().item.category, "review-note");
    assert.deepEqual(publishedKnowledge.json().item.tags, ["published", "review"]);
    assert.equal(publishedKnowledge.json().item.metadata.workflow.runId, workflowRunId);
    assert.equal(publishedKnowledge.json().item.metadata.workflow.templateId, "template-review");

    const publishKnowledgeAgain = await app.inject({
      method: "POST",
      url: `/api/workflows/runs/${workflowRunId}/publish-knowledge`,
      headers,
      payload: { mode: "summary" }
    });
    assert.equal(publishKnowledgeAgain.statusCode, 200, publishKnowledgeAgain.body);
    assert.equal(publishKnowledgeAgain.json().item.id, publishedEntryId);

    const shareRequest = await app.inject({
      method: "POST",
      url: "/api/memory-sharing/request",
      headers,
      payload: { memoryId: memory.id, visibility: "team" }
    });
    assert.equal(shareRequest.statusCode, 201, shareRequest.body);
    const shareId = shareRequest.json().item.id as string;

    const approveShare = await app.inject({ method: "POST", url: `/api/memory-sharing/${shareId}/review`, headers, payload: { action: "approve" } });
    assert.equal(approveShare.statusCode, 200, approveShare.body);
    const publishShare = await app.inject({ method: "POST", url: `/api/memory-sharing/${shareId}/review`, headers, payload: { action: "publish" } });
    assert.equal(publishShare.statusCode, 200, publishShare.body);

    const shareOverview = await app.inject({ method: "GET", url: "/api/memory-sharing/overview", headers });
    assert.equal(shareOverview.statusCode, 200, shareOverview.body);
    assert.equal(typeof shareOverview.json().summary.total, "number");

    const session = await core.sessions.create({ title: "trace-session", repoId: repoA?.id ?? repoB.id });
    const trace = core.database.agentTrace.append({
      sessionId: session.id,
      traceType: "request_completed",
      sourceType: "backend",
      summary: "trace done",
      status: "completed",
      payload: { ok: true },
      fileChanges: [{ path: "README.md", changeType: "modified", diff: "-old\n+new" }]
    });
    const traceList = await app.inject({ method: "GET", url: `/api/agents/traces/${session.id}`, headers });
    assert.equal(traceList.statusCode, 200, traceList.body);
    assert.ok((traceList.json().items as Array<{ id: string }>).some((item) => item.id === trace.id));
    const traceDetail = await app.inject({ method: "GET", url: `/api/agents/traces/${session.id}/${trace.id}`, headers });
    assert.equal(traceDetail.statusCode, 200, traceDetail.body);
    const traceDiff = await app.inject({ method: "GET", url: `/api/agents/traces/${session.id}/${trace.id}/diff?filePath=${encodeURIComponent("README.md")}`, headers });
    assert.equal(traceDiff.statusCode, 200, traceDiff.body);
    assert.equal(traceDiff.json().item.path, "README.md");
  } finally {
    await app.close();
  }
});

test("REST /api/workflows 支持模板元数据、知识草稿与发布闭环", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okk-workflow-knowledge-"));
  const workspaceRoot = path.join(tempDir, "workspace");
  await fs.mkdir(workspaceRoot, { recursive: true });

  const core = await createCore({ dbPath: ":memory:", workspaceRoot });
  const app = await createApp({ jwtSecret: "test-secret", logger: false, core });
  await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const token = await loginToken(app);
    const headers = { Authorization: `Bearer ${token}` };

    const templatesResponse = await app.inject({
      method: "GET",
      url: "/api/workflows/templates",
      headers
    });
    assert.equal(templatesResponse.statusCode, 200, templatesResponse.body);
    const templates = templatesResponse.json().items as Array<{
      id: string;
      name: string;
      metadata: Record<string, unknown>;
      nodes: Array<Record<string, unknown>>;
    }>;
    const reviewTemplate = templates.find((item) => item.id === "template-review");
    assert.ok(reviewTemplate);
    const reviewMetadata = reviewTemplate?.metadata as {
      knowledgePublishing?: { defaultMode?: string };
    } | undefined;
    assert.equal(reviewMetadata?.knowledgePublishing?.defaultMode, "summary");

    const workflowCreate = await app.inject({
      method: "POST",
      url: "/api/workflows",
      headers,
      payload: {
        name: "代码审查沉淀实例",
        description: "template based workflow",
        status: "active",
        metadata: reviewTemplate?.metadata,
        nodes: reviewTemplate?.nodes
      }
    });
    assert.equal(workflowCreate.statusCode, 201, workflowCreate.body);
    assert.equal(workflowCreate.json().item.metadata.templateId, "template-review");
    const workflowId = workflowCreate.json().item.id as string;

    const workflowRun = await app.inject({
      method: "POST",
      url: `/api/workflows/${workflowId}/run`,
      headers,
      payload: {
        input: {
          topic: "端到端知识沉淀"
        }
      }
    });
    assert.equal(workflowRun.statusCode, 200, workflowRun.body);
    assert.equal(workflowRun.json().item.status, "completed");
    const runId = workflowRun.json().item.id as string;
    assert.equal(workflowRun.json().item.metadata.workflowName, "代码审查沉淀实例");

    const draftResponse = await app.inject({
      method: "GET",
      url: `/api/workflows/runs/${runId}/knowledge-draft?mode=summary`,
      headers
    });
    assert.equal(draftResponse.statusCode, 200, draftResponse.body);
    assert.equal(draftResponse.json().item.mode, "summary");
    assert.equal(draftResponse.json().item.source.workflowId, workflowId);
    assert.equal(typeof draftResponse.json().item.repoId, "string");
    assert.ok((draftResponse.json().item.tags as string[]).includes("workflow"));

    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/workflows/runs/${runId}/publish-knowledge`,
      headers,
      payload: {
        mode: "full",
        title: "工作流审查沉淀",
        category: "guide",
        tags: ["workflow", "published"]
      }
    });
    assert.equal(publishResponse.statusCode, 201, publishResponse.body);
    const entryId = publishResponse.json().item.id as string;
    assert.equal(publishResponse.json().item.title, "工作流审查沉淀");
    assert.equal(publishResponse.json().run.metadata.publishedKnowledgeEntryId, entryId);

    const knowledgeResponse = await app.inject({
      method: "GET",
      url: `/api/knowledge/${entryId}`,
      headers
    });
    assert.equal(knowledgeResponse.statusCode, 200, knowledgeResponse.body);
    assert.equal(knowledgeResponse.json().item.metadata.workflow.workflowId, workflowId);
    assert.equal(knowledgeResponse.json().item.metadata.workflow.runId, runId);
    assert.equal(knowledgeResponse.json().item.metadata.workflow.mode, "full");
  } finally {
    await app.close();
  }
});
