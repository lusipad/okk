import type { KnowledgeEntry, KnowledgeStatus } from "../types.js";
import {
  parseFrontmatter,
  stringifyFrontmatter
} from "../utils/frontmatter.js";

export const KNOWLEDGE_PORTABILITY_KIND = "knowledge_entry";
export const KNOWLEDGE_PORTABILITY_FORMAT_VERSION = 1;

export type KnowledgePortabilityIssueCode =
  | "missing_frontmatter"
  | "missing_field"
  | "invalid_value"
  | "unsupported_version";

export interface KnowledgePortabilityIssue {
  code: KnowledgePortabilityIssueCode;
  field?: string;
  fileName?: string;
  message: string;
}

export interface ParsedKnowledgePortabilityDocument {
  fileName: string;
  formatVersion: number;
  kind: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  status: KnowledgeStatus;
  tags: string[];
  sourceRefs: string[];
}

export interface KnowledgePortabilityFile {
  entryId: string;
  title: string;
  fileName: string;
  formatVersion: number;
  content: string;
}

export interface KnowledgeExportManifestItem {
  entryId: string;
  title: string;
  fileName: string;
  category: string;
  status: KnowledgeStatus;
  tags: string[];
  formatVersion: number;
}

export interface KnowledgeExportManifest {
  kind: "knowledge_export_manifest";
  formatVersion: number;
  exportedAt: string;
  itemCount: number;
  items: KnowledgeExportManifestItem[];
}

export interface KnowledgeExportBundle {
  formatVersion: number;
  manifest: KnowledgeExportManifest;
  manifestFile: {
    fileName: string;
    content: string;
  };
  files: KnowledgePortabilityFile[];
}

export class KnowledgePortabilityError extends Error {
  constructor(readonly issues: KnowledgePortabilityIssue[]) {
    super(
      issues.length > 0
        ? issues.map((issue) => issue.message).join("; ")
        : "标准知识文件校验失败"
    );
    this.name = "KnowledgePortabilityError";
  }
}

const KNOWN_STATUSES = new Set<KnowledgeStatus>([
  "draft",
  "published",
  "stale",
  "archived"
]);

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
};

const normalizeString = (value: unknown): string => (
  typeof value === "string" ? value.trim() : ""
);

const asFormatVersion = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return null;
};

const toSourceRefs = (entry: KnowledgeEntry): string[] => {
  const refs: string[] = [];

  if (entry.sourceSessionId) {
    refs.push(`session:${entry.sourceSessionId}`);
  }

  const metadata = entry.metadata ?? {};
  const pushString = (value: unknown): void => {
    if (typeof value === "string" && value.trim().length > 0) {
      refs.push(value.trim());
    }
  };

  pushString(metadata.sourceRef);
  if (Array.isArray(metadata.sourceRefs)) {
    for (const item of metadata.sourceRefs) {
      pushString(item);
    }
  }

  if (metadata.workflow && typeof metadata.workflow === "object") {
    const workflow = metadata.workflow as Record<string, unknown>;
    pushString(
      typeof workflow.runId === "string" ? `workflow-run:${workflow.runId}` : null
    );
    pushString(
      typeof workflow.workflowId === "string" ? `workflow:${workflow.workflowId}` : null
    );
  }

  return Array.from(new Set(refs));
};

const ensureFileStem = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  return normalized || "knowledge-entry";
};

const buildManifestFileName = (exportedAt: string): string => {
  const safeTimestamp = exportedAt.replace(/[:]/g, "-");
  return `knowledge-export-manifest-${safeTimestamp}.json`;
};

const buildIssue = (
  code: KnowledgePortabilityIssueCode,
  message: string,
  input: { field?: string; fileName?: string } = {}
): KnowledgePortabilityIssue => ({
  code,
  message,
  ...(input.field ? { field: input.field } : {}),
  ...(input.fileName ? { fileName: input.fileName } : {})
});

const ensureKnownStatus = (
  value: unknown,
  fileName: string,
  issues: KnowledgePortabilityIssue[]
): KnowledgeStatus | null => {
  if (typeof value !== "string" || !KNOWN_STATUSES.has(value.trim() as KnowledgeStatus)) {
    issues.push(
      buildIssue(
        "invalid_value",
        `status 必须是 ${Array.from(KNOWN_STATUSES).join(", ")} 之一`,
        { field: "status", fileName }
      )
    );
    return null;
  }

  return value.trim() as KnowledgeStatus;
};

export const buildKnowledgePortabilityFileName = (title: string): string =>
  `${ensureFileStem(title)}.md`;

