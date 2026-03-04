import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/playwright/chrome-compare");
const LOCAL_URL = process.env.OKCLAW_UI_URL || "http://127.0.0.1:5199";
const VIEWPORT = { width: 1600, height: 900 };

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const targets = [
  { key: "official-chatgpt", url: "https://chatgpt.com" },
  { key: "official-claude", url: "https://claude.ai" },
  { key: "official-chatgpt-site", url: "https://openai.com/chatgpt/" },
  { key: "official-claude-site", url: "https://www.anthropic.com/claude" },
  { key: "official-opencowork", url: "https://opencowork.com" },
  { key: "okclaw-local", url: LOCAL_URL }
];

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

const page = await browser.newPage({ viewport: VIEWPORT });
await page.addInitScript(() => {
  localStorage.setItem("okclaw.jwt", "chrome-compare-token");
  if (!localStorage.getItem("okclaw.theme")) {
    localStorage.setItem("okclaw.theme", "dark");
  }
});
const results = [];

for (const target of targets) {
  const outputPath = path.join(OUTPUT_DIR, `${target.key}-${VIEWPORT.width}x${VIEWPORT.height}.png`);
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    let localMetrics = null;
    if (target.key === "okclaw-local") {
      localMetrics = await page.evaluate(() => {
        document.querySelectorAll(".connection-banner, .chat-alert").forEach((node) => node.remove());
        document.querySelectorAll(".capability-warning-bar").forEach((node) => node.remove());
        const topbar = document.querySelector(".app-topbar");
        const sidebar = document.querySelector(".left-column .left-sidebar-panel");
        const messageList = document.querySelector(".message-list");
        const composer = document.querySelector(".composer textarea");
        return {
          url: location.href,
          hasTopbar: Boolean(topbar),
          hasSidebar: Boolean(sidebar),
          hasMessageList: Boolean(messageList),
          hasComposer: Boolean(composer),
          topbarHeight: topbar instanceof HTMLElement ? topbar.getBoundingClientRect().height : null,
          sidebarWidth: sidebar instanceof HTMLElement ? sidebar.getBoundingClientRect().width : null
        };
      });
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: outputPath });
    results.push({ ...target, outputPath, pass: true, metrics: localMetrics });
    console.log(`compare_capture_ok=${target.key} path=${outputPath}`);
  } catch (error) {
    results.push({
      ...target,
      outputPath: null,
      pass: false,
      error: error instanceof Error ? error.message : String(error)
    });
    console.log(`compare_capture_fail=${target.key} reason=${error instanceof Error ? error.message : String(error)}`);
  }
}

const reportPath = path.join(OUTPUT_DIR, "report.json");
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      viewport: VIEWPORT,
      localUrl: LOCAL_URL,
      results
    },
    null,
    2
  )
);

console.log(`compare_report=${reportPath}`);
await browser.close();
