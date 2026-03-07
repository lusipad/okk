import type { Message } from "../../types.js";
import type { SqliteConnection } from "../sqlite-adapter.js";
import { generateId, nowIso } from "../../utils/id.js";

interface MessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: string;
  client_message_id: string | null;
  created_at: string;
}

export interface CreateMessageInput {
  id?: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  clientMessageId?: string | null;
}

const parseMetadata = (metadata: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
};

const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role,
  content: row.content,
  metadata: parseMetadata(row.metadata),
  clientMessageId: row.client_message_id,
  createdAt: row.created_at
});

export class MessagesDao {
  constructor(private readonly db: SqliteConnection) {}

  create(input: CreateMessageInput): Message {
    const id = input.id ?? generateId();
    const createdAt = nowIso();

    this.db
      .prepare(
        `INSERT INTO messages(id, session_id, role, content, metadata, client_message_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.sessionId,
        input.role,
        input.content,
        JSON.stringify(input.metadata ?? {}),
        input.clientMessageId ?? null,
        createdAt
      );

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to create message");
    }

    return created;
  }

  getById(id: string): Message | null {
    const row = this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as MessageRow | undefined;
    return row ? toMessage(row) : null;
  }

  getByClientMessageId(sessionId: string, clientMessageId: string): Message | null {
    const row = this.db
      .prepare("SELECT * FROM messages WHERE session_id = ? AND client_message_id = ?")
      .get(sessionId, clientMessageId) as MessageRow | undefined;
    return row ? toMessage(row) : null;
  }

  listBySessionId(sessionId: string): Message[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC")
      .all(sessionId) as MessageRow[];
    return rows.map(toMessage);
  }
}


