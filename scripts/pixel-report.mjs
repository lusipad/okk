import fs from "node:fs";
import path from "node:path";

const reportPath = path.resolve("output/pixel/audit-report.json");
const outputPath = path.resolve("output/pixel/report.md");

if (!fs.existsSync(reportPath)) {
  console.error(`missing_report=${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
const rows = Array.isArray(report.rows) ? report.rows : [];

const lines = [];
lines.push("# Pixel Audit Report");
lines.push("");
lines.push(`- Generated At: ${report.generatedAt ?? "unknown"}`);
lines.push(`- UI URL: ${report.uiUrl ?? "unknown"}`);
lines.push(`- Passed: ${report.passed ? "YES" : "NO"}`);
lines.push("");
lines.push("| Metric | Actual | Target | Tolerance | Pass |");
lines.push("| --- | ---: | ---: | ---: | :---: |");

for (const row of rows) {
  const actual = typeof row.actual === "number" ? row.actual.toFixed(2) : String(row.actual ?? "n/a");
  lines.push(`| ${row.key} | ${actual} | ${row.expected} ${row.unit} | +/- ${row.tolerance} ${row.unit} | ${row.pass ? "PASS" : "FAIL"} |`);
}

lines.push("");
lines.push("## Artifacts");
lines.push("- output/pixel/current/chat-empty-1600x900.png");
lines.push("- output/pixel/current/chat-empty-1920x1080.png");
lines.push("- output/pixel/current/chat-empty-1280x800.png");

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(`pixel_report=${outputPath}`);