export const serializeKnowledgeEntryToMarkdown = (
  entry: KnowledgeEntry,
  input: { fileName?: string; sourceRefs?: string[] } = {}
): KnowledgePortabilityFile => {
  const fileName = input.fileName?.trim() || buildKnowledgePortabilityFileName(entry.title);
  const sourceRefs = input.sourceRefs ?? toSourceRefs(entry);
  const content = stringifyFrontmatter(
    {
      okk_format: KNOWLEDGE_PORTABILITY_KIND,
      format_version: KNOWLEDGE_PORTABILITY_FORMAT_VERSION,
      title: entry.title.trim(),
      summary: entry.summary.trim(),
      category: entry.category.trim() || "general",
      status: entry.status,
      tags: entry.tags,
      source_refs: sourceRefs
    },
    entry.content
  );

  return {
    entryId: entry.id,
    title: entry.title,
    fileName,
    formatVersion: KNOWLEDGE_PORTABILITY_FORMAT_VERSION,
    content
  };
};

export const parseKnowledgePortabilityMarkdown = (
  raw: string,
  input: { fileName?: string } = {}
): ParsedKnowledgePortabilityDocument => {
  const fileName = input.fileName?.trim() || "knowledge-entry.md";
  const issues: KnowledgePortabilityIssue[] = [];

  if (!raw.startsWith("---")) {
    throw new KnowledgePortabilityError([
      buildIssue("missing_frontmatter", "标准知识文件缺少 frontmatter", {
        fileName
      })
    ]);
  }

  const parsed = parseFrontmatter(raw);
  const kind = normalizeString(parsed.attributes.okk_format);
  if (kind !== KNOWLEDGE_PORTABILITY_KIND) {
    issues.push(
      buildIssue(
        kind ? "invalid_value" : "missing_field",
        "okk_format 必须为 knowledge_entry",
        { field: "okk_format", fileName }
      )
    );
  }

  const formatVersion = asFormatVersion(parsed.attributes.format_version);
  if (formatVersion === null) {
    issues.push(
      buildIssue("missing_field", "format_version 缺失或非法", {
        field: "format_version",
        fileName
      })
    );
  } else if (formatVersion !== KNOWLEDGE_PORTABILITY_FORMAT_VERSION) {
    issues.push(
      buildIssue(
        "unsupported_version",
        `不支持的 format_version: ${formatVersion}`,
        { field: "format_version", fileName }
      )
    );
  }

  const title = normalizeString(parsed.attributes.title);
  if (!title) {
    issues.push(
      buildIssue("missing_field", "title 不能为空", {
        field: "title",
        fileName
      })
    );
  }

  const summary = normalizeString(parsed.attributes.summary);
  if (!summary) {
    issues.push(
      buildIssue("missing_field", "summary 不能为空", {
        field: "summary",
        fileName
      })
    );
  }

  const category = normalizeString(parsed.attributes.category);
  if (!category) {
    issues.push(
      buildIssue("missing_field", "category 不能为空", {
        field: "category",
        fileName
      })
    );
  }

  const status = ensureKnownStatus(parsed.attributes.status, fileName, issues);
  const tags = normalizeStringArray(parsed.attributes.tags);
  const sourceRefs = normalizeStringArray(parsed.attributes.source_refs);
  const content = parsed.body.trimEnd();

  if (content.trim().length === 0) {
    issues.push(
      buildIssue("missing_field", "正文内容不能为空", {
        field: "content",
        fileName
      })
    );
  }

  if (issues.length > 0) {
    throw new KnowledgePortabilityError(issues);
  }

  return {
    fileName,
    formatVersion: formatVersion as number,
    kind,
    title,
    summary,
    content,
    category,
    status: status as KnowledgeStatus,
    tags,
    sourceRefs
  };
};

export const createKnowledgeExportBundle = (
  entries: KnowledgeEntry[],
  input: { exportedAt?: string } = {}
): KnowledgeExportBundle => {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const files = entries.map((entry) => serializeKnowledgeEntryToMarkdown(entry));
  const manifest: KnowledgeExportManifest = {
    kind: "knowledge_export_manifest",
    formatVersion: KNOWLEDGE_PORTABILITY_FORMAT_VERSION,
    exportedAt,
    itemCount: files.length,
    items: files.map((file, index) => ({
      entryId: file.entryId,
      title: file.title,
      fileName: file.fileName,
      category: entries[index]?.category ?? "general",
      status: entries[index]?.status ?? "draft",
      tags: entries[index]?.tags ?? [],
      formatVersion: file.formatVersion
    }))
  };

  return {
    formatVersion: KNOWLEDGE_PORTABILITY_FORMAT_VERSION,
    manifest,
    manifestFile: {
      fileName: buildManifestFileName(exportedAt),
      content: `${JSON.stringify(manifest, null, 2)}\n`
    },
    files
  };
};
