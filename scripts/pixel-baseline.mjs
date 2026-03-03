import fs from "node:fs";
import path from "node:path";

const CURRENT_DIR = path.resolve("output/pixel/current");
const BASELINE_DIR = path.resolve("docs/pixel-clone/baseline");

if (!fs.existsSync(CURRENT_DIR)) {
  console.error(`missing_current_dir=${CURRENT_DIR}`);
  process.exit(1);
}

const currentImages = fs
  .readdirSync(CURRENT_DIR)
  .filter((name) => name.toLowerCase().endsWith(".png"))
  .sort();

if (currentImages.length === 0) {
  console.error("missing_current_images=0");
  process.exit(1);
}

fs.mkdirSync(BASELINE_DIR, { recursive: true });

for (const name of currentImages) {
  const source = path.join(CURRENT_DIR, name);
  const target = path.join(BASELINE_DIR, name);
  fs.copyFileSync(source, target);
  console.log(`baseline_image=${target}`);
}

console.log(`baseline_total=${currentImages.length}`);
