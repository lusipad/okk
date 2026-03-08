import type { DesktopRuntimeState } from "../shared/runtime.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDesktopRuntimePage(state: DesktopRuntimeState): string {
  const checksHtml = state.checks
    .map(
      (check) => `
        <li>
          <strong>${escapeHtml(check.label)}</strong>
          <span>${escapeHtml(check.status)}</span>
          <p>${escapeHtml(check.summary)}</p>
          ${check.detail ? `<pre>${escapeHtml(check.detail)}</pre>` : ""}
        </li>`
    )
    .join("");
  const diagnosticsHtml = state.diagnostics
    .map(
      (item) => `
        <section>
          <h3>${escapeHtml(item.message)}</h3>
          ${item.code ? `<p>${escapeHtml(item.code)}</p>` : ""}
          ${item.detail ? `<pre>${escapeHtml(item.detail)}</pre>` : ""}
        </section>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>OKK Desktop Runtime</title></head>
  <body>
    <main>
      <h1>${escapeHtml(state.status === "error" ? "桌面运行异常" : "桌面启动中")}</h1>
      <ul>${checksHtml}</ul>
      ${diagnosticsHtml}
    </main>
  </body>
</html>`;
}
