import type {
  SessionAbortIgnoredPayload,
  SessionEventEnvelope,
  SessionEventSubscriber,
  SessionResumeFailedPayload,
  SessionResumedPayload,
  TeamSubscriber,
  TeamWsEvent,
  WsConnectionState
} from './types';

type QaAction = 'ask' | 'follow_up' | 'abort' | 'resume';

interface QaClientMessage {
  action: QaAction;
  backend: string;
  agent_name: string;
  client_message_id: string;
  content?: string;
  last_event_id?: number;
  skill_ids?: string[];
  mcp_server_ids?: string[];
}

interface RawBackendEvent {
  type?: unknown;
  sessionId?: unknown;
  event_id?: unknown;
  timestamp?: unknown;
  payload?: unknown;
}

interface RuntimeIdentity {
  backend: string;
  agentName: string;
}

const DEFAULT_RUNTIME: RuntimeIdentity = {
  backend: 'codex',
  agentName: 'code-reviewer'
};
const MAX_BUFFERED_EVENTS = 200;

const passthroughTypes = new Set<SessionEventEnvelope['type']>([
  'message_started',
  'message_chunk',
  'message_done',
  'message_aborted',
  'message_error',
  'tool_call',
  'knowledge_suggestion',
  'team_event',
  'session_done',
  'session_resumed',
  'session_resume_failed',
  'session_abort_ignored',
  'auth_expired'
]);

function createWsMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
}

function toText(input: unknown, fallback: string): string {
  return typeof input === 'string' && input.trim().length > 0 ? input : fallback;
}

function toNumber(input: unknown, fallback = 0): number {
  return typeof input === 'number' && Number.isFinite(input) ? input : fallback;
}

function toSessionId(input: unknown, fallback: string): string {
  return typeof input === 'string' && input.trim().length > 0 ? input : fallback;
}

function buildDiagnostics(code: string, message: string, detail?: string, retryable = true) {
  return {
    code,
    message,
    ...(detail ? { detail } : {}),
    retryable,
    severity: retryable ? 'warning' : 'error'
  } as const;
}

export function normalizeIncomingEvent(raw: unknown, fallbackSessionId: string): SessionEventEnvelope | null {
  const incoming = raw as RawBackendEvent;
  const type = incoming.type;
  const eventId = typeof incoming.event_id === 'number' ? incoming.event_id : NaN;

  if (typeof type !== 'string' || Number.isNaN(eventId)) {
    return null;
  }

  const sessionId = toSessionId(incoming.sessionId, fallbackSessionId);
  const timestamp = toText(incoming.timestamp, new Date().toISOString());
  const payload = toRecord(incoming.payload);

  if (passthroughTypes.has(type as SessionEventEnvelope['type'])) {
    return {
      type: type as SessionEventEnvelope['type'],
      sessionId,
      event_id: eventId,
      timestamp,
      payload
    };
  }

  const messageId = toText(payload.client_message_id, `assistant-${eventId}`);

  if (type === 'qa.accepted') {
    return {
      type: 'message_started',
      sessionId,
      event_id: eventId,
      timestamp,
      payload: { messageId }
    };
  }

  if (type === 'qa.chunk') {
    return {
      type: 'message_chunk',
      sessionId,
      event_id: eventId,
      timestamp,
      payload: {
        messageId,
        chunk: toText(payload.chunk, '')
      }
    };
  }

  if (type === 'qa.completed') {
    return {
      type: 'message_done',
      sessionId,
      event_id: eventId,
      timestamp,
      payload: { messageId }
    };
  }

  if (type === 'qa.aborted') {
    return {
      type: 'message_aborted',
      sessionId,
      event_id: eventId,
      timestamp,
      payload: { messageId }
    };
  }

  if (type === 'qa.abort_ignored') {
    const nextPayload: SessionAbortIgnoredPayload = {
      message: '当前没有正在执行的请求可中止。',
      diagnostics: buildDiagnostics('qa_abort_ignored', '没有可中止的进行中请求', '当前会话已不处于流式执行状态。')
    };
    return {
      type: 'session_abort_ignored',
      sessionId,
      event_id: eventId,
      timestamp,
      payload: nextPayload as unknown as Record<string, unknown>
    };
  }

  if (type === 'qa.resume_ack') {
    const nextPayload: SessionResumedPayload = {
      replayCount: toNumber(payload.replay_count),
      lastEventId: toNumber(payload.last_event_id)
    };
    return {
      type: 'session_resumed',
      sessionId,
      event_id: eventId,
      timestamp,
      payload: nextPayload as unknown as Record<string, unknown>
    };
  }

  if (type === 'qa.resume_failed') {
    const lastEventId = toNumber(payload.last_event_id);
    const latestEventId = toNumber(payload.latest_event_id);
    const error = '事件恢复失败，请重试上一条消息或重新发起请求。';
    const nextPayload: SessionResumeFailedPayload = {
      lastEventId,
      latestEventId,
      error,
      diagnostics: buildDiagnostics(
        'qa_resume_failed',
        '事件恢复失败',
        `last_event_id=${lastEventId}，latest_event_id=${latestEventId}`
      )
    };
    return {
      type: 'session_resume_failed',
      sessionId,
      event_id: eventId,
      timestamp,
      payload: nextPayload as unknown as Record<string, unknown>
    };
  }

  if (type === 'qa.error') {
    const error = toText(payload.reason, 'unknown_error');
    return {
      type: 'message_error',
      sessionId,
      event_id: eventId,
      timestamp,
      payload: {
        messageId,
        error,
        diagnostics: buildDiagnostics('qa_error', error)
      }
    };
  }

  return null;
}

