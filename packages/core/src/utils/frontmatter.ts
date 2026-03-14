export interface ParsedFrontmatter {
  attributes: Record<string, unknown>;
  body: string;
}

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'") || trimmed[trimmed.length - 1] !== quote) {
    return trimmed;
  }

  if (quote === '"') {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed
    .slice(1, -1)
    .replace(/\\\\/g, "\\")
    .replace(/\\'/g, "'");
};

const splitInlineArray = (value: string): string[] => {
  const items: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const character of value) {
    if ((character === '"' || character === "'") && current[current.length - 1] !== "\\") {
      quote = quote === character ? null : quote ?? character;
      current += character;
      continue;
    }

    if (character === "," && quote === null) {
      if (current.trim().length > 0) {
        items.push(current.trim());
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim().length > 0) {
    items.push(current.trim());
  }

  return items;
};

const parseScalar = (value: string): unknown => {
  const normalized = value.trim();

  if (normalized === "null") {
    return null;
  }

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

    return splitInlineArray(inner)
      .map((item) => parseScalar(item))
      .filter((item) => item !== "");
  }

  return unquote(normalized);
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
  let currentArrayKey: string | null = null;

  for (const line of frontmatterBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (currentArrayKey && trimmed.startsWith("- ")) {
      const currentValue = attributes[currentArrayKey];
      if (Array.isArray(currentValue)) {
        currentValue.push(parseScalar(trimmed.slice(2)));
        continue;
      }
      currentArrayKey = null;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      currentArrayKey = null;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      currentArrayKey = null;
      continue;
    }

    const value = line.slice(separatorIndex + 1);
    if (value.trim().length === 0) {
      attributes[key] = [];
      currentArrayKey = key;
      continue;
    }

    attributes[key] = parseScalar(value);
    currentArrayKey = null;
  }

  return { attributes, body };
};

const stringifyScalar = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(String(value));
};

export const stringifyFrontmatter = (
  attributes: Record<string, unknown>,
  body = ""
): string => {
  const lines = ["---"];

  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
        continue;
      }

      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${stringifyScalar(item)}`);
      }
      continue;
    }

    lines.push(`${key}: ${stringifyScalar(value)}`);
  }

  lines.push("---");

  const normalizedBody = body.replace(/\r\n/g, "\n").trimEnd();
  return normalizedBody.length > 0
    ? `${lines.join("\n")}\n\n${normalizedBody}\n`
    : `${lines.join("\n")}\n`;
};
