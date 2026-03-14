import type {
  KnowledgeShareRecord,
  KnowledgeShareReview,
  KnowledgeShareReviewStatus,
  KnowledgeShareVisibility,
  KnowledgeSharingOverview,
  KnowledgeStatus
} from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface KnowledgeShareRow {
  id: string;
  entry_id: string;
  visibility: KnowledgeShareVisibility;
  review_status: KnowledgeShareReviewStatus;
  requested_by: string;
  reviewed_by: string | null;
  request_note: string | null;
  review_note: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface KnowledgeShareJoinedRow extends KnowledgeShareRow {
  entry_title: string;
  entry_summary: string;
  entry_category: string;
  entry_status: KnowledgeStatus;
  repo_id: string;
  source_author_id: string;
  source_author_name: string | null;
}

interface KnowledgeShareReviewRow {
  id: string;
  share_id: string;
  action: KnowledgeShareReview["action"];
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateKnowledgeShareInput {
  entryId: string;
  visibility: KnowledgeShareVisibility;
  reviewStatus: KnowledgeShareReviewStatus;
  requestedBy: string;
  reviewedBy?: string | null;
  requestNote?: string | null;
  reviewNote?: string | null;
  publishedAt?: string | null;
}

export interface UpdateKnowledgeShareInput {
  visibility?: KnowledgeShareVisibility;
  reviewStatus?: KnowledgeShareReviewStatus;
  requestedBy?: string;
  reviewedBy?: string | null;
  requestNote?: string | null;
  reviewNote?: string | null;
  publishedAt?: string | null;
}

export interface ListKnowledgeSharesInput {
  statuses?: KnowledgeShareReviewStatus[];
  visibility?: KnowledgeShareVisibility;
  requestedBy?: string;
  repoId?: string;
  category?: string;
  tags?: string[];
  authorId?: string;
  query?: string;
}

const normalizeTags = (tags?: string[]): string[] =>
  Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));

const toReview = (row: KnowledgeShareReviewRow): KnowledgeShareReview => ({
  id: row.id,
  shareId: row.share_id,
  action: row.action,
  note: row.note,
  createdBy: row.created_by,
  createdAt: row.created_at
});

export class KnowledgeSharingDao {
  constructor(private readonly db: SqliteConnection) {}

  list(input: ListKnowledgeSharesInput = {}): KnowledgeShareRecord[] {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    const tags = normalizeTags(input.tags);

    if (input.statuses && input.statuses.length > 0) {
      const placeholders = input.statuses.map(() => "?").join(", ");
      whereClauses.push(`s.review_status IN (${placeholders})`);
      params.push(...input.statuses);
    }

    if (input.visibility) {
      whereClauses.push("s.visibility = ?");
      params.push(input.visibility);
    }

    if (input.requestedBy?.trim()) {
      whereClauses.push("s.requested_by = ?");
      params.push(input.requestedBy.trim());
    }

    if (input.repoId?.trim()) {
      whereClauses.push("e.repo_id = ?");
      params.push(input.repoId.trim());
    }

    if (input.category?.trim()) {
      whereClauses.push("e.category = ?");
      params.push(input.category.trim());
    }

    if (input.authorId?.trim()) {
      whereClauses.push("e.created_by = ?");
      params.push(input.authorId.trim());
    }

    if (input.query?.trim()) {
      const normalized = `%${input.query.trim()}%`;
      whereClauses.push("(e.title LIKE ? OR e.summary LIKE ? OR e.content LIKE ?)");
      params.push(normalized, normalized, normalized);
    }

    tags.forEach((tag, index) => {
      whereClauses.push(
        `EXISTS (SELECT 1 FROM knowledge_tags kt${index} WHERE kt${index}.entry_id = e.id AND kt${index}.tag = ?)`
      );
      params.push(tag);
    });

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const statuses = input.statuses ?? [];
    const publishedOnly = statuses.length === 1 && statuses[0] === "published";
    const rows = this.db
      .prepare(
        `SELECT
           s.*,
           e.title AS entry_title,
           e.summary AS entry_summary,
           e.category AS entry_category,
           e.status AS entry_status,
           e.repo_id,
           e.created_by AS source_author_id,
           u.display_name AS source_author_name
         FROM knowledge_shares s
         JOIN knowledge_entries e ON e.id = s.entry_id
         LEFT JOIN users u ON u.id = e.created_by
         ${whereSql}
         ORDER BY ${
           publishedOnly
             ? "COALESCE(s.published_at, s.updated_at) DESC"
             : "s.updated_at DESC, s.created_at DESC"
         }, s.id ASC`
      )
      .all(...params) as KnowledgeShareJoinedRow[];

    return rows.map((row) => this.toShare(row));
  }

  getById(id: string): KnowledgeShareRecord | null {
    const row = this.db
      .prepare(
        `SELECT
           s.*,
           e.title AS entry_title,
           e.summary AS entry_summary,
           e.category AS entry_category,
           e.status AS entry_status,
           e.repo_id,
           e.created_by AS source_author_id,
           u.display_name AS source_author_name
         FROM knowledge_shares s
         JOIN knowledge_entries e ON e.id = s.entry_id
         LEFT JOIN users u ON u.id = e.created_by
         WHERE s.id = ?`
      )
      .get(id) as KnowledgeShareJoinedRow | undefined;

    return row ? this.toShare(row) : null;
  }

