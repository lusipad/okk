import type {
  KnowledgeEntry,
  KnowledgeStatus,
  KnowledgeVersion
} from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

const DEFAULT_CATEGORY = "general";
const MAX_PAGE_LIMIT = 100;

const STATUS_TRANSITIONS: Record<KnowledgeStatus, Set<KnowledgeStatus>> = {
  draft: new Set(["draft", "published", "archived"]),
  published: new Set(["published", "stale", "archived"]),
  stale: new Set(["stale", "published", "archived"]),
  archived: new Set(["archived"])
};

interface KnowledgeEntryRow {
  id: string;
  title: string;
  content: string;
  summary: string;
  repo_id: string;
  category: string;
  source_session_id: string | null;
  quality_score: number;
  view_count: number;
  upvote_count: number;
  version: number;
  status: KnowledgeStatus;
  metadata: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface KnowledgeVersionRow {
  id: string;
  entry_id: string;
  version: number;
  title: string;
  content: string;
  summary: string;
  category: string;
  metadata: string;
  change_summary: string | null;
  edited_by: string;
  created_at: string;
}

interface KnowledgeSearchRow extends KnowledgeEntryRow {
  relevance: number;
  snippet: string | null;
  highlighted_title: string | null;
}

export interface CreateKnowledgeEntryInput {
  id?: string;
  title: string;
  content: string;
  summary: string;
  repoId: string;
  category?: string;
  sourceSessionId?: string | null;
  qualityScore?: number;
  status?: KnowledgeStatus;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdBy: string;
}

export interface UpdateKnowledgeEntryInput {
  title?: string;
  content?: string;
  summary?: string;
  category?: string;
  sourceSessionId?: string | null;
  qualityScore?: number;
  status?: KnowledgeStatus;
  metadata?: Record<string, unknown>;
  tags?: string[];
  changeSummary?: string | null;
  editedBy: string;
}

export interface ListKnowledgeEntriesInput {
  repoId?: string;
  category?: string;
  status?: KnowledgeStatus;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchKnowledgeEntriesInput extends ListKnowledgeEntriesInput {
  keyword?: string;
}

export interface KnowledgeSearchResult extends KnowledgeEntry {
  snippet: string;
  highlightedTitle: string;
  relevance: number;
}

export interface KnowledgeSummary {
  id: string;
  title: string;
  summary: string;
  category: string;
  updatedAt: string;
}

const parseObject = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
};

const normalizeTags = (tags?: string[]): string[] =>
  Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));

const normalizePageLimit = (limit?: number): number | null => {
  if (!Number.isFinite(limit)) {
    return null;
  }

  const rounded = Math.floor(limit as number);
  if (rounded < 1) {
    return 1;
  }

  return Math.min(rounded, MAX_PAGE_LIMIT);
};

const normalizePageOffset = (offset?: number): number => {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  const rounded = Math.floor(offset as number);
  return rounded < 0 ? 0 : rounded;
};

const arraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const ensureStatusTransition = (current: KnowledgeStatus, next: KnowledgeStatus): void => {
  if (!STATUS_TRANSITIONS[current].has(next)) {
    throw new Error(`Invalid knowledge status transition: ${current} -> ${next}`);
  }
};

const toKnowledgeVersion = (row: KnowledgeVersionRow): KnowledgeVersion => ({
  id: row.id,
  entryId: row.entry_id,
  version: row.version,
  title: row.title,
  content: row.content,
  summary: row.summary,
  category: row.category,
  metadata: parseObject(row.metadata),
  changeSummary: row.change_summary,
  editedBy: row.edited_by,
  createdAt: row.created_at
});

