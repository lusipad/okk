import type {
  KnowledgeSubscriptionConsumeStatus,
  KnowledgeSubscriptionRecord,
  KnowledgeSubscriptionSource,
  KnowledgeSubscriptionSourceType,
  KnowledgeSubscriptionStatus,
  KnowledgeSubscriptionSyncStatus,
  KnowledgeSubscriptionUpdateRecord
} from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface KnowledgeSubscriptionRow {
  id: string;
  user_id: string;
  source_type: KnowledgeSubscriptionSourceType;
  source_id: string;
  source_label: string;
  source_metadata_json: string;
  target_repo_id: string;
  subscription_status: KnowledgeSubscriptionStatus;
  last_cursor: string | null;
  last_synced_at: string | null;
  last_sync_status: KnowledgeSubscriptionSyncStatus;
  last_sync_summary: string | null;
  created_at: string;
  updated_at: string;
}

interface KnowledgeSubscriptionListRow extends KnowledgeSubscriptionRow {
  pending_update_count: number;
}

interface KnowledgeSubscriptionUpdateRow {
  id: string;
  subscription_id: string;
  share_id: string;
  source_entry_id: string;
  title: string;
  summary: string;
  category: string;
  repo_id: string;
  tags_json: string;
  source_author_id: string;
  source_author_name: string | null;
  source_updated_at: string;
  consume_status: KnowledgeSubscriptionConsumeStatus;
  imported_entry_id: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SyncCandidateRow {
  share_id: string;
  source_entry_id: string;
  title: string;
  summary: string;
  category: string;
  repo_id: string;
  source_author_id: string;
  source_author_name: string | null;
  source_updated_at: string;
}

export interface CreateKnowledgeSubscriptionInput {
  userId: string;
  source: KnowledgeSubscriptionSource;
  targetRepoId: string;
  status?: KnowledgeSubscriptionStatus;
}

export interface UpdateKnowledgeSubscriptionInput {
  sourceLabel?: string;
  sourceMetadata?: Record<string, unknown>;
  targetRepoId?: string;
  status?: KnowledgeSubscriptionStatus;
  lastCursor?: string | null;
  lastSyncedAt?: string | null;
  lastSyncStatus?: KnowledgeSubscriptionSyncStatus;
  lastSyncSummary?: string | null;
}

export interface ListKnowledgeSubscriptionUpdatesInput {
  consumeStatuses?: KnowledgeSubscriptionConsumeStatus[];
}

const parseObject = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const parseStringArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const toSource = (row: KnowledgeSubscriptionRow): KnowledgeSubscriptionSource => ({
  type: row.source_type,
  id: row.source_id,
  label: row.source_label,
  repoId: row.source_type === "project" ? row.source_id : null,
  tag: row.source_type === "topic" ? row.source_id : null,
  metadata: parseObject(row.source_metadata_json)
});

const toSubscriptionRecord = (row: KnowledgeSubscriptionListRow): KnowledgeSubscriptionRecord => ({
  id: row.id,
  userId: row.user_id,
  source: toSource(row),
  targetRepoId: row.target_repo_id,
  status: row.subscription_status,
  lastCursor: row.last_cursor,
  lastSyncedAt: row.last_synced_at,
  lastSyncStatus: row.last_sync_status,
  lastSyncSummary: row.last_sync_summary,
  pendingUpdateCount: row.pending_update_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toUpdateRecord = (row: KnowledgeSubscriptionUpdateRow): KnowledgeSubscriptionUpdateRecord => ({
  id: row.id,
  subscriptionId: row.subscription_id,
  shareId: row.share_id,
  sourceEntryId: row.source_entry_id,
  title: row.title,
  summary: row.summary,
  category: row.category,
  repoId: row.repo_id,
  tags: parseStringArray(row.tags_json),
  sourceAuthorId: row.source_author_id,
  sourceAuthorName: row.source_author_name,
  sourceUpdatedAt: row.source_updated_at,
  consumeStatus: row.consume_status,
  importedEntryId: row.imported_entry_id,
  consumedAt: row.consumed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class KnowledgeSubscriptionsDao {
  constructor(private readonly db: SqliteConnection) {}

  listByUserId(userId: string): KnowledgeSubscriptionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT
           s.*,
           (
             SELECT COUNT(*)
             FROM knowledge_subscription_updates u
             WHERE u.subscription_id = s.id AND u.consume_status = 'pending'
           ) AS pending_update_count
         FROM knowledge_subscriptions s
         WHERE s.user_id = ?
         ORDER BY s.updated_at DESC, s.created_at DESC, s.id ASC`
      )
      .all(userId) as KnowledgeSubscriptionListRow[];

    return rows.map(toSubscriptionRecord);
  }

  getById(id: string): KnowledgeSubscriptionRecord | null {
    const row = this.db
      .prepare(
        `SELECT
           s.*,
           (
             SELECT COUNT(*)
             FROM knowledge_subscription_updates u
             WHERE u.subscription_id = s.id AND u.consume_status = 'pending'
           ) AS pending_update_count
         FROM knowledge_subscriptions s
         WHERE s.id = ?`
      )
      .get(id) as KnowledgeSubscriptionListRow | undefined;

    return row ? toSubscriptionRecord(row) : null;
  }

  findByUserSource(userId: string, sourceType: KnowledgeSubscriptionSourceType, sourceId: string, targetRepoId: string): KnowledgeSubscriptionRecord | null {
    const row = this.db
      .prepare(
        `SELECT
           s.*,
           (
             SELECT COUNT(*)
             FROM knowledge_subscription_updates u
             WHERE u.subscription_id = s.id AND u.consume_status = 'pending'
           ) AS pending_update_count
         FROM knowledge_subscriptions s
         WHERE s.user_id = ? AND s.source_type = ? AND s.source_id = ? AND s.target_repo_id = ?`
      )
      .get(userId, sourceType, sourceId, targetRepoId) as KnowledgeSubscriptionListRow | undefined;

    return row ? toSubscriptionRecord(row) : null;
  }

  create(input: CreateKnowledgeSubscriptionInput): KnowledgeSubscriptionRecord {
    const id = generateId();
    const timestamp = nowIso();
    this.db
      .prepare(
        `INSERT INTO knowledge_subscriptions(
           id, user_id, source_type, source_id, source_label, source_metadata_json,
           target_repo_id, subscription_status, last_sync_status, last_sync_summary, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'idle', NULL, ?, ?)`
      )
      .run(
        id,
        input.userId,
        input.source.type,
        input.source.id,
        input.source.label,
        JSON.stringify(input.source.metadata ?? {}),
        input.targetRepoId,
        input.status ?? "active",
        timestamp,
        timestamp
      );

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create knowledge subscription");
    }
    return created;
  }

  update(id: string, input: UpdateKnowledgeSubscriptionInput): KnowledgeSubscriptionRecord | null {
    const existing = this.db
      .prepare("SELECT * FROM knowledge_subscriptions WHERE id = ?")
      .get(id) as KnowledgeSubscriptionRow | undefined;
    if (!existing) {
      return null;
    }

    this.db
      .prepare(
        `UPDATE knowledge_subscriptions
         SET source_label = ?,
             source_metadata_json = ?,
             target_repo_id = ?,
             subscription_status = ?,
             last_cursor = ?,
             last_synced_at = ?,
             last_sync_status = ?,
             last_sync_summary = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.sourceLabel ?? existing.source_label,
        JSON.stringify(input.sourceMetadata ?? parseObject(existing.source_metadata_json)),
        input.targetRepoId ?? existing.target_repo_id,
        input.status ?? existing.subscription_status,
        input.lastCursor === undefined ? existing.last_cursor : input.lastCursor,
        input.lastSyncedAt === undefined ? existing.last_synced_at : input.lastSyncedAt,
        input.lastSyncStatus ?? existing.last_sync_status,
        input.lastSyncSummary === undefined ? existing.last_sync_summary : input.lastSyncSummary,
        nowIso(),
        id
      );

    return this.getById(id);
  }

  listUpdates(subscriptionId: string, input: ListKnowledgeSubscriptionUpdatesInput = {}): KnowledgeSubscriptionUpdateRecord[] {
    const clauses = ["subscription_id = ?"];
    const params: unknown[] = [subscriptionId];

    if (input.consumeStatuses && input.consumeStatuses.length > 0) {
      clauses.push(`consume_status IN (${input.consumeStatuses.map(() => "?").join(", ")})`);
      params.push(...input.consumeStatuses);
    }

    const rows = this.db
      .prepare(
        `SELECT *
         FROM knowledge_subscription_updates
         WHERE ${clauses.join(" AND ")}
         ORDER BY source_updated_at DESC, created_at DESC, id DESC`
      )
      .all(...params) as KnowledgeSubscriptionUpdateRow[];

    return rows.map(toUpdateRecord);
  }

  getUpdateById(id: string): KnowledgeSubscriptionUpdateRecord | null {
    const row = this.db
      .prepare("SELECT * FROM knowledge_subscription_updates WHERE id = ?")
      .get(id) as KnowledgeSubscriptionUpdateRow | undefined;
    return row ? toUpdateRecord(row) : null;
  }

  markUpdateConsumed(
    updateId: string,
    consumeStatus: Extract<KnowledgeSubscriptionConsumeStatus, "imported" | "duplicate" | "skipped">,
    importedEntryId?: string | null
  ): KnowledgeSubscriptionUpdateRecord | null {
    const timestamp = nowIso();
    this.db
      .prepare(
        `UPDATE knowledge_subscription_updates
         SET consume_status = ?, imported_entry_id = ?, consumed_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(consumeStatus, importedEntryId ?? null, timestamp, timestamp, updateId);

    return this.getUpdateById(updateId);
  }

  sync(subscriptionId: string): {
    subscription: KnowledgeSubscriptionRecord;
    updates: KnowledgeSubscriptionUpdateRecord[];
    createdCount: number;
  } {
    const subscription = this.db
      .prepare("SELECT * FROM knowledge_subscriptions WHERE id = ?")
      .get(subscriptionId) as KnowledgeSubscriptionRow | undefined;
    if (!subscription) {
      throw new Error("knowledge subscription not found");
    }

    const filters = ["s.review_status = 'published'"];
    const params: unknown[] = [];

    if (subscription.source_type === "project") {
      filters.push("e.repo_id = ?");
      params.push(subscription.source_id);
    } else if (subscription.source_type === "topic") {
      filters.push("EXISTS (SELECT 1 FROM knowledge_tags kt WHERE kt.entry_id = e.id AND kt.tag = ?)");
      params.push(subscription.source_id);
    }

    if (subscription.last_cursor) {
      filters.push("e.updated_at > ?");
      params.push(subscription.last_cursor);
    }

    const candidates = this.db
      .prepare(
        `SELECT
           s.id AS share_id,
           e.id AS source_entry_id,
           e.title,
           e.summary,
           e.category,
           e.repo_id,
           e.created_by AS source_author_id,
           u.display_name AS source_author_name,
           e.updated_at AS source_updated_at
         FROM knowledge_shares s
         JOIN knowledge_entries e ON e.id = s.entry_id
         LEFT JOIN users u ON u.id = e.created_by
         WHERE ${filters.join(" AND ")}
         ORDER BY e.updated_at ASC, e.id ASC`
      )
      .all(...params) as SyncCandidateRow[];

    let createdCount = 0;
    const syncTimestamp = nowIso();
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO knowledge_subscription_updates(
         id, subscription_id, share_id, source_entry_id, title, summary, category, repo_id, tags_json,
         source_author_id, source_author_name, source_updated_at, consume_status, imported_entry_id,
         consumed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)`
    );

    const tx = this.db.transaction(() => {
      for (const candidate of candidates) {
        const tagRows = this.db
          .prepare("SELECT tag FROM knowledge_tags WHERE entry_id = ? ORDER BY tag ASC")
          .all(candidate.source_entry_id) as Array<{ tag: string }>;
        const result = insert.run(
          generateId(),
          subscriptionId,
          candidate.share_id,
          candidate.source_entry_id,
          candidate.title,
          candidate.summary,
          candidate.category,
          candidate.repo_id,
          JSON.stringify(tagRows.map((item) => item.tag)),
          candidate.source_author_id,
          candidate.source_author_name,
          candidate.source_updated_at,
          syncTimestamp,
          syncTimestamp
        ) as { changes: number };
        createdCount += result.changes;
      }

      this.db
        .prepare(
          `UPDATE knowledge_subscriptions
           SET last_cursor = ?, last_synced_at = ?, last_sync_status = 'success', last_sync_summary = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          candidates.at(-1)?.source_updated_at ?? subscription.last_cursor ?? syncTimestamp,
          syncTimestamp,
          candidates.length > 0 ? `同步完成，新增 ${createdCount} 条更新` : "同步完成，没有新的共享知识",
          syncTimestamp,
          subscriptionId
        );
    });

    tx();

    const item = this.getById(subscriptionId);
    if (!item) {
      throw new Error("knowledge subscription sync failed");
    }

    return {
      subscription: item,
      updates: this.listUpdates(subscriptionId),
      createdCount
    };
  }
}
