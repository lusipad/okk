import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");

async function copyRendererAssets() {
  await mkdir(path.join(packageRoot, "dist", "renderer"), { recursive: true });
  await cp(
    path.join(packageRoot, "src", "renderer", "search.html"),
    path.join(packageRoot, "dist", "renderer", "search.html")
  );
}

async function copyWebAssets() {
  await cp(
    path.join(packageRoot, "..", "web-frontend", "dist"),
    path.join(packageRoot, "dist", "web-frontend"),
    { recursive: true, force: true }
  );
}

async function copyBackendAssets() {
  await cp(
    path.join(packageRoot, "..", "web-backend", "dist"),
    path.join(packageRoot, "dist", "backend"),
    { recursive: true, force: true }
  );
}

async function main() {
  const target = process.argv[2];

  if (target === "renderer") {
    await copyRendererAssets();
    return;
  }

  if (target === "web") {
    await copyWebAssets();
    return;
  }

  if (target === "backend") {
    await copyBackendAssets();
    return;
  }

  throw new Error(`Unknown copy target: ${target}`);
}

void main();