export class SessionWsClient {
  private readonly wsBaseUrl: string;
  private readonly sessionId: string;
  private readonly getToken: () => string | null;
  private readonly onAuthExpired: () => void;
  private readonly subscribers = new Set<SessionEventSubscriber>();
  private readonly bufferedEvents: SessionEventEnvelope[] = [];
  private readonly outboundQueue: string[] = [];
  private ws: WebSocket | null = null;
  private lastEventId: number | undefined;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private isClosing = false;
  private lastRuntime: RuntimeIdentity = { ...DEFAULT_RUNTIME };

  constructor(options: { wsBaseUrl: string; sessionId: string; getToken: () => string | null; onAuthExpired: () => void }) {
    this.wsBaseUrl = options.wsBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '');
    this.sessionId = options.sessionId;
    this.getToken = options.getToken;
    this.onAuthExpired = options.onAuthExpired;
  }

  subscribe(subscriber: SessionEventSubscriber, lastEventId?: number): () => void {
    this.subscribers.add(subscriber);
    if (lastEventId !== undefined) {
      this.lastEventId = Math.max(this.lastEventId ?? 0, lastEventId);
    }

    this.replayBufferedEvents(subscriber, lastEventId);

    this.shouldReconnect = true;
    if (!this.ws) {
      this.open('connecting');
    } else {
      subscriber.onConnectionState('connected');
    }

    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0 && this.outboundQueue.length === 0) {
        this.close();
      }
    };
  }

  sendQaMessage(message: QaClientMessage): void {
    if (message.action === 'ask' || message.action === 'follow_up') {
      this.lastRuntime = {
        backend: message.backend,
        agentName: message.agent_name
      };
    }

    const serialized = JSON.stringify(message);
    this.shouldReconnect = true;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
      return;
    }

    this.outboundQueue.push(serialized);
    if (!this.ws) {
      this.open('connecting');
    }
  }

  sendAbortMessage(): void {
    const runtime = this.lastRuntime;
    this.sendQaMessage({
      action: 'abort',
      backend: runtime.backend,
      agent_name: runtime.agentName,
      client_message_id: createWsMessageId('abort')
    });
  }

  get hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  close(): void {
    this.shouldReconnect = false;
    this.isClosing = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.emitConnectionState('disconnected');
  }

  private replayBufferedEvents(subscriber: SessionEventSubscriber, lastEventId?: number): void {
    const baseline = lastEventId ?? 0;
    for (const event of this.bufferedEvents) {
      if (event.event_id > baseline) {
        subscriber.onEvent(event);
      }
    }
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.outboundQueue.length > 0) {
      const payload = this.outboundQueue.shift();
      if (!payload) {
        return;
      }
      this.ws.send(payload);
    }
  }

  private sendResume(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.lastEventId === undefined) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        action: 'resume',
        backend: this.lastRuntime.backend,
        agent_name: this.lastRuntime.agentName,
        client_message_id: createWsMessageId('resume'),
        last_event_id: this.lastEventId
      })
    );
  }

  private pushBufferedEvent(event: SessionEventEnvelope): void {
    this.bufferedEvents.push(event);
    if (this.bufferedEvents.length > MAX_BUFFERED_EVENTS) {
      this.bufferedEvents.splice(0, this.bufferedEvents.length - MAX_BUFFERED_EVENTS);
    }
  }

  private open(state: WsConnectionState): void {
    if (this.subscribers.size === 0 && this.outboundQueue.length === 0) {
      return;
    }

    this.isClosing = false;
    this.emitConnectionState(state);

    const params = new URLSearchParams();
    const token = this.getToken();
    if (token) {
      params.set('token', token);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const url = `${this.wsBaseUrl}/ws/qa/${this.sessionId}${suffix}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.emitConnectionState('connected');
      this.sendResume();
      this.flushQueue();
    };

    this.ws.onmessage = (incoming) => {
      try {
        const parsed = JSON.parse(String(incoming.data)) as unknown;
        const normalized = normalizeIncomingEvent(parsed, this.sessionId);

        if (!normalized) {
          return;
        }

        if (normalized.type === 'auth_expired') {
          this.onAuthExpired();
          return;
        }

        this.lastEventId = normalized.event_id;
        this.pushBufferedEvent(normalized);
        this.subscribers.forEach((item) => item.onEvent(normalized));
      } catch {
        this.subscribers.forEach((item) => item.onError?.(new Error('WebSocket message parse failed')));
      }
    };

    this.ws.onerror = () => {
      this.subscribers.forEach((item) => item.onError?.(new Error('WebSocket connection error')));
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.isClosing || !this.shouldReconnect || (this.subscribers.size === 0 && this.outboundQueue.length === 0)) {
        this.emitConnectionState('disconnected');
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    this.emitConnectionState('reconnecting');
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 10000);
    this.reconnectAttempt += 1;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.open('reconnecting');
    }, delay);
  }

  private emitConnectionState(state: WsConnectionState): void {
    this.subscribers.forEach((item) => item.onConnectionState(state));
  }
}

function normalizeTeamEvent(raw: unknown): TeamWsEvent | null {
  const payload = toRecord(raw);
  const type = payload.type;
  const teamId = payload.teamId;
  const eventId = payload.event_id;
  const timestamp = payload.timestamp;

  if (
    typeof type !== 'string' ||
    typeof teamId !== 'string' ||
    typeof eventId !== 'number' ||
    typeof timestamp !== 'string'
  ) {
    return null;
  }

  return {
    type: type as TeamWsEvent['type'],
    teamId,
    event_id: eventId,
    timestamp,
    payload: toRecord(payload.payload)
  };
}

export class TeamWsClient {
  private readonly wsBaseUrl: string;
  private readonly teamId: string;
  private readonly getToken: () => string | null;
  private readonly onAuthExpired: () => void;
  private readonly subscribers = new Set<TeamSubscriber>();
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private isClosing = false;

  constructor(options: { wsBaseUrl: string; teamId: string; getToken: () => string | null; onAuthExpired: () => void }) {
    this.wsBaseUrl = options.wsBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '');
    this.teamId = options.teamId;
    this.getToken = options.getToken;
    this.onAuthExpired = options.onAuthExpired;
  }

  subscribe(subscriber: TeamSubscriber): () => void {
    this.subscribers.add(subscriber);
    this.shouldReconnect = true;

    if (!this.ws) {
      this.open('connecting');
    } else {
      subscriber.onConnectionState?.('connected');
    }

    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0) {
        this.close();
      }
    };
  }

  get hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  close(): void {
    this.shouldReconnect = false;
    this.isClosing = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.emitConnectionState('disconnected');
  }

  private open(state: WsConnectionState): void {
    if (this.subscribers.size === 0) {
      return;
    }

    this.isClosing = false;
    this.emitConnectionState(state);

    const params = new URLSearchParams();
    const token = this.getToken();
    if (token) {
      params.set('token', token);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const url = `${this.wsBaseUrl}/ws/team/${this.teamId}${suffix}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.emitConnectionState('connected');
    };

    this.ws.onmessage = (incoming) => {
      try {
        const parsed = JSON.parse(String(incoming.data)) as unknown;
        const normalized = normalizeTeamEvent(parsed);
        if (!normalized) {
          return;
        }
        if (normalized.type === 'auth_expired') {
          this.onAuthExpired();
          return;
        }
        this.subscribers.forEach((item) => item.onEvent(normalized));
      } catch {
        this.subscribers.forEach((item) => item.onError?.(new Error('Team WebSocket message parse failed')));
      }
    };

    this.ws.onerror = () => {
      this.subscribers.forEach((item) => item.onError?.(new Error('Team WebSocket connection error')));
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.isClosing || !this.shouldReconnect || this.subscribers.size === 0) {
        this.emitConnectionState('disconnected');
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    this.emitConnectionState('reconnecting');
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 10000);
    this.reconnectAttempt += 1;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.open('reconnecting');
    }, delay);
  }

  private emitConnectionState(state: WsConnectionState): void {
    this.subscribers.forEach((item) => item.onConnectionState?.(state));
  }
}

