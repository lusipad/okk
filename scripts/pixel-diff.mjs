import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const BASELINE_DIR = path.resolve("docs/pixel-clone/baseline");
const CURRENT_DIR = path.resolve("output/pixel/current");
const DIFF_DIR = path.resolve("output/pixel/diff");
const REPORT_PATH = path.resolve("output/pixel/diff-report.json");

const FULL_THRESHOLD_PERCENT = 2.0;
const KEY_THRESHOLD_PERCENT = 1.0;

if (!fs.existsSync(BASELINE_DIR)) {
  console.error(`missing_baseline_dir=${BASELINE_DIR}`);
  process.exit(1);
}

if (!fs.existsSync(CURRENT_DIR)) {
  console.error(`missing_current_dir=${CURRENT_DIR}`);
  process.exit(1);
}

const baselineImages = fs
  .readdirSync(BASELINE_DIR)
  .filter((name) => name.toLowerCase().endsWith(".png"))
  .sort();

if (baselineImages.length === 0) {
  console.error("missing_baseline_images=0");
  process.exit(1);
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

function percent(diffPixels, totalPixels) {
  if (totalPixels <= 0) return 100;
  return (diffPixels / totalPixels) * 100;
}

const results = [];

for (const name of baselineImages) {
  const baselinePath = path.join(BASELINE_DIR, name);
  const currentPath = path.join(CURRENT_DIR, name);
  const diffPath = path.join(DIFF_DIR, name);

  if (!fs.existsSync(currentPath)) {
    results.push({ name, pass: false, reason: "missing_current_image" });
    continue;
  }

  const baseline = readPng(baselinePath);
  const current = readPng(currentPath);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    results.push({
      name,
      pass: false,
      reason: "dimension_mismatch",
      baseline: `${baseline.width}x${baseline.height}`,
      current: `${current.width}x${current.height}`
    });
    continue;
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const fullDiffPixels = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, {
    threshold: 0.1
  });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = baseline.width * baseline.height;
  const fullDiffPercent = percent(fullDiffPixels, totalPixels);

  const topbarHeight = Math.max(40, Math.round(baseline.height * 0.06));
  const sidebarWidth = Math.max(220, Math.round(baseline.width * 0.18));
  const composerHeight = Math.max(180, Math.round(baseline.height * 0.28));

  const topbarBaseline = regionPixels(baseline, 0, 0, baseline.width, topbarHeight);
  const topbarCurrent = regionPixels(current, 0, 0, baseline.width, topbarHeight);
  const sidebarBaseline = regionPixels(baseline, 0, 0, sidebarWidth, baseline.height);
  const sidebarCurrent = regionPixels(current, 0, 0, sidebarWidth, baseline.height);
  const composerBaseline = regionPixels(
    baseline,
    0,
    baseline.height - composerHeight,
    baseline.width,
    composerHeight
  );
  const composerCurrent = regionPixels(
    current,
    0,
    current.height - composerHeight,
    current.width,
    composerHeight
  );

  const topbarDiff = pixelmatch(
    topbarBaseline.data,
    topbarCurrent.data,
    null,
    topbarBaseline.width,
    topbarBaseline.height,
    { threshold: 0.1 }
  );
  const sidebarDiff = pixelmatch(
    sidebarBaseline.data,
    sidebarCurrent.data,
    null,
    sidebarBaseline.width,
    sidebarBaseline.height,
    { threshold: 0.1 }
  );
  const composerDiff = pixelmatch(
    composerBaseline.data,
    composerCurrent.data,
    null,
    composerBaseline.width,
    composerBaseline.height,
    { threshold: 0.1 }
  );

  const topbarPercent = percent(topbarDiff, topbarBaseline.width * topbarBaseline.height);
  const sidebarPercent = percent(sidebarDiff, sidebarBaseline.width * sidebarBaseline.height);
  const composerPercent = percent(composerDiff, composerBaseline.width * composerBaseline.height);
  const keyDiffPercent = Math.max(topbarPercent, sidebarPercent, composerPercent);

  const pass = fullDiffPercent < FULL_THRESHOLD_PERCENT && keyDiffPercent < KEY_THRESHOLD_PERCENT;

  results.push({
    name,
    pass,
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
console.log(`pixel_diff_report=${REPORT_PATH}`);

for (const item of results) {
  if (!item.fullDiffPercent && item.fullDiffPercent !== 0) {
    console.log(`FAIL ${item.name} reason=${item.reason}`);
    continue;
  }
  const status = item.pass ? "PASS" : "FAIL";
  console.log(
    `${status} ${item.name} full=${item.fullDiffPercent.toFixed(3)}% key=${item.keyDiffPercent.toFixed(3)}%`
  );
}

if (failed.length > 0) {
  console.error(`pixel_diff_failed=${failed.length}`);
  process.exit(1);
}

console.log("pixel_diff_passed=true");
