import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const releaseDir = path.join(root, "release");
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

const packages = ["core", "web-backend", "web-frontend", "desktop"];
for (const pkg of packages) {
  const src = path.join(root, "packages", pkg, "dist");
  if (fs.existsSync(src)) {
    const dest = path.join(releaseDir, pkg);
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  packages,
};

fs.writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify(report, null, 2), "utf8");
execSync("npm pack --workspaces --pack-destination release", { stdio: "inherit" });