const toKnowledgeEntry = (row: KnowledgeEntryRow, tags: string[]): KnowledgeEntry => ({
  id: row.id,
  title: row.title,
  content: row.content,
  summary: row.summary,
  repoId: row.repo_id,
  category: row.category,
  sourceSessionId: row.source_session_id,
  qualityScore: row.quality_score,
  viewCount: row.view_count,
  upvoteCount: row.upvote_count,
  version: row.version,
  status: row.status,
  tags,
  metadata: parseObject(row.metadata),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class KnowledgeDao {
  constructor(private readonly db: SqliteConnection) {}

  list(input: ListKnowledgeEntriesInput = {}): KnowledgeEntry[] {
    const tags = normalizeTags(input.tags);
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (input.repoId?.trim()) {
      whereClauses.push("e.repo_id = ?");
      params.push(input.repoId.trim());
    }

    if (input.category?.trim()) {
      whereClauses.push("e.category = ?");
      params.push(input.category.trim());
    }

    if (input.status) {
      whereClauses.push("e.status = ?");
      params.push(input.status);
    }

    tags.forEach((tag, index) => {
      whereClauses.push(
        `EXISTS (SELECT 1 FROM knowledge_tags kt${index} WHERE kt${index}.entry_id = e.id AND kt${index}.tag = ?)`
      );
      params.push(tag);
    });

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const normalizedLimit = normalizePageLimit(input.limit);
    const normalizedOffset = normalizePageOffset(input.offset);

    let sql = `
      SELECT e.*
      FROM knowledge_entries e
      ${whereSql}
      ORDER BY e.updated_at DESC, e.id ASC
    `;

    if (normalizedLimit !== null) {
      sql += " LIMIT ? OFFSET ?";
      params.push(normalizedLimit, normalizedOffset);
    } else if (normalizedOffset > 0) {
      sql += " LIMIT -1 OFFSET ?";
      params.push(normalizedOffset);
    }

    const rows = this.db.prepare(sql).all(...params) as KnowledgeEntryRow[];

    return rows.map((row) => {
      const tags = this.getTagsByEntryId(row.id);
      return toKnowledgeEntry(row, tags);
    });
  }

  listByRepo(repoId?: string): KnowledgeEntry[] {
    return this.list({ repoId });
  }

  create(input: CreateKnowledgeEntryInput): KnowledgeEntry {
    const id = input.id ?? generateId();
    const createdAt = nowIso();
    const category = input.category?.trim() || DEFAULT_CATEGORY;
    const tags = normalizeTags(input.tags);
    const metadata = JSON.stringify(input.metadata ?? {});

    const createTx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO knowledge_entries(
             id, title, content, summary, repo_id, category, source_session_id, quality_score,
             status, metadata, created_by, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.title,
          input.content,
          input.summary,
          input.repoId,
          category,
          input.sourceSessionId ?? null,
          input.qualityScore ?? 0,
          input.status ?? "draft",
          metadata,
          input.createdBy,
          createdAt,
          createdAt
        );

      this.db
        .prepare(
          `INSERT INTO knowledge_versions(
             id, entry_id, version, title, content, summary, category, metadata, change_summary, edited_by, created_at
           ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          generateId(),
          id,
          input.title,
          input.content,
          input.summary,
          category,
          metadata,
          "initial",
          input.createdBy,
          createdAt
        );

      const insertTag = this.db.prepare(
        "INSERT OR IGNORE INTO knowledge_tags(entry_id, tag) VALUES (?, ?)"
      );
      for (const tag of tags) {
        insertTag.run(id, tag);
      }
    });

    createTx();

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create knowledge entry");
    }

    return created;
  }

  getById(id: string): KnowledgeEntry | null {
    const row = this.db
      .prepare("SELECT * FROM knowledge_entries WHERE id = ?")
      .get(id) as KnowledgeEntryRow | undefined;
    if (!row) {
      return null;
    }

    const tags = this.getTagsByEntryId(id);
    return toKnowledgeEntry(row, tags);
  }

  update(id: string, input: UpdateKnowledgeEntryInput): KnowledgeEntry | null {
    const existingRow = this.db
      .prepare("SELECT * FROM knowledge_entries WHERE id = ?")
      .get(id) as KnowledgeEntryRow | undefined;
    if (!existingRow) {
      return null;
    }

    const existingTags = this.getTagsByEntryId(id);
    const nextTitle = input.title?.trim() || existingRow.title;
    const nextContent = input.content ?? existingRow.content;
    const nextSummary = input.summary?.trim() || existingRow.summary;
    const nextCategory = input.category?.trim() || existingRow.category || DEFAULT_CATEGORY;
    const nextSourceSessionId =
      input.sourceSessionId === undefined ? existingRow.source_session_id : input.sourceSessionId;
    const nextQualityScore = input.qualityScore ?? existingRow.quality_score;
    const nextStatus = input.status ?? existingRow.status;
    ensureStatusTransition(existingRow.status, nextStatus);
    const nextMetadataRecord = input.metadata ?? parseObject(existingRow.metadata);
    const nextMetadata = JSON.stringify(nextMetadataRecord);
    const nextTags = input.tags ? normalizeTags(input.tags) : existingTags;
    const sortedNextTags = [...nextTags].sort();
    const sortedExistingTags = [...existingTags].sort();
    const tagsChanged = input.tags ? !arraysEqual(sortedExistingTags, sortedNextTags) : false;

    const changed =
      existingRow.title !== nextTitle ||
      existingRow.content !== nextContent ||
      existingRow.summary !== nextSummary ||
      existingRow.category !== nextCategory ||
      existingRow.source_session_id !== nextSourceSessionId ||
      existingRow.quality_score !== nextQualityScore ||
      existingRow.status !== nextStatus ||
      existingRow.metadata !== nextMetadata ||
      tagsChanged;

    if (!changed) {
      return this.getById(id);
    }

    const updatedAt = nowIso();
    const nextVersion = existingRow.version + 1;
    const changeSummary = input.changeSummary ?? null;

    const updateTx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE knowledge_entries
           SET title = ?, content = ?, summary = ?, category = ?, source_session_id = ?,
               quality_score = ?, version = ?, status = ?, metadata = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          nextTitle,
          nextContent,
          nextSummary,
          nextCategory,
          nextSourceSessionId,
          nextQualityScore,
          nextVersion,
          nextStatus,
          nextMetadata,
          updatedAt,
          id
        );

      this.db
        .prepare(
          `INSERT INTO knowledge_versions(
             id, entry_id, version, title, content, summary, category, metadata, change_summary, edited_by, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          generateId(),
          id,
          nextVersion,
          nextTitle,
          nextContent,
          nextSummary,
          nextCategory,
          nextMetadata,
          changeSummary,
          input.editedBy,
          updatedAt
        );

      if (input.tags) {
        this.db.prepare("DELETE FROM knowledge_tags WHERE entry_id = ?").run(id);
        const insertTag = this.db.prepare(
          "INSERT OR IGNORE INTO knowledge_tags(entry_id, tag) VALUES (?, ?)"
        );
        for (const tag of sortedNextTags) {
          insertTag.run(id, tag);
        }
      }
    });

    updateTx();
    return this.getById(id);
  }

  getVersionsByEntryId(entryId: string): KnowledgeVersion[] {
    const rows = this.db
      .prepare("SELECT * FROM knowledge_versions WHERE entry_id = ? ORDER BY version ASC")
      .all(entryId) as KnowledgeVersionRow[];
    return rows.map(toKnowledgeVersion);
  }

  listPublishedSummariesByRepo(repoId: string, limit = 20): KnowledgeSummary[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, summary, category, updated_at
         FROM knowledge_entries
         WHERE repo_id = ? AND status = 'published'
         ORDER BY quality_score DESC, updated_at DESC
         LIMIT ?`
      )
      .all(repoId, limit) as Array<{
      id: string;
      title: string;
      summary: string;
      category: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      category: row.category,
      updatedAt: row.updated_at
    }));
  }

  delete(id: string): boolean {
    const deleteTx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM knowledge_tags WHERE entry_id = ?").run(id);
      this.db.prepare("DELETE FROM knowledge_versions WHERE entry_id = ?").run(id);
      return this.db.prepare("DELETE FROM knowledge_entries WHERE id = ?").run(id);
    });

    const result = deleteTx() as { changes: number };
    return result.changes > 0;
  }

  search(input: SearchKnowledgeEntriesInput = {}): KnowledgeSearchResult[] {
    const keyword = input.keyword?.trim() ?? "";
    if (!keyword) {
      return this.list(input).map((entry) => ({
        ...entry,
        snippet: entry.summary,
        highlightedTitle: entry.title,
        relevance: 0
      }));
    }

    const tags = normalizeTags(input.tags);
    const whereClauses: string[] = ["knowledge_fts MATCH ?"];
    const params: unknown[] = [keyword];

    if (input.repoId?.trim()) {
      whereClauses.push("e.repo_id = ?");
      params.push(input.repoId.trim());
    }

    if (input.category?.trim()) {
      whereClauses.push("e.category = ?");
      params.push(input.category.trim());
    }

    if (input.status) {
      whereClauses.push("e.status = ?");
      params.push(input.status);
    }

    tags.forEach((tag, index) => {
      whereClauses.push(
        `EXISTS (SELECT 1 FROM knowledge_tags kt${index} WHERE kt${index}.entry_id = e.id AND kt${index}.tag = ?)`
      );
      params.push(tag);
    });

    const normalizedLimit = normalizePageLimit(input.limit);
    const normalizedOffset = normalizePageOffset(input.offset);

    let sql = `
      SELECT
        e.*,
        bm25(knowledge_fts) AS relevance,
        snippet(knowledge_fts, 2, '<mark>', '</mark>', '...', 18) AS snippet,
        highlight(knowledge_fts, 1, '<mark>', '</mark>') AS highlighted_title
      FROM knowledge_fts
      JOIN knowledge_entries e ON e.id = knowledge_fts.entry_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY relevance ASC, e.quality_score DESC, e.updated_at DESC, e.id ASC
    `;

    if (normalizedLimit !== null) {
      sql += " LIMIT ? OFFSET ?";
      params.push(normalizedLimit, normalizedOffset);
    } else if (normalizedOffset > 0) {
      sql += " LIMIT -1 OFFSET ?";
      params.push(normalizedOffset);
    }

    const rows = this.db.prepare(sql).all(...params) as KnowledgeSearchRow[];

    return rows.map((row) => {
      const tags = this.getTagsByEntryId(row.id);
      return {
        ...toKnowledgeEntry(row, tags),
        snippet: row.snippet ?? row.summary,
        highlightedTitle: row.highlighted_title ?? row.title,
        relevance: row.relevance
      };
    });
  }

  updateStatus(id: string, status: KnowledgeStatus, editedBy = "system"): KnowledgeEntry | null {
    return this.update(id, {
      status,
      editedBy,
      changeSummary: `status:${status}`
    });
  }

  private getTagsByEntryId(entryId: string): string[] {
    const rows = this.db
      .prepare("SELECT tag FROM knowledge_tags WHERE entry_id = ? ORDER BY tag ASC")
      .all(entryId) as Array<{ tag: string }>;
    return rows.map((row) => row.tag);
  }
}

