import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const REFERENCE_DIR = path.resolve("docs/pixel-clone/reference");
const CURRENT_DIR = path.resolve("output/pixel/current");
const DIFF_DIR = path.resolve("output/pixel/reference-diff");
const REPORT_PATH = path.resolve("output/pixel/reference-diff-report.json");
const args = new Set(process.argv.slice(2));
const referenceRequired = process.env.OKCLAW_PIXEL_REFERENCE_REQUIRED === "1" || args.has("--required");
const exactDimensionsRequired =
  process.env.OKCLAW_PIXEL_REFERENCE_EXACT_DIMENSIONS === "1" || args.has("--exact-dimensions") || referenceRequired;

const FULL_THRESHOLD_PERCENT = Number(process.env.OKCLAW_PIXEL_REFERENCE_FULL_THRESHOLD ?? "8");
const KEY_THRESHOLD_PERCENT = Number(process.env.OKCLAW_PIXEL_REFERENCE_KEY_THRESHOLD ?? "5");

if (!fs.existsSync(REFERENCE_DIR)) {
  if (referenceRequired) {
    console.error(`missing_reference_dir=${REFERENCE_DIR}`);
    process.exit(1);
  }
  console.warn(`missing_reference_dir=${REFERENCE_DIR}`);
  console.log("pixel_reference_diff_skipped=true");
  process.exit(0);
}

if (!fs.existsSync(CURRENT_DIR)) {
  console.error(`missing_current_dir=${CURRENT_DIR}`);
  process.exit(1);
}

const referenceImages = fs
  .readdirSync(REFERENCE_DIR)
  .filter((name) => name.toLowerCase().endsWith(".png"))
  .sort();

if (referenceImages.length === 0) {
  if (referenceRequired) {
    console.error("missing_reference_images=0");
    process.exit(1);
  }
  console.warn("missing_reference_images=0");
  console.log("pixel_reference_diff_skipped=true");
  process.exit(0);
}

fs.mkdirSync(DIFF_DIR, { recursive: true });

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function regionPixels(png, x, y, width, height) {
  const target = new PNG({ width, height });
  PNG.bitblt(png, target, x, y, width, height, 0, 0);
  return target;
}

function scaleTo(png, width, height) {
  const scaled = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(png.height - 1, Math.floor((y / height) * png.height));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(png.width - 1, Math.floor((x / width) * png.width));
      const sourceIdx = (sy * png.width + sx) << 2;
      const targetIdx = (y * width + x) << 2;
      scaled.data[targetIdx] = png.data[sourceIdx];
      scaled.data[targetIdx + 1] = png.data[sourceIdx + 1];
      scaled.data[targetIdx + 2] = png.data[sourceIdx + 2];
      scaled.data[targetIdx + 3] = png.data[sourceIdx + 3];
    }
  }
  return scaled;
}

function percent(diffPixels, totalPixels) {
  if (totalPixels <= 0) return 100;
  return (diffPixels / totalPixels) * 100;
}

const results = [];

for (const name of referenceImages) {
  const referencePath = path.join(REFERENCE_DIR, name);
  const currentPath = path.join(CURRENT_DIR, name);
  const diffPath = path.join(DIFF_DIR, name);

  if (!fs.existsSync(currentPath)) {
    results.push({ name, pass: false, reason: "missing_current_image" });
    continue;
  }

  const referenceRaw = readPng(referencePath);
  const currentRaw = readPng(currentPath);
  const sameDimensions = referenceRaw.width === currentRaw.width && referenceRaw.height === currentRaw.height;
  if (exactDimensionsRequired && !sameDimensions) {
    results.push({
      name,
      pass: false,
      reason: "dimension_mismatch",
      referenceSize: `${referenceRaw.width}x${referenceRaw.height}`,
      currentSize: `${currentRaw.width}x${currentRaw.height}`
    });
    continue;
  }

  const width = Math.min(referenceRaw.width, currentRaw.width);
  const height = Math.min(referenceRaw.height, currentRaw.height);

  if (width < 200 || height < 200) {
    results.push({ name, pass: false, reason: "image_too_small" });
    continue;
  }

  const reference = scaleTo(referenceRaw, width, height);
  const current = scaleTo(currentRaw, width, height);

  const diff = new PNG({ width, height });
  const fullDiffPixels = pixelmatch(reference.data, current.data, diff.data, width, height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const topbarHeight = Math.max(40, Math.round(height * 0.06));
  const sidebarWidth = Math.max(220, Math.round(width * 0.18));
  const composerHeight = Math.max(180, Math.round(height * 0.28));

  const topbarReference = regionPixels(reference, 0, 0, width, topbarHeight);
  const topbarCurrent = regionPixels(current, 0, 0, width, topbarHeight);
  const sidebarReference = regionPixels(reference, 0, 0, sidebarWidth, height);
  const sidebarCurrent = regionPixels(current, 0, 0, sidebarWidth, height);
  const composerReference = regionPixels(reference, 0, height - composerHeight, width, composerHeight);
  const composerCurrent = regionPixels(current, 0, height - composerHeight, width, composerHeight);

  const topbarDiff = pixelmatch(
    topbarReference.data,
    topbarCurrent.data,
    null,
    topbarReference.width,
    topbarReference.height,
    { threshold: 0.1 }
  );
  const sidebarDiff = pixelmatch(
    sidebarReference.data,
    sidebarCurrent.data,
    null,
    sidebarReference.width,
    sidebarReference.height,
    { threshold: 0.1 }
  );
  const composerDiff = pixelmatch(
    composerReference.data,
    composerCurrent.data,
    null,
    composerReference.width,
    composerReference.height,
    { threshold: 0.1 }
  );

  const fullDiffPercent = percent(fullDiffPixels, width * height);
  const topbarPercent = percent(topbarDiff, topbarReference.width * topbarReference.height);
  const sidebarPercent = percent(sidebarDiff, sidebarReference.width * sidebarReference.height);
  const composerPercent = percent(composerDiff, composerReference.width * composerReference.height);
  const keyDiffPercent = Math.max(topbarPercent, sidebarPercent, composerPercent);
  const pass = fullDiffPercent < FULL_THRESHOLD_PERCENT && keyDiffPercent < KEY_THRESHOLD_PERCENT;

  results.push({
    name,
    pass,
    width,
    height,
    fullDiffPercent,
    keyDiffPercent,
    topbarPercent,
    sidebarPercent,
    composerPercent,
    diffImage: diffPath
  });
}

const failed = results.filter((item) => !item.pass);
const report = {
  generatedAt: new Date().toISOString(),
  thresholds: {
    full: FULL_THRESHOLD_PERCENT,
    key: KEY_THRESHOLD_PERCENT
  },
  results,
  passed: failed.length === 0
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`pixel_reference_diff_report=${REPORT_PATH}`);

for (const item of results) {
  if (!item.fullDiffPercent && item.fullDiffPercent !== 0) {
    const sizeInfo =
      item.reason === "dimension_mismatch"
        ? ` reference=${item.referenceSize ?? "unknown"} current=${item.currentSize ?? "unknown"}`
        : "";
    console.log(`FAIL ${item.name} reason=${item.reason}${sizeInfo}`);
    continue;
  }
  const status = item.pass ? "PASS" : "FAIL";
  console.log(
    `${status} ${item.name} full=${item.fullDiffPercent.toFixed(3)}% key=${item.keyDiffPercent.toFixed(3)}%`
  );
}

if (failed.length > 0) {
  console.error(`pixel_reference_diff_failed=${failed.length}`);
  process.exit(1);
}

console.log("pixel_reference_diff_passed=true");
