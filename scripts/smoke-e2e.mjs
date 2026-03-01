import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const outputDir = path.resolve("output/playwright");
fs.mkdirSync(outputDir, { recursive: true });

const configuredUiUrl = process.env.OKCLAW_UI_URL?.trim();
const apiUrl = process.env.OKCLAW_API_URL ?? "http://127.0.0.1:3000";
const username = process.env.OKCLAW_USER ?? "admin";
const password = process.env.OKCLAW_PASS ?? "admin";
const mockMcpScriptPath = path.resolve("scripts/mock-mcp-server.mjs").replace(/\\/g, "/");
const uiPortCandidates = [5173, 5174, 5175, 5176, 5177];

async function waitForVisible(locator, timeout = 15000) {
  await locator.waitFor({ state: "visible", timeout });
}

async function pickUiUrl() {
  if (configuredUiUrl) {
    return configuredUiUrl;
  }

  for (const port of uiPortCandidates) {
    const candidate = `http://127.0.0.1:${port}`;
    try {
      const response = await fetch(candidate, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }

  return "http://127.0.0.1:5173";
}

async function ensureLoggedIn(page, { username, password }) {
  const composerInput = page.getByTestId("composer-input");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await waitForVisible(composerInput, 3500);
      return;
    } catch {
      // continue to login flow
    }

    const loginUsername = page.getByTestId("login-username");
    if (!(await loginUsername.count())) {
      await page.waitForTimeout(800);
      continue;
    }

    await waitForVisible(loginUsername, 10000);
    await loginUsername.fill(username);
    await page.getByTestId("login-password").fill(password);
    await page.getByTestId("login-submit").click();

    try {
      await waitForVisible(composerInput, 12000);
      return;
    } catch {
      const errorLocator = page.locator(".error-text").first();
      const errorText = (await errorLocator.count())
        ? ((await errorLocator.textContent()) ?? "").trim()
        : "";
      console.error(`login_retry_${attempt}=failed${errorText ? `:${errorText}` : ""}`);
      await page.waitForTimeout(1500);
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }

  throw new Error("login failed after retries");
}

const { chromium } = await import("playwright");

let browser;
let page;
let importedSkillId = null;
let createdMcpId = null;
let tempSkillDir = null;
let baseUrl = "http://127.0.0.1:5173";

try {
  baseUrl = await pickUiUrl();
  console.log(`ui_url=${baseUrl}`);
  const healthResponse = await fetch(`${apiUrl}/healthz`);
  const healthJson = await healthResponse.json();
  const coreMode = typeof healthJson.coreMode === "string" ? healthJson.coreMode : "unknown";
  console.log(`health_core_mode=${coreMode}`);
  if (coreMode !== "real") {
    throw new Error(`expected coreMode=real, got ${coreMode}`);
}

  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    console.log("browser=chrome-channel");
  } catch {
    browser = await chromium.launch({ headless: true });
    console.log("browser=chromium-fallback");
  }

  page = await browser.newPage();
  page.on("pageerror", (err) => {
    console.error(`pageerror=${err.message}`);
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await ensureLoggedIn(page, { username, password });
  await waitForVisible(page.getByTestId("composer-input"), 20000);
  console.log(`url_after_login=${page.url()}`);

  const createSessionButton = page.getByRole("button", { name: "新建" }).first();
  if (await createSessionButton.count()) {
    await createSessionButton.click();
    await page.waitForTimeout(800);
  }

  const agentSelect = page.locator("#agent-select");
  if (await agentSelect.count()) {
    const optionCount = await agentSelect.locator("option").count();
    const optionLabels = await agentSelect.locator("option").allTextContents();
    console.log(`agent_options=${optionLabels.join("|")}`);
    const preferredIndex = optionLabels.findIndex((item) => item.includes("code-reviewer"));
    if (preferredIndex >= 0) {
      await agentSelect.selectOption({ index: preferredIndex });
    } else if (optionCount > 0) {
      await agentSelect.selectOption({ index: 0 });
    }
    const selectedLabel = await agentSelect.locator("option:checked").textContent();
    console.log(`agent_selected=${(selectedLabel ?? "").trim()}`);
  }

  const prompt = `请只回复 smoke-ok-${Date.now()}，不要解释。`;
  await page.getByTestId("composer-input").fill(prompt);
  await page.getByTestId("composer-send").click();

  const assistantItems = page.locator(".message-item.role-assistant");
  await assistantItems.first().waitFor({ state: "visible", timeout: 120000 });

  let streamBadgeSeen = false;
  try {
    await page.locator(".message-item.role-assistant:last-child .pill-running").first().waitFor({ state: "visible", timeout: 15000 });
    streamBadgeSeen = true;
  } catch {
    streamBadgeSeen = false;
  }

  let completion = "done";
  const assistantContentLocator = page.locator(".message-item.role-assistant:last-child [data-testid='message-content']");
  let assistantText = "";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    assistantText = ((await assistantContentLocator.textContent()) ?? "").replace(/\s+/g, " ").trim();
    if (assistantText && assistantText !== "正在流式输出") {
      break;
    }
    await page.waitForTimeout(1000);
  }

  if (!assistantText || assistantText === "正在流式输出") {
    completion = "stop_requested";
    const stopButton = page.getByRole("button", { name: /Stop/ });
    if (await stopButton.count()) {
      await stopButton.first().click();
      await page.waitForTimeout(1500);
      assistantText = ((await assistantContentLocator.textContent()) ?? "").replace(/\s+/g, " ").trim();
    }
  }

  console.log(`assistant_text_head=${assistantText.slice(0, 200)}`);
  console.log(`assistant_stream_badge_seen=${streamBadgeSeen}`);

  if (!assistantText || assistantText === "正在流式输出") {
    throw new Error("assistant text is empty");
  }

  await page.getByTestId("nav-mcp").click();
  await waitForVisible(page.getByTestId("mcp-server-list"), 20000);
  const jwtToken = await page.evaluate(() => localStorage.getItem("okclaw.jwt") ?? "");
  if (!jwtToken) {
    throw new Error("missing jwt after login");
  }
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwtToken}`
  };
  const mcpName = `smoke-mcp-${Date.now()}`;
  const createdMcp = await fetch(`${apiUrl}/api/mcp/servers`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: mcpName,
      description: "smoke runtime mcp",
      command: "node",
      args: [mockMcpScriptPath],
      enabled: false
    })
  });
  if (!createdMcp.ok) {
    throw new Error(`create mcp failed: ${createdMcp.status}`);
  }
  const createdMcpJson = await createdMcp.json();
  createdMcpId = createdMcpJson.id;
  if (!createdMcpId) {
    throw new Error("create mcp missing id");
  }
  const startedMcp = await fetch(`${apiUrl}/api/mcp/servers/${createdMcpId}/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwtToken}`
    }
  });
  if (!startedMcp.ok) {
    throw new Error(`start mcp failed: ${startedMcp.status}`);
  }
  const toolsRes = await fetch(`${apiUrl}/api/mcp/servers/${createdMcpId}/tools`, {
    headers: {
      Authorization: `Bearer ${jwtToken}`
    }
  });
  if (!toolsRes.ok) {
    throw new Error(`list tools failed: ${toolsRes.status}`);
  }
  const toolsJson = await toolsRes.json();
  const toolNames = Array.isArray(toolsJson.items) ? toolsJson.items.map((item) => item.name) : [];
  if (!toolNames.includes("echo")) {
    throw new Error("mcp tool echo not found");
  }
  const callRes = await fetch(`${apiUrl}/api/mcp/servers/${createdMcpId}/tools/call`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "echo",
      arguments: {
        text: "smoke"
      }
    })
  });
  if (!callRes.ok) {
    throw new Error(`call tool failed: ${callRes.status}`);
  }
  const callJson = await callRes.json();
  if (!String(callJson.content ?? "").includes("echo:smoke")) {
    throw new Error("mcp runtime tool output mismatch");
  }
  const resourcesRes = await fetch(`${apiUrl}/api/mcp/servers/${createdMcpId}/resources`, {
    headers: {
      Authorization: `Bearer ${jwtToken}`
    }
  });
  if (!resourcesRes.ok) {
    throw new Error(`list resources failed: ${resourcesRes.status}`);
  }
  const resourcesJson = await resourcesRes.json();
  const firstUri = Array.isArray(resourcesJson.items) ? resourcesJson.items[0]?.uri : null;
  if (!firstUri) {
    throw new Error("mcp resources empty");
  }
  const readRes = await fetch(`${apiUrl}/api/mcp/servers/${createdMcpId}/resources/read`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      uri: firstUri
    })
  });
  if (!readRes.ok) {
    throw new Error(`read resource failed: ${readRes.status}`);
  }
  const readJson = await readRes.json();
  const firstText = Array.isArray(readJson.contents) ? readJson.contents[0]?.text : "";
  if (!String(firstText).includes("hello from mock mcp")) {
    throw new Error("mcp runtime resource output mismatch");
  }

  await page.getByTestId("nav-skills").click();
  await waitForVisible(page.getByTestId("skill-list"), 20000);

  const skills = page.locator("[data-testid^='skill-item-']");
  await skills.first().waitFor({ state: "visible", timeout: 15000 });
  await skills.first().locator("[data-testid^='skill-detail-']").click();
  await page.waitForTimeout(1200);

  tempSkillDir = await fsp.mkdtemp(path.join(os.tmpdir(), "okclaw-skill-e2e-"));
  const skillFolder = path.join(tempSkillDir, "smoke-skill");
  await fsp.mkdir(skillFolder, { recursive: true });
  await fsp.writeFile(
    path.join(skillFolder, "SKILL.md"),
    `---\nname: smoke-skill\ndescription: smoke e2e skill\nversion: 0.0.1\n---\n# smoke\n\nRun smoke skill.\n`,
    "utf-8"
  );

  await page.getByTestId("skill-import-folder").fill(skillFolder);
  await page.getByTestId("skill-import-target").fill("smoke-skill-e2e");
  await page.getByTestId("skill-import-submit").click();

  const importedSkill = page.locator("[data-testid='skill-item-smoke-skill-e2e']");
  await importedSkill.waitFor({ state: "visible", timeout: 20000 });
  importedSkillId = "smoke-skill-e2e";
  await importedSkill.locator("[data-testid='skill-detail-smoke-skill-e2e']").click();
  await page.waitForTimeout(800);

  const screenshotPath = path.join(outputDir, "e2e-success.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log("login_ok=true");
  console.log("chat_ok=true");
  console.log(`chat_completion=${completion}`);
  console.log("mcp_ok=true");
  console.log("skills_ok=true");
  console.log(`screenshot=${screenshotPath}`);
} catch (error) {
  console.error("e2e_ok=false");
  console.error(error instanceof Error ? error.message : String(error));
  if (page) {
    const failShot = path.join(outputDir, "e2e-failed.png");
    await page.screenshot({ path: failShot, fullPage: true }).catch(() => {});
    console.error(`screenshot=${failShot}`);
  }
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
  if (tempSkillDir) {
    await fsp.rm(tempSkillDir, { recursive: true, force: true }).catch(() => {});
  }
  if (importedSkillId) {
    // Best-effort cleanup through API to avoid state accumulation across runs.
    await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        const token = data?.token;
        if (typeof token !== "string" || !token) {
          return;
        }
        await fetch(`${apiUrl}/api/skills/${importedSkillId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      })
      .catch(() => {});
  }
  if (createdMcpId) {
    await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        const token = data?.token;
        if (typeof token !== "string" || !token) {
          return;
        }
        await fetch(`${apiUrl}/api/mcp/servers/${createdMcpId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      })
      .catch(() => {});
  }
  }
