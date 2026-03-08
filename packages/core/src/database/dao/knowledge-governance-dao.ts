import type { KnowledgeEntry, KnowledgeGovernanceRecord, KnowledgeGovernanceReview } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface GovernanceRow {
  id: string;
  entry_id: string;
  source_type: string;
  source_label: string;
  health_score: number;
  governance_status: KnowledgeGovernanceRecord["status"];
  stale_reason: string | null;
  conflict_entry_ids_json: string;
  queue_reason: string | null;
  queue_priority: number;
  evidence_json: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rollback_version: number | null;
  merged_into_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

interface GovernanceReviewRow {
  id: string;
  governance_id: string;
  action: KnowledgeGovernanceReview["action"];
  note: string | null;
  actor_id: string;
  payload_json: string;
  created_at: string;
}

export interface UpsertKnowledgeGovernanceInput {
  entryId: string;
  sourceType?: string;
  sourceLabel?: string;
  healthScore: number;
  status: KnowledgeGovernanceRecord["status"];
  staleReason?: string | null;
  conflictEntryIds?: string[];
  queueReason?: string | null;
  queuePriority?: number;
  evidence?: Record<string, unknown>;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rollbackVersion?: number | null;
  mergedIntoEntryId?: string | null;
}

const parseObject = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const parseIds = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();

const toRecord = (row: GovernanceRow): KnowledgeGovernanceRecord => ({
  id: row.id,
  entryId: row.entry_id,
  sourceType: row.source_type,
  sourceLabel: row.source_label,
  healthScore: row.health_score,
  status: row.governance_status,
  staleReason: row.stale_reason,
  conflictEntryIds: parseIds(row.conflict_entry_ids_json),
  queueReason: row.queue_reason,
  queuePriority: row.queue_priority,
  evidence: parseObject(row.evidence_json),
  reviewedAt: row.reviewed_at,
  reviewedBy: row.reviewed_by,
  rollbackVersion: row.rollback_version,
  mergedIntoEntryId: row.merged_into_entry_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toReview = (row: GovernanceReviewRow): KnowledgeGovernanceReview => ({
  id: row.id,
  governanceId: row.governance_id,
  action: row.action,
  note: row.note,
  actorId: row.actor_id,
  payload: parseObject(row.payload_json),
  createdAt: row.created_at
});

export class KnowledgeGovernanceDao {
  constructor(private readonly db: SqliteConnection) {}

  list(status?: KnowledgeGovernanceRecord["status"]): KnowledgeGovernanceRecord[] {
    const rows = status
      ? this.db.prepare("SELECT * FROM knowledge_governance_records WHERE governance_status = ? ORDER BY queue_priority DESC, updated_at DESC").all(status)
      : this.db.prepare("SELECT * FROM knowledge_governance_records ORDER BY queue_priority DESC, updated_at DESC").all();
    return (rows as GovernanceRow[]).map(toRecord);
  }

  getById(id: string): KnowledgeGovernanceRecord | null {
    const row = this.db.prepare("SELECT * FROM knowledge_governance_records WHERE id = ?").get(id) as GovernanceRow | undefined;
    return row ? toRecord(row) : null;
  }

  getByEntryId(entryId: string): KnowledgeGovernanceRecord | null {
    const row = this.db.prepare("SELECT * FROM knowledge_governance_records WHERE entry_id = ?").get(entryId) as GovernanceRow | undefined;
    return row ? toRecord(row) : null;
  }

  upsert(input: UpsertKnowledgeGovernanceInput): KnowledgeGovernanceRecord {
    const existing = this.getByEntryId(input.entryId);
    const timestamp = nowIso();
    const id = existing?.id ?? generateId();
    const createdAt = existing?.createdAt ?? timestamp;

    this.db.prepare(
      `INSERT OR REPLACE INTO knowledge_governance_records(
         id, entry_id, source_type, source_label, health_score, governance_status, stale_reason,
         conflict_entry_ids_json, queue_reason, queue_priority, evidence_json, reviewed_at, reviewed_by,
         rollback_version, merged_into_entry_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.entryId,
      input.sourceType ?? existing?.sourceType ?? "system",
      input.sourceLabel ?? existing?.sourceLabel ?? "自动治理",
      input.healthScore,
      input.status,
      input.staleReason ?? null,
      JSON.stringify(input.conflictEntryIds ?? existing?.conflictEntryIds ?? []),
      input.queueReason ?? null,
      input.queuePriority ?? 0,
      JSON.stringify(input.evidence ?? existing?.evidence ?? {}),
      input.reviewedAt ?? existing?.reviewedAt ?? null,
      input.reviewedBy ?? existing?.reviewedBy ?? null,
      input.rollbackVersion ?? existing?.rollbackVersion ?? null,
      input.mergedIntoEntryId ?? existing?.mergedIntoEntryId ?? null,
      createdAt,
      timestamp
    );

    const record = this.getById(id);
    if (!record) {
      throw new Error("Failed to upsert governance record");
    }
    return record;
  }

  refresh(entries: KnowledgeEntry[]): KnowledgeGovernanceRecord[] {
    const now = Date.now();
    return entries.map((entry) => {
      const updatedAgeDays = Math.floor((now - new Date(entry.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
      const conflictIds = entries
        .filter((candidate) => candidate.id !== entry.id && candidate.repoId === entry.repoId && normalizeText(candidate.title) === normalizeText(entry.title) && normalizeText(candidate.content) !== normalizeText(entry.content))
        .map((candidate) => candidate.id);

      let status: KnowledgeGovernanceRecord["status"] = "healthy";
      let queueReason: string | null = null;
      let queuePriority = 10;
      let staleReason: string | null = null;
      let healthScore = Math.max(0.1, 1 - updatedAgeDays / 120);

      if (entry.status === "stale" || updatedAgeDays > 30) {
        status = "stale";
        queueReason = entry.status === "stale" ? "知识已被标记为过时" : `超过 ${updatedAgeDays} 天未更新`;
        staleReason = queueReason;
        queuePriority = 80;
        healthScore = Math.min(healthScore, 0.45);
      }

      if (conflictIds.length > 0) {
        status = "conflict";
        queueReason = `发现 ${conflictIds.length} 条同标题冲突知识`;
        queuePriority = 100;
        healthScore = Math.min(healthScore, 0.35);
      }

      if (entry.status === "draft") {
        status = "pending_review";
        queueReason = queueReason ?? "待审核发布";
        queuePriority = Math.max(queuePriority, 60);
        healthScore = Math.min(healthScore, 0.6);
      }

      return this.upsert({
        entryId: entry.id,
        healthScore,
        status,
        staleReason,
        conflictEntryIds: conflictIds,
        queueReason,
        queuePriority,
        evidence: { updatedAt: entry.updatedAt, version: entry.version, status: entry.status }
      });
    });
  }

  appendReview(input: Omit<KnowledgeGovernanceReview, "id" | "createdAt">): KnowledgeGovernanceReview {
    const id = generateId();
    const createdAt = nowIso();
    this.db.prepare(
      `INSERT INTO knowledge_governance_reviews(id, governance_id, action, note, actor_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.governanceId, input.action, input.note ?? null, input.actorId, JSON.stringify(input.payload ?? {}), createdAt);
    return { ...input, id, createdAt };
  }

  listReviews(governanceId: string): KnowledgeGovernanceReview[] {
    const rows = this.db.prepare(
      "SELECT * FROM knowledge_governance_reviews WHERE governance_id = ? ORDER BY created_at DESC"
    ).all(governanceId) as GovernanceReviewRow[];
    return rows.map(toReview);
  }

  markReviewed(id: string, actorId: string, action: KnowledgeGovernanceReview["action"], patch: Partial<Pick<KnowledgeGovernanceRecord, "status" | "rollbackVersion" | "mergedIntoEntryId">> = {}, note?: string | null, payload: Record<string, unknown> = {}): KnowledgeGovernanceRecord | null {
    const current = this.getById(id);
    if (!current) {
      return null;
    }

    const updated = this.upsert({
      entryId: current.entryId,
      sourceType: current.sourceType,
      sourceLabel: current.sourceLabel,
      healthScore: patch.status === "healthy" ? 1 : current.healthScore,
      status: patch.status ?? current.status,
      staleReason: current.staleReason,
      conflictEntryIds: current.conflictEntryIds,
      queueReason: patch.status === "healthy" ? null : current.queueReason,
      queuePriority: patch.status === "healthy" ? 0 : current.queuePriority,
      evidence: current.evidence,
      reviewedAt: nowIso(),
      reviewedBy: actorId,
      rollbackVersion: patch.rollbackVersion ?? current.rollbackVersion,
      mergedIntoEntryId: patch.mergedIntoEntryId ?? current.mergedIntoEntryId
    });

    this.appendReview({
      governanceId: id,
      action,
      note: note ?? null,
      actorId,
      payload
    });

    return updated;
  }
}
