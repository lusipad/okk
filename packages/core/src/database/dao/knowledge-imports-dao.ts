import type { KnowledgeImportBatch, KnowledgeImportItem, KnowledgeImportItemStatus, KnowledgeImportStatus } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface BatchRow {
  id: string;
  name: string;
  source_types_json: string;
  source_summary: string;
  status: KnowledgeImportStatus;
  item_count: number;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  batch_id: string;
  title: string;
  summary: string;
  content: string;
  repo_id: string | null;
  source_type: string;
  source_ref: string | null;
  dedupe_key: string;
  evidence_json: string;
  status: KnowledgeImportItemStatus;
  merged_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeImportBatchInput {
  id?: string;
  name: string;
  sourceTypes: string[];
  sourceSummary: string;
}

export interface CreateKnowledgeImportItemInput {
  id?: string;
  batchId: string;
  title: string;
  summary: string;
  content: string;
  repoId?: string | null;
  sourceType: string;
  sourceRef?: string | null;
  dedupeKey: string;
  evidence?: Record<string, unknown>;
  status?: KnowledgeImportItemStatus;
  mergedEntryId?: string | null;
}

const parseStringArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const parseObject = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const toBatch = (row: BatchRow): KnowledgeImportBatch => ({
  id: row.id,
  name: row.name,
  sourceTypes: parseStringArray(row.source_types_json),
  sourceSummary: row.source_summary,
  status: row.status,
  itemCount: row.item_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toItem = (row: ItemRow): KnowledgeImportItem => ({
  id: row.id,
  batchId: row.batch_id,
  title: row.title,
  summary: row.summary,
  content: row.content,
  repoId: row.repo_id,
  sourceType: row.source_type,
  sourceRef: row.source_ref,
  dedupeKey: row.dedupe_key,
  evidence: parseObject(row.evidence_json),
  status: row.status,
  mergedEntryId: row.merged_entry_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class KnowledgeImportsDao {
  constructor(private readonly db: SqliteConnection) {}

  listBatches(): KnowledgeImportBatch[] {
    const rows = this.db.prepare("SELECT * FROM knowledge_import_batches ORDER BY updated_at DESC, created_at DESC").all() as BatchRow[];
    return rows.map(toBatch);
  }

  getBatch(id: string): KnowledgeImportBatch | null {
    const row = this.db.prepare("SELECT * FROM knowledge_import_batches WHERE id = ?").get(id) as BatchRow | undefined;
    return row ? toBatch(row) : null;
  }

  listItems(batchId: string): KnowledgeImportItem[] {
    const rows = this.db.prepare("SELECT * FROM knowledge_import_items WHERE batch_id = ? ORDER BY created_at ASC").all(batchId) as ItemRow[];
    return rows.map(toItem);
  }

  getItem(id: string): KnowledgeImportItem | null {
    const row = this.db.prepare("SELECT * FROM knowledge_import_items WHERE id = ?").get(id) as ItemRow | undefined;
    return row ? toItem(row) : null;
  }

  createBatch(input: CreateKnowledgeImportBatchInput): KnowledgeImportBatch {
    const id = input.id ?? generateId();
    const timestamp = nowIso();
    this.db.prepare(
      `INSERT INTO knowledge_import_batches(id, name, source_types_json, source_summary, status, item_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', 0, ?, ?)`
    ).run(id, input.name.trim(), JSON.stringify(input.sourceTypes), input.sourceSummary, timestamp, timestamp);

    const batch = this.getBatch(id);
    if (!batch) {
      throw new Error("Failed to create import batch");
    }
    return batch;
  }

  addItems(items: CreateKnowledgeImportItemInput[]): KnowledgeImportItem[] {
    if (items.length === 0) {
      return [];
    }

    const timestamp = nowIso();
    const insert = this.db.prepare(
      `INSERT INTO knowledge_import_items(
         id, batch_id, title, summary, content, repo_id, source_type, source_ref,
         dedupe_key, evidence_json, status, merged_entry_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = this.db.transaction(() => {
      for (const item of items) {
        insert.run(
          item.id ?? generateId(),
          item.batchId,
          item.title,
          item.summary,
          item.content,
          item.repoId ?? null,
          item.sourceType,
          item.sourceRef ?? null,
          item.dedupeKey,
          JSON.stringify(item.evidence ?? {}),
          item.status ?? "pending",
          item.mergedEntryId ?? null,
          timestamp,
          timestamp
        );
      }

      this.db.prepare(
        "UPDATE knowledge_import_batches SET item_count = (SELECT COUNT(*) FROM knowledge_import_items WHERE batch_id = ?), updated_at = ? WHERE id = ?"
      ).run(items[0].batchId, timestamp, items[0].batchId);
    });

    tx();
    return this.listItems(items[0].batchId);
  }

  updateBatchStatus(batchId: string, status: KnowledgeImportStatus): KnowledgeImportBatch | null {
    this.db.prepare("UPDATE knowledge_import_batches SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), batchId);
    return this.getBatch(batchId);
  }

  updateItemStatus(itemId: string, status: KnowledgeImportItemStatus, mergedEntryId?: string | null): KnowledgeImportItem | null {
    this.db.prepare(
      "UPDATE knowledge_import_items SET status = ?, merged_entry_id = ?, updated_at = ? WHERE id = ?"
    ).run(status, mergedEntryId ?? null, nowIso(), itemId);
    return this.getItem(itemId);
  }
}
