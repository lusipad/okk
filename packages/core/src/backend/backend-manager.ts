import type { BackendEvent, BackendEventInput, BackendRequest } from "../types.js";
import { AsyncEventQueue } from "../utils/async-event-queue.js";
import { generateId, nowIso } from "../utils/id.js";
import type { IBackend } from "./i-backend.js";

interface PendingRun {
  sequence: number;
  priority: number;
  request: BackendRequest;
  sessionId: string;
  output: AsyncEventQueue<BackendEvent>;
}

interface ActiveStream {
  backend: IBackend;
  subscribers: Set<AsyncEventQueue<BackendEvent>>;
}

export interface BackendManagerLogEntry {
  level: "info" | "warn" | "error";
  backend?: string;
  sessionId: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface BackendManagerOptions {
  maxConcurrent?: number;
  bufferSize?: number;
  onLog?: (entry: BackendManagerLogEntry) => void;
}

interface ReplayResult {
  ok: boolean;
  events: BackendEvent[];
  reason?: string;
}

export class BackendManager {
  private readonly backends = new Map<string, IBackend>();
  private readonly pending: PendingRun[] = [];
  private readonly activeStreams = new Map<string, ActiveStream>();
  private readonly sessionCounters = new Map<string, number>();
  private readonly eventBuffers = new Map<string, BackendEvent[]>();
  private readonly maxConcurrent: number;
  private readonly bufferSize: number;
  private readonly onLog?: (entry: BackendManagerLogEntry) => void;
  private activeCount = 0;
  private sequence = 0;

  constructor(options: BackendManagerOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.bufferSize = options.bufferSize ?? 300;
    this.onLog = options.onLog;
  }

  registerBackend(backend: IBackend): void {
    this.backends.set(backend.name, backend);
  }

  hasBackend(name: string): boolean {
    return this.backends.has(name);
  }

  listBackends(): string[] {
    return Array.from(this.backends.keys()).sort();
  }

  abort(sessionId: string): void {
    const activeStream = this.activeStreams.get(sessionId);
    activeStream?.backend.abort(sessionId);
  }

  isSessionActive(sessionId: string): boolean {
    return this.activeStreams.has(sessionId);
  }

  getBufferedEvents(sessionId: string): BackendEvent[] {
    return [...(this.eventBuffers.get(sessionId) ?? [])];
  }

  execute(request: BackendRequest): AsyncGenerator<BackendEvent> {
    const sessionId = request.sessionId ?? generateId();
    const output = new AsyncEventQueue<BackendEvent>();

    if (request.resumeFromEventId !== undefined) {
      const replay = this.replayFromBuffer(sessionId, request.resumeFromEventId);
      if (!replay.ok) {
        const event = this.createAndStoreEvent(sessionId, {
          type: "error",
          payload: {
            code: "resume_failed",
            message: replay.reason ?? "Requested event is outside current buffer window"
          }
        });
        output.push(event);
        output.end();
        return this.iterateQueue(output);
      }

      for (const event of replay.events) {
        output.push(event);
      }
    }

    const isResumeOnly = !request.prompt || request.prompt.trim().length === 0;
    if (isResumeOnly) {
      const active = this.activeStreams.get(sessionId);
      if (active) {
        active.subscribers.add(output);
      } else {
        output.end();
      }
      return this.iterateQueue(output);
    }

    this.pending.push({
      sequence: this.sequence++,
      priority: request.priority ?? 0,
      request,
      sessionId,
      output
    });

    this.pending.sort((a, b) => {
      if (a.priority === b.priority) {
        return a.sequence - b.sequence;
      }
      return b.priority - a.priority;
    });

    this.schedule();
    return this.iterateQueue(output);
  }

  private async *iterateQueue(queue: AsyncEventQueue<BackendEvent>): AsyncGenerator<BackendEvent> {
    for await (const event of queue) {
      yield event;
    }
  }

  private replayFromBuffer(sessionId: string, resumeFromEventId: number): ReplayResult {
    const buffer = this.eventBuffers.get(sessionId);
    if (!buffer || buffer.length === 0) {
      return {
        ok: false,
        events: [],
        reason: `No buffered events available for session ${sessionId}`
      };
    }

    const earliestId = buffer[0].event_id;
    if (resumeFromEventId < earliestId - 1) {
      return {
        ok: false,
        events: [],
        reason: `resume_from_event_id ${resumeFromEventId} is older than buffered window starting at ${earliestId}`
      };
    }

    return {
      ok: true,
      events: buffer.filter((event) => event.event_id > resumeFromEventId)
    };
  }

  private schedule(): void {
    while (this.activeCount < this.maxConcurrent && this.pending.length > 0) {
      const run = this.pending.shift();
      if (!run) {
        return;
      }

      this.activeCount += 1;
      void this.runPending(run).finally(() => {
        this.activeCount -= 1;
        this.schedule();
      });
    }
  }