  getByEntryId(entryId: string): KnowledgeShareRecord | null {
    const row = this.db
      .prepare(
        `SELECT
           s.*,
           e.title AS entry_title,
           e.summary AS entry_summary,
           e.category AS entry_category,
           e.status AS entry_status,
           e.repo_id,
           e.created_by AS source_author_id,
           u.display_name AS source_author_name
         FROM knowledge_shares s
         JOIN knowledge_entries e ON e.id = s.entry_id
         LEFT JOIN users u ON u.id = e.created_by
         WHERE s.entry_id = ?`
      )
      .get(entryId) as KnowledgeShareJoinedRow | undefined;

    return row ? this.toShare(row) : null;
  }

  create(input: CreateKnowledgeShareInput): KnowledgeShareRecord {
    const id = generateId();
    const timestamp = nowIso();

    this.db
      .prepare(
        `INSERT INTO knowledge_shares(
           id, entry_id, visibility, review_status, requested_by, reviewed_by,
           request_note, review_note, published_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.entryId,
        input.visibility,
        input.reviewStatus,
        input.requestedBy,
        input.reviewedBy ?? null,
        input.requestNote ?? null,
        input.reviewNote ?? null,
        input.publishedAt ?? null,
        timestamp,
        timestamp
      );

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create knowledge share");
    }
    return created;
  }

  update(id: string, input: UpdateKnowledgeShareInput): KnowledgeShareRecord | null {
    const existing = this.db
      .prepare("SELECT * FROM knowledge_shares WHERE id = ?")
      .get(id) as KnowledgeShareRow | undefined;
    if (!existing) {
      return null;
    }

    this.db
      .prepare(
        `UPDATE knowledge_shares
         SET visibility = ?, review_status = ?, requested_by = ?, reviewed_by = ?,
             request_note = ?, review_note = ?, published_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.visibility ?? existing.visibility,
        input.reviewStatus ?? existing.review_status,
        input.requestedBy ?? existing.requested_by,
        input.reviewedBy === undefined ? existing.reviewed_by : input.reviewedBy,
        input.requestNote === undefined ? existing.request_note : input.requestNote,
        input.reviewNote === undefined ? existing.review_note : input.reviewNote,
        input.publishedAt === undefined ? existing.published_at : input.publishedAt,
        nowIso(),
        id
      );

    return this.getById(id);
  }

  appendReview(input: Omit<KnowledgeShareReview, "id" | "createdAt">): KnowledgeShareReview {
    const id = generateId();
    const createdAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO knowledge_share_reviews(id, share_id, action, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.shareId, input.action, input.note ?? null, input.createdBy, createdAt);

    return {
      ...input,
      id,
      createdAt
    };
  }

  listReviews(shareId: string): KnowledgeShareReview[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM knowledge_share_reviews WHERE share_id = ? ORDER BY created_at DESC, id DESC"
      )
      .all(shareId) as KnowledgeShareReviewRow[];
    return rows.map(toReview);
  }

  getOverview(): KnowledgeSharingOverview {
    const rows = this.db
      .prepare(
        `SELECT review_status, COUNT(*) AS count
         FROM knowledge_shares
         GROUP BY review_status`
      )
      .all() as Array<{ review_status: KnowledgeShareReviewStatus; count: number }>;

    const counts = new Map(rows.map((row) => [row.review_status, row.count]));
    return {
      summary: {
        total: rows.reduce((sum, row) => sum + row.count, 0),
        pendingReview: counts.get("pending_review") ?? 0,
        approved: counts.get("approved") ?? 0,
        published: counts.get("published") ?? 0,
        rejected: counts.get("rejected") ?? 0,
        changesRequested: counts.get("changes_requested") ?? 0
      }
    };
  }

  private toShare(row: KnowledgeShareJoinedRow): KnowledgeShareRecord {
    return {
      id: row.id,
      entryId: row.entry_id,
      visibility: row.visibility,
      reviewStatus: row.review_status,
      requestedBy: row.requested_by,
      reviewedBy: row.reviewed_by,
      requestNote: row.request_note,
      reviewNote: row.review_note,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      entryTitle: row.entry_title,
      entrySummary: row.entry_summary,
      entryCategory: row.entry_category,
      entryStatus: row.entry_status,
      entryTags: this.getTagsByEntryId(row.entry_id),
      repoId: row.repo_id,
      sourceAuthorId: row.source_author_id,
      sourceAuthorName: row.source_author_name
    };
  }

  private getTagsByEntryId(entryId: string): string[] {
    const rows = this.db
      .prepare("SELECT tag FROM knowledge_tags WHERE entry_id = ? ORDER BY tag ASC")
      .all(entryId) as Array<{ tag: string }>;
    return rows.map((row) => row.tag);
  }
}
