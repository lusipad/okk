import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { PNG } from "pngjs";

const REFERENCE_DIR = path.resolve("docs/pixel-clone/reference");
const cliSourceDir = process.argv[2]?.trim();
const sourceDir = path.resolve(cliSourceDir || process.env.OKCLAW_PIXEL_REFERENCE_SOURCE || REFERENCE_DIR);
const TARGET_FILES = [
  "chat-empty-1600x900.png",
  "chat-empty-1920x1080.png",
  "chat-empty-1280x800.png"
];

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(filePath, png) {
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function parseSizeFromFilename(name) {
  const match = name.match(/(\d+)x(\d+)\.png$/i);
  if (!match) {
    return null;
  }
  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function resizeCoverCrop(source, targetWidth, targetHeight) {
  const scale = Math.max(targetWidth / source.width, targetHeight / source.height);
  const scaledWidth = Math.max(1, Math.round(source.width * scale));
  const scaledHeight = Math.max(1, Math.round(source.height * scale));
  const resized = new PNG({ width: scaledWidth, height: scaledHeight });

  for (let y = 0; y < scaledHeight; y += 1) {
    const sy = Math.min(source.height - 1, Math.floor((y / scaledHeight) * source.height));
    for (let x = 0; x < scaledWidth; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x / scaledWidth) * source.width));
      const sourceIdx = (sy * source.width + sx) << 2;
      const targetIdx = (y * scaledWidth + x) << 2;
      resized.data[targetIdx] = source.data[sourceIdx];
      resized.data[targetIdx + 1] = source.data[sourceIdx + 1];
      resized.data[targetIdx + 2] = source.data[sourceIdx + 2];
      resized.data[targetIdx + 3] = source.data[sourceIdx + 3];
    }
  }

  const offsetX = Math.floor((scaledWidth - targetWidth) / 2);
  const offsetY = Math.floor((scaledHeight - targetHeight) / 2);
  const output = new PNG({ width: targetWidth, height: targetHeight });
  PNG.bitblt(resized, output, offsetX, offsetY, targetWidth, targetHeight, 0, 0);
  return output;
}

if (!fs.existsSync(sourceDir)) {
  console.error(`missing_source_dir=${sourceDir}`);
  process.exit(1);
}

fs.mkdirSync(REFERENCE_DIR, { recursive: true });

let processed = 0;
for (const fileName of TARGET_FILES) {
  const sourcePath = path.join(sourceDir, fileName);
  if (!fs.existsSync(sourcePath)) {
    console.error(`missing_reference_source=${sourcePath}`);
    process.exit(1);
  }

  const targetSize = parseSizeFromFilename(fileName);
  if (!targetSize) {
    console.error(`invalid_target_filename=${fileName}`);
    process.exit(1);
  }

  const source = readPng(sourcePath);
  const alreadySized = source.width === targetSize.width && source.height === targetSize.height;
  const output = alreadySized ? source : resizeCoverCrop(source, targetSize.width, targetSize.height);
  const targetPath = path.join(REFERENCE_DIR, fileName);
  writePng(targetPath, output);

  processed += 1;
  if (alreadySized) {
    console.log(`reference_prepared=${targetPath} mode=copy`);
  } else {
    console.log(
      `reference_prepared=${targetPath} mode=resize-crop source=${source.width}x${source.height} target=${targetSize.width}x${targetSize.height}`
    );
  }
}

console.log(`reference_prepare_total=${processed}`);