  private async runPending(pendingRun: PendingRun): Promise<void> {
    const backend = this.backends.get(pendingRun.request.backend);
    if (!backend) {
      this.emitLog({
        level: "error",
        sessionId: pendingRun.sessionId,
        backend: pendingRun.request.backend,
        message: "backend_not_registered"
      });
      const event = this.createAndStoreEvent(pendingRun.sessionId, {
        type: "error",
        payload: {
          code: "backend_not_found",
          message: `Backend ${pendingRun.request.backend} is not registered`
        }
      });
      pendingRun.output.push(event);
      pendingRun.output.end();
      return;
    }

    let streamSessionId = pendingRun.sessionId;
    let doneSeen = false;
    const stream: ActiveStream = {
      backend,
      subscribers: new Set([pendingRun.output])
    };
    this.activeStreams.set(streamSessionId, stream);
    this.emitLog({
      level: "info",
      sessionId: streamSessionId,
      backend: backend.name,
      message: "backend_stream_started",
      data: {
        requestedBackend: pendingRun.request.backend
      }
    });

    try {
      for await (const rawEvent of backend.execute({
        ...pendingRun.request,
        sessionId: streamSessionId
      })) {
        const event = this.normalizeEvent(streamSessionId, rawEvent);
        if (event.type === "done") {
          doneSeen = true;
        }

        this.storeEvent(event.sessionId, event);
        this.broadcast(stream, event);

        if (event.type === "session_update" && event.payload.sessionId !== streamSessionId) {
          this.rebindSession(streamSessionId, event.payload.sessionId, stream);
          this.emitLog({
            level: "info",
            sessionId: streamSessionId,
            backend: backend.name,
            message: "backend_session_rebound",
            data: {
              nextSessionId: event.payload.sessionId
            }
          });
          streamSessionId = event.payload.sessionId;
        }
      }
    } catch (error) {
      this.emitLog({
        level: "error",
        sessionId: streamSessionId,
        backend: backend.name,
        message: "backend_execution_failed",
        data: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
      const event = this.createAndStoreEvent(streamSessionId, {
        type: "error",
        payload: {
          code: "backend_execution_failed",
          message: error instanceof Error ? error.message : "Unknown backend error"
        }
      });
      this.broadcast(stream, event);
    } finally {
      if (!doneSeen) {
        const doneEvent = this.createAndStoreEvent(streamSessionId, {
          type: "done",
          payload: { reason: "completed" }
        });
        this.broadcast(stream, doneEvent);
      }

      for (const subscriber of stream.subscribers) {
        subscriber.end();
      }
      this.activeStreams.delete(streamSessionId);
      this.emitLog({
        level: "info",
        sessionId: streamSessionId,
        backend: backend.name,
        message: "backend_stream_closed",
        data: { doneSeen }
      });
    }
  }

  private rebindSession(oldSessionId: string, newSessionId: string, stream: ActiveStream): void {
    if (oldSessionId === newSessionId) {
      return;
    }

    if (this.activeStreams.get(oldSessionId) === stream) {
      this.activeStreams.delete(oldSessionId);
    }
    this.activeStreams.set(newSessionId, stream);

    const oldCounter = this.sessionCounters.get(oldSessionId);
    if (oldCounter !== undefined && !this.sessionCounters.has(newSessionId)) {
      this.sessionCounters.set(newSessionId, oldCounter);
    }

    const oldBuffer = this.eventBuffers.get(oldSessionId);
    if (oldBuffer && !this.eventBuffers.has(newSessionId)) {
      this.eventBuffers.set(newSessionId, oldBuffer);
    }
  }

  private broadcast(stream: ActiveStream, event: BackendEvent): void {
    for (const subscriber of stream.subscribers) {
      subscriber.push(event);
    }
  }

  private createAndStoreEvent(
    sessionId: string,
    eventInput: BackendEventInput
  ): BackendEvent {
    const event = this.normalizeEvent(sessionId, eventInput);
    this.storeEvent(sessionId, event);
    return event;
  }

  private normalizeEvent(defaultSessionId: string, eventInput: BackendEventInput): BackendEvent {
    const sessionId =
      eventInput.sessionId ??
      (eventInput.type === "session_update"
        ? eventInput.payload.sessionId
        : defaultSessionId);

    const eventId = this.nextEventId(sessionId);
    return {
      type: eventInput.type,
      payload: eventInput.payload as BackendEvent["payload"],
      sessionId,
      event_id: eventId,
      timestamp: eventInput.timestamp ?? nowIso()
    } as BackendEvent;
  }

  private nextEventId(sessionId: string): number {
    const nextId = (this.sessionCounters.get(sessionId) ?? 0) + 1;
    this.sessionCounters.set(sessionId, nextId);
    return nextId;
  }

  private storeEvent(sessionId: string, event: BackendEvent): void {
    const buffer = this.eventBuffers.get(sessionId) ?? [];
    buffer.push(event);

    while (buffer.length > this.bufferSize) {
      buffer.shift();
    }

    this.eventBuffers.set(sessionId, buffer);
    this.sessionCounters.set(sessionId, Math.max(this.sessionCounters.get(sessionId) ?? 0, event.event_id));
  }

  private emitLog(entry: BackendManagerLogEntry): void {
    this.onLog?.(entry);
  }
}
