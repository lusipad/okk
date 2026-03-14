import { describe, expect, it } from "vitest";
import type { KnowledgeEntry } from "../src/types.js";
import {
  KNOWLEDGE_PORTABILITY_FORMAT_VERSION,
  KnowledgePortabilityError,
  createKnowledgeExportBundle,
  parseKnowledgePortabilityMarkdown,
  serializeKnowledgeEntryToMarkdown
} from "../src/knowledge/portability.js";

const entry: KnowledgeEntry = {
  id: "knowledge-1",
  title: "SQLite 最佳实践",
  content: "# 标题\n\n先跑测试，再改 SQL。",
  summary: "总结 SQLite 迭代时的执行顺序",
  repoId: "repo-1",
  category: "guide",
  sourceSessionId: "session-1",
  qualityScore: 0.9,
  viewCount: 4,
  upvoteCount: 2,
  version: 3,
  status: "published",
  tags: ["sqlite", "guide"],
  metadata: {
    sourceRef: "memory:sqlite-guide",
    sourceRefs: ["doc:sqlite-runbook"],
    workflow: {
      workflowId: "workflow-1",
      runId: "run-1"
    }
  },
  createdBy: "u-admin",
  createdAt: "2026-03-14T00:00:00.000Z",
  updatedAt: "2026-03-14T01:00:00.000Z"
};

describe("knowledge portability", () => {
  it("支持知识条目导出为 markdown 并再次解析", () => {
    const exported = serializeKnowledgeEntryToMarkdown(entry);
    expect(exported.fileName).toBe("SQLite-最佳实践.md");
    expect(exported.content).toContain('format_version: 1');
    expect(exported.content).toContain('okk_format: "knowledge_entry"');
    expect(exported.content).toContain("  - \"sqlite\"");
    expect(exported.content).toContain("workflow-run:run-1");

    const parsed = parseKnowledgePortabilityMarkdown(exported.content, {
      fileName: exported.fileName
    });
    expect(parsed.formatVersion).toBe(KNOWLEDGE_PORTABILITY_FORMAT_VERSION);
    expect(parsed.title).toBe(entry.title);
    expect(parsed.summary).toBe(entry.summary);
    expect(parsed.content).toBe(entry.content);
    expect(parsed.category).toBe(entry.category);
    expect(parsed.status).toBe(entry.status);
    expect(parsed.tags).toEqual(entry.tags);
    expect(parsed.sourceRefs).toEqual([
      "session:session-1",
      "memory:sqlite-guide",
      "doc:sqlite-runbook",
      "workflow-run:run-1",
      "workflow:workflow-1"
    ]);
  });

  it("在版本不受支持时返回结构化错误", () => {
    expect(() =>
      parseKnowledgePortabilityMarkdown(
        `---
okk_format: "knowledge_entry"
format_version: 99
title: "Bad"
summary: "bad"
category: "guide"
status: "published"
tags: []
source_refs: []
---

body
`,
        { fileName: "bad.md" }
      )
    ).toThrowError(KnowledgePortabilityError);

    try {
      parseKnowledgePortabilityMarkdown(
        `---
okk_format: "knowledge_entry"
format_version: 99
title: "Bad"
summary: "bad"
category: "guide"
status: "published"
tags: []
source_refs: []
---

body
`,
        { fileName: "bad.md" }
      );
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgePortabilityError);
      const portabilityError = error as KnowledgePortabilityError;
      expect(portabilityError.issues).toEqual([
        expect.objectContaining({
          code: "unsupported_version",
          field: "format_version",
          fileName: "bad.md"
        })
      ]);
    }
  });

  it("支持批量导出并生成清单文件", () => {
    const bundle = createKnowledgeExportBundle([
      entry,
      { ...entry, id: "knowledge-2", title: "发布流程", tags: ["process"] }
    ], {
      exportedAt: "2026-03-14T08:00:00.000Z"
    });

    expect(bundle.formatVersion).toBe(1);
    expect(bundle.files).toHaveLength(2);
    expect(bundle.manifest.itemCount).toBe(2);
    expect(bundle.manifest.items[0]).toMatchObject({
      entryId: "knowledge-1",
      title: "SQLite 最佳实践",
      fileName: "SQLite-最佳实践.md",
      category: "guide",
      status: "published"
    });
    expect(bundle.manifestFile.fileName).toBe(
      "knowledge-export-manifest-2026-03-14T08-00-00.000Z.json"
    );
    expect(bundle.manifestFile.content).toContain('"itemCount": 2');
  });
});
