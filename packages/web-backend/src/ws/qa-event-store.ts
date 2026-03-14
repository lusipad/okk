import type { BackendEventEnvelope } from "../types/contracts.js";

export interface KnowledgeSuggestionSnapshot {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  content: string;
  knowledgeEntryId?: string | null;
  status: "pending" | "saved" | "ignored";
  createdAt: string;
  sourceMessageId: string;
}

interface SessionState {
  nextEventId: number;
  history: BackendEventEnvelope[];
  idempotency: Map<string, BackendEventEnvelope[]>;
  suggestions: Map<string, KnowledgeSuggestionSnapshot>;
}

export class QaEventStore {
  private readonly maxHistoryPerSession: number;

  private readonly sessions = new Map<string, SessionState>();

  constructor(maxHistoryPerSession = 500) {
    this.maxHistoryPerSession = maxHistoryPerSession;
  }

  createEvent<TPayload extends Record<string, unknown>>(
    sessionId: string,
    type: string,
    payload: TPayload,
  ): BackendEventEnvelope<TPayload> {
    const session = this.getOrCreateSession(sessionId);
    const event: BackendEventEnvelope<TPayload> = {
      type,
      sessionId,
      event_id: session.nextEventId,
      timestamp: new Date().toISOString(),
      payload,
    };
    session.nextEventId += 1;
    session.history.push(event);
    if (session.history.length > this.maxHistoryPerSession) {
      session.history.splice(0, session.history.length - this.maxHistoryPerSession);
    }
    return event;
  }

  saveIdempotentEvents(sessionId: string, clientMessageId: string, events: BackendEventEnvelope[]): void {
    const session = this.getOrCreateSession(sessionId);
    session.idempotency.set(clientMessageId, events.map((event) => ({ ...event })));
  }

  getIdempotentEvents(sessionId: string, clientMessageId: string): BackendEventEnvelope[] | null {
    const events = this.sessions.get(sessionId)?.idempotency.get(clientMessageId);
    if (!events) {
      return null;
    }

    return events.map((event) => ({ ...event }));
  }

  eventsSince(sessionId: string, lastEventId = 0): BackendEventEnvelope[] {
    const history = this.sessions.get(sessionId)?.history ?? [];
    return history.filter((event) => event.event_id > lastEventId).map((event) => ({ ...event }));
  }

  lastEventId(sessionId: string): number {
    const history = this.sessions.get(sessionId)?.history;
    if (!history || history.length === 0) {
      return 0;
    }
    return history[history.length - 1].event_id;
  }

  saveSuggestion(sessionId: string, suggestion: KnowledgeSuggestionSnapshot): KnowledgeSuggestionSnapshot {
    const session = this.getOrCreateSession(sessionId);
    session.suggestions.set(suggestion.id, { ...suggestion });
    return { ...suggestion };
  }

  getSuggestion(sessionId: string, suggestionId: string): KnowledgeSuggestionSnapshot | null {
    const suggestion = this.sessions.get(sessionId)?.suggestions.get(suggestionId);
    if (!suggestion) {
      return null;
    }
    return { ...suggestion };
  }

  updateSuggestionStatus(
    sessionId: string,
    suggestionId: string,
    status: KnowledgeSuggestionSnapshot["status"]
  ): KnowledgeSuggestionSnapshot | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const current = session.suggestions.get(suggestionId);
    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      status
    };
    session.suggestions.set(suggestionId, updated);
    return { ...updated };
  }

  private getOrCreateSession(sessionId: string): SessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const created: SessionState = {
      nextEventId: 1,
      history: [],
      idempotency: new Map(),
      suggestions: new Map(),
    };
    this.sessions.set(sessionId, created);
    return created;
  }
}
