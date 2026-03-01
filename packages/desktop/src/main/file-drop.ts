import path from "node:path";

export function normalizeDroppedFiles(filePaths: readonly string[]): string[] {
  const uniquePaths = new Set<string>();

  for (const filePath of filePaths) {
    if (typeof filePath !== "string") {
      continue;
    }

    const trimmedPath = filePath.trim();

    if (!trimmedPath) {
      continue;
    }

    uniquePaths.add(path.normalize(trimmedPath));
  }

  return [...uniquePaths];
}
