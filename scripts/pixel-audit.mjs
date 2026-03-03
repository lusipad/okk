import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const OUTPUT_DIR = path.resolve("output/pixel");
const CURRENT_DIR = path.join(OUTPUT_DIR, "current");
const REPORT_PATH = path.join(OUTPUT_DIR, "audit-report.json");
const cliUiUrl = process.argv[2]?.trim();
const configuredUiUrl = process.env.OKCLAW_UI_URL?.trim();
const uiPortCandidates = [5173, 5174, 5175, 5176, 5177];

fs.mkdirSync(CURRENT_DIR, { recursive: true });

const TARGETS = [
  { key: "topbarHeight", expected: 42, tolerance: 2, unit: "px" },
  { key: "sidebarWidth", expected: 266, tolerance: 4, unit: "px" },
  { key: "chatPanelMaxWidth", expected: 960, tolerance: 8, unit: "px" },
  { key: "composerRadius", expected: 28, tolerance: 2, unit: "px" },
  { key: "emptyFontSize", expected: 36, tolerance: 2, unit: "px" },
  { key: "composerPlaceholderFontSize", expected: 34, tolerance: 2, unit: "px" },
  { key: "sidebarLinkFontSize", expected: 13, tolerance: 1, unit: "px" },
  { key: "userMarginPercent", expected: 26, tolerance: 2, unit: "%" },
  { key: "assistantMarginPercent", expected: 19, tolerance: 2, unit: "%" }
];

const VIEWPORTS = [
  { width: 1600, height: 900, name: "chat-empty-1600x900.png" },
  { width: 1920, height: 1080, name: "chat-empty-1920x1080.png" },
  { width: 1280, height: 800, name: "chat-empty-1280x800.png" }
];

async function waitForVisible(locator, timeout = 15000) {
  await locator.waitFor({ state: "visible", timeout });
}

function parsePx(input) {
  if (!input) return null;
  const value = Number.parseFloat(String(input).replace("px", "").trim());
  return Number.isFinite(value) ? value : null;
}

function passWithin(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

async function pickUiUrl() {
  if (cliUiUrl) {
    return cliUiUrl;
  }
  if (configuredUiUrl) {
    return configuredUiUrl;
  }
  for (const port of uiPortCandidates) {
    const candidate = `http://127.0.0.1:${port}`;
    try {
      const source = await fetch(`${candidate}/src/App.tsx`, { signal: AbortSignal.timeout(1500) });
      if (!source.ok) {
        continue;
      }
      const text = await source.text();
      if (text.includes("okclaw.theme") && text.includes("ChatPage")) {
        return candidate;
      }
    } catch {
      // try next
    }
  }
  return "http://127.0.0.1:5173";
}

function formatRow(row) {
  const status = row.pass ? "PASS" : "FAIL";
  return `${status.padEnd(4)} ${row.key.padEnd(28)} actual=${row.actual.toFixed(2)} target=${row.expected} +/- ${row.tolerance} ${row.unit}`;
}

const { chromium } = await import("playwright");
const uiUrl = await pickUiUrl();

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => {
  localStorage.setItem("okclaw.jwt", "pixel-audit-token");
  if (!localStorage.getItem("okclaw.theme")) {
    localStorage.setItem("okclaw.theme", "dark");
  }
});
await page.goto(uiUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
await waitForVisible(page.getByTestId("composer-input"), 20000);
await page.waitForTimeout(800);

const newChatButton = page.getByRole("button", { name: /New chat|新建/i }).first();
if (await newChatButton.count()) {
  await newChatButton.click().catch(() => {});
  await page.waitForTimeout(400);
}

await page.evaluate(() => {
  document.querySelectorAll(".connection-banner, .chat-alert").forEach((node) => node.remove());
  document.querySelectorAll(".chat-panel > .panel-header").forEach((node) => node.remove());
});

for (const viewport of VIEWPORTS) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(CURRENT_DIR, viewport.name) });
}

await page.setViewportSize({ width: 1600, height: 900 });
await page.waitForTimeout(300);

const rawMetrics = await page.evaluate(() => {
  const px = (v) => {
    const parsed = Number.parseFloat(String(v ?? "").replace("px", ""));
    return Number.isFinite(parsed) ? parsed : -1;
  };
  const topbar = document.querySelector(".app-topbar");
  const sidebar = document.querySelector(".left-column .left-sidebar-panel");
  const chatPanel = document.querySelector(".chat-panel");
  const composerShell = document.querySelector(".composer-input-shell");
  const empty = document.querySelector(".message-empty-state");
  const composerInput = document.querySelector(".composer textarea");
  const sidebarLink = document.querySelector(".sidebar-link");
  const messageList = document.querySelector(".message-list");

  const syntheticUser = document.createElement("article");
  syntheticUser.className = "message-item role-user";
  (messageList ?? document.body).appendChild(syntheticUser);
  const syntheticAssistant = document.createElement("article");
  syntheticAssistant.className = "message-item role-assistant";
  (messageList ?? document.body).appendChild(syntheticAssistant);

  const topbarRect = topbar?.getBoundingClientRect();
  const sidebarRect = sidebar?.getBoundingClientRect();
  const chatRect = chatPanel?.getBoundingClientRect();
  const composerStyle = composerShell ? getComputedStyle(composerShell) : null;
  const emptyStyle = empty ? getComputedStyle(empty) : null;
  const composerInputStyle = composerInput ? getComputedStyle(composerInput) : null;
  const sidebarStyle = sidebarLink ? getComputedStyle(sidebarLink) : null;
  const userStyle = getComputedStyle(syntheticUser);
  const assistantStyle = getComputedStyle(syntheticAssistant);

  const containerWidth = (messageList?.getBoundingClientRect().width ?? 1);
  const userMarginPercent = (px(userStyle.marginLeft) / containerWidth) * 100;
  const assistantMarginPercent = (px(assistantStyle.marginRight) / containerWidth) * 100;

  syntheticUser.remove();
  syntheticAssistant.remove();

  return {
    topbarHeight: topbarRect?.height ?? 0,
    sidebarWidth: sidebarRect?.width ?? 0,
    chatPanelMaxWidth: chatRect?.width ?? 0,
    composerRadius: px(composerStyle?.borderTopLeftRadius),
    emptyFontSize: px(emptyStyle?.fontSize),
    composerPlaceholderFontSize: px(composerInputStyle?.fontSize),
    sidebarLinkFontSize: px(sidebarStyle?.fontSize),
    userMarginPercent,
    assistantMarginPercent
  };
});

const rows = TARGETS.map((target) => {
  const value = rawMetrics[target.key];
  const actual = typeof value === "number" ? value : parsePx(value);
  const numeric = Number.isFinite(actual) ? actual : NaN;
  return {
    ...target,
    actual: numeric,
    pass: Number.isFinite(numeric) && passWithin(numeric, target.expected, target.tolerance)
  };
});

const failed = rows.filter((row) => !row.pass);
const report = {
  uiUrl,
  generatedAt: new Date().toISOString(),
  rows,
  passed: failed.length === 0
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log(`pixel_audit_report=${REPORT_PATH}`);
for (const row of rows) {
  console.log(formatRow(row));
}

await browser.close();

if (failed.length > 0) {
  console.error(`pixel_audit_failed=${failed.length}`);
  process.exit(1);
}

console.log("pixel_audit_passed=true");
