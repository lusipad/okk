export interface ParsedFrontmatter {
  attributes: Record<string, unknown>;
  body: string;
}

const parseScalar = (value: string): unknown => {
  const normalized = value.trim();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    return Number(normalized);
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    const inner = normalized.slice(1, -1).trim();
    if (inner.length === 0) {
      return [];
    }

    return inner
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter((item) => item.length > 0);
  }

  return normalized.replace(/^['"]|['"]$/g, "");
};

export const parseFrontmatter = (raw: string): ParsedFrontmatter => {
  if (!raw.startsWith("---")) {
    return { attributes: {}, body: raw };
  }

  const endIndex = raw.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { attributes: {}, body: raw };
  }

  const frontmatterBlock = raw.slice(3, endIndex).trim();
  const body = raw.slice(endIndex + 4).replace(/^\s*\n/, "");

  const attributes: Record<string, unknown> = {};
  for (const line of frontmatterBlock.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const value = line.slice(separatorIndex + 1);
    attributes[key] = parseScalar(value);
  }

  return { attributes, body };
};

