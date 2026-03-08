import type { MemoryShareRecord, MemoryShareReview, MemoryShareReviewStatus, MemoryShareVisibility } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface MemoryShareRow {
  id: string;
  memory_id: string;
  knowledge_entry_id: string | null;
  visibility: MemoryShareVisibility;
  review_status: MemoryShareReviewStatus;
  requested_by: string;
  reviewed_by: string | null;
  approval_note: string | null;
  rejection_reason: string | null;
  recommendation_score: number;
  memory_title: string;
  memory_summary: string;
  repo_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface MemoryShareReviewRow {
  id: string;
  share_id: string;
  action: MemoryShareReview["action"];
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface UpsertMemoryShareInput {
  memoryId: string;
  knowledgeEntryId?: string | null;
  visibility: MemoryShareVisibility;
  reviewStatus: MemoryShareReviewStatus;
  requestedBy: string;
  reviewedBy?: string | null;
  approvalNote?: string | null;
  rejectionReason?: string | null;
  recommendationScore?: number;
  memoryTitle: string;
  memorySummary: string;
  repoId?: string | null;
  publishedAt?: string | null;
}

const toShare = (row: MemoryShareRow): MemoryShareRecord => ({
  id: row.id,
  memoryId: row.memory_id,
  knowledgeEntryId: row.knowledge_entry_id,
  visibility: row.visibility,
  reviewStatus: row.review_status,
  requestedBy: row.requested_by,
  reviewedBy: row.reviewed_by,
  approvalNote: row.approval_note,
  rejectionReason: row.rejection_reason,
  recommendationScore: row.recommendation_score,
  memoryTitle: row.memory_title,
  memorySummary: row.memory_summary,
  repoId: row.repo_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  publishedAt: row.published_at
});

const toReview = (row: MemoryShareReviewRow): MemoryShareReview => ({
  id: row.id,
  shareId: row.share_id,
  action: row.action,
  note: row.note,
  createdBy: row.created_by,
  createdAt: row.created_at
});

export class MemorySharingDao {
  constructor(private readonly db: SqliteConnection) {}

  list(status?: MemoryShareReviewStatus): MemoryShareRecord[] {
    const rows = status
      ? this.db.prepare("SELECT * FROM memory_shares WHERE review_status = ? ORDER BY updated_at DESC, created_at DESC").all(status)
      : this.db.prepare("SELECT * FROM memory_shares ORDER BY updated_at DESC, created_at DESC").all();
    return (rows as MemoryShareRow[]).map(toShare);
  }

  getById(id: string): MemoryShareRecord | null {
    const row = this.db.prepare("SELECT * FROM memory_shares WHERE id = ?").get(id) as MemoryShareRow | undefined;
    return row ? toShare(row) : null;
  }

  getByMemoryId(memoryId: string): MemoryShareRecord | null {
    const row = this.db.prepare("SELECT * FROM memory_shares WHERE memory_id = ?").get(memoryId) as MemoryShareRow | undefined;
    return row ? toShare(row) : null;
  }

  upsert(input: UpsertMemoryShareInput): MemoryShareRecord {
    const existing = this.getByMemoryId(input.memoryId);
    const timestamp = nowIso();
    const id = existing?.id ?? generateId();
    const createdAt = existing?.createdAt ?? timestamp;

    this.db.prepare(
      `INSERT OR REPLACE INTO memory_shares(
         id, memory_id, knowledge_entry_id, visibility, review_status, requested_by, reviewed_by,
         approval_note, rejection_reason, recommendation_score, memory_title, memory_summary,
         repo_id, created_at, updated_at, published_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.memoryId,
      input.knowledgeEntryId ?? existing?.knowledgeEntryId ?? null,
      input.visibility,
      input.reviewStatus,
      input.requestedBy,
      input.reviewedBy ?? existing?.reviewedBy ?? null,
      input.approvalNote ?? existing?.approvalNote ?? null,
      input.rejectionReason ?? existing?.rejectionReason ?? null,
      input.recommendationScore ?? existing?.recommendationScore ?? 0,
      input.memoryTitle,
      input.memorySummary,
      input.repoId ?? existing?.repoId ?? null,
      createdAt,
      timestamp,
      input.publishedAt ?? existing?.publishedAt ?? null
    );

    const share = this.getById(id);
    if (!share) {
      throw new Error("Failed to upsert memory share");
    }
    return share;
  }

  appendReview(input: Omit<MemoryShareReview, "id" | "createdAt">): MemoryShareReview {
    const id = generateId();
    const createdAt = nowIso();
    this.db.prepare(
      `INSERT INTO memory_share_reviews(id, share_id, action, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.shareId, input.action, input.note ?? null, input.createdBy, createdAt);
    return { ...input, id, createdAt };
  }

  listReviews(shareId: string): MemoryShareReview[] {
    const rows = this.db.prepare(
      "SELECT * FROM memory_share_reviews WHERE share_id = ? ORDER BY created_at DESC"
    ).all(shareId) as MemoryShareReviewRow[];
    return rows.map(toReview);
  }
}
