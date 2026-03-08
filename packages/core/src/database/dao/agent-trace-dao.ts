import type { AgentTraceEvent, AgentTraceFileChange, AgentTraceStatus } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface AgentTraceEventRow {
  id: string;
  session_id: string;
  trace_type: string;
  source_type: string;
  parent_trace_id: string | null;
  span_id: string;
  status: AgentTraceStatus;
  summary: string;
  payload_json: string;
  file_changes_json: string;
  created_at: string;
}

export interface AppendAgentTraceInput {
  sessionId: string;
  traceType: string;
  sourceType: string;
  summary: string;
  payload: Record<string, unknown>;
  parentTraceId?: string | null;
  spanId?: string;
  status?: AgentTraceStatus;
  fileChanges?: AgentTraceFileChange[];
}

export interface ListAgentTraceInput {
  limit?: number;
  traceType?: string;
  status?: AgentTraceStatus;
  sourceType?: string;
  q?: string;
  filePath?: string;
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

const parseFileChanges = (value: string): AgentTraceFileChange[] => {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is AgentTraceFileChange => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const candidate = item as Partial<AgentTraceFileChange>;
      return typeof candidate.path === "string" && typeof candidate.changeType === "string" && typeof candidate.diff === "string";
    });
  } catch {
    return [];
  }
};

const toTrace = (row: AgentTraceEventRow): AgentTraceEvent => ({
  id: row.id,
  sessionId: row.session_id,
  traceType: row.trace_type,
  sourceType: row.source_type,
  parentTraceId: row.parent_trace_id,
  spanId: row.span_id,
  status: row.status,
  summary: row.summary,
  payload: parseObject(row.payload_json),
  fileChanges: parseFileChanges(row.file_changes_json),
  createdAt: row.created_at
});

export class AgentTraceDao {
  constructor(private readonly db: SqliteConnection) {}

  append(input: AppendAgentTraceInput): AgentTraceEvent {
    const id = generateId();
    const createdAt = nowIso();
    const spanId = input.spanId ?? id;

    this.db.prepare(
      `INSERT INTO agent_trace_events(
         id, session_id, trace_type, source_type, parent_trace_id, span_id, status,
         summary, payload_json, file_changes_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.sessionId,
      input.traceType,
      input.sourceType,
      input.parentTraceId ?? null,
      spanId,
      input.status ?? "completed",
      input.summary,
      JSON.stringify(input.payload ?? {}),
      JSON.stringify(input.fileChanges ?? []),
      createdAt
    );

    return {
      id,
      sessionId: input.sessionId,
      traceType: input.traceType,
      sourceType: input.sourceType,
      parentTraceId: input.parentTraceId ?? null,
      spanId,
      status: input.status ?? "completed",
      summary: input.summary,
      payload: input.payload ?? {},
      fileChanges: input.fileChanges ?? [],
      createdAt
    };
  }

  listBySessionId(sessionId: string, input: ListAgentTraceInput = {}): AgentTraceEvent[] {
    const whereClauses = ["session_id = ?"];
    const params: unknown[] = [sessionId];

    if (input.traceType?.trim()) {
      whereClauses.push("trace_type = ?");
      params.push(input.traceType.trim());
    }

    if (input.status?.trim()) {
      whereClauses.push("status = ?");
      params.push(input.status.trim());
    }

    if (input.sourceType?.trim()) {
      whereClauses.push("source_type = ?");
      params.push(input.sourceType.trim());
    }

    if (input.q?.trim()) {
      whereClauses.push("(summary LIKE ? OR payload_json LIKE ?)");
      params.push(`%${input.q.trim()}%`, `%${input.q.trim()}%`);
    }

    if (input.filePath?.trim()) {
      whereClauses.push("file_changes_json LIKE ?");
      params.push(`%${input.filePath.trim().replace(/[%_]/g, "")}%`);
    }

    params.push(Math.max(1, Math.min(500, input.limit ?? 200)));
    const rows = this.db.prepare(
      `SELECT * FROM agent_trace_events WHERE ${whereClauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`
    ).all(...params) as AgentTraceEventRow[];

    return rows.map(toTrace);
  }

  getById(traceId: string): AgentTraceEvent | null {
    const row = this.db.prepare("SELECT * FROM agent_trace_events WHERE id = ?").get(traceId) as AgentTraceEventRow | undefined;
    return row ? toTrace(row) : null;
  }

  getFileDiff(traceId: string, filePath: string): AgentTraceFileChange | null {
    const trace = this.getById(traceId);
    if (!trace) {
      return null;
    }

    return trace.fileChanges.find((item) => item.path === filePath) ?? null;
  }
}
