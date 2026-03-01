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

    const suggestionEvent = await waitForQaEvent(socket, "knowledge_suggestion");
    const suggestion = suggestionEvent.payload.suggestion as { id: string; title: string };
    assert.equal(typeof suggestion.id, "string");

    const saveResponse = await app.inject({
      method: "POST",
      url: `/api/knowledge/suggestions/${suggestion.id}/save`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sessionId: "session-knowledge",
      },
    });
    assert.equal(saveResponse.statusCode, 200, saveResponse.body);
    assert.equal(saveResponse.json().status, "saved");

    const knowledgeListAfterSave = await app.inject({
      method: "GET",
      url: "/api/knowledge",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(knowledgeListAfterSave.statusCode, 200);
    const itemsAfterSave = knowledgeListAfterSave.json().items as Array<{ title: string }>;
    assert.ok(itemsAfterSave.some((item) => item.title === suggestion.title));

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
  const previousSkillMarketPath = process.env.OKCLAW_SKILL_MARKET_PATH;
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
          text: "okclaw",
        },
      },
    });
    assert.equal(toolCall.statusCode, 200);
    assert.match(String(toolCall.json().content ?? ""), /echo:okclaw/);

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

    const importDir = await fs.mkdtemp(path.join(os.tmpdir(), "okclaw-skill-test-"));
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

    marketTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okclaw-skill-market-"));
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
    process.env.OKCLAW_SKILL_MARKET_PATH = marketIndexPath;

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
      delete process.env.OKCLAW_SKILL_MARKET_PATH;
    } else {
      process.env.OKCLAW_SKILL_MARKET_PATH = previousSkillMarketPath;
    }
    if (marketTempDir) {
      await fs.rm(marketTempDir, { recursive: true, force: true });
    }
    await app.close();
  }
});

test("REST /api/knowledge 支持 CRUD、版本与 FTS 过滤搜索", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "okclaw-knowledge-api-"));
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

