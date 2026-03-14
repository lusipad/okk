import type { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { OkkCore } from "../core/types.js";
import type {
  BackendEventEnvelope,
  CollaborationAction,
  CollaborationDiagnostics,
  CollaborationRunStatus,
  QaAskMessage,
  QaClientMessage,
  QaResumeMessage
} from "../types/contracts.js";
import { parseQaClientMessage } from "../types/contracts.js";
import { QaEventStore, type KnowledgeSuggestionSnapshot } from "./qa-event-store.js";

function sendJson(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== socket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

type SuggestionView = Omit<KnowledgeSuggestionSnapshot, "sourceMessageId" | "createdAt">;

const MAX_SUMMARY_LENGTH = 180;

function summarize(content: string, maxLength = MAX_SUMMARY_LENGTH): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function buildSuggestionContent(question: string, answer: string): string {
  return [
    "## 背景问题",
    question.trim(),
    "",
    "## 建议结论",
    answer.trim()
  ]
    .join("\n")
    .trim();
}

function toSuggestionView(input: KnowledgeSuggestionSnapshot): SuggestionView {
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    category: input.category,
    tags: [...input.tags],
    content: input.content,
    knowledgeEntryId: input.knowledgeEntryId ?? null,
    status: input.status
  };
}

function normalizeSuggestionTags(input: string[] | undefined, fallback: string[]): string[] {
  const source = input ?? fallback;
  return Array.from(new Set(source.map((item) => item.trim()).filter(Boolean)));
}

function buildDiagnostics(message: string, options?: { code?: string; detail?: string; retryable?: boolean }): CollaborationDiagnostics {
  return {
    message,
    ...(options?.code ? { code: options.code } : {}),
    ...(options?.detail ? { detail: options.detail } : {}),
    ...(options?.retryable !== undefined ? { retryable: options.retryable } : {}),
    severity: "error"
  };
}

function buildActions(...kinds: Array<CollaborationAction["kind"]>): CollaborationAction[] | undefined {
  if (kinds.length === 0) {
    return undefined;
  }

  return kinds.map((kind) => ({
    kind,
    label:
      kind === "retry"
        ? "重试消息"
        : kind === "refresh"
          ? "刷新状态"
          : kind === "open_route"
            ? "打开配置"
            : "复制诊断"
  }));
}

function buildRouteAction(label: string, route: string): CollaborationAction {
  return {
    kind: "open_route",
    label,
    route
  };
}

function buildRuntimeMeta(input: {
  runId: string;
  sourceType: "team" | "agent" | "skill" | "mcp" | "backend" | "tool";
  runtimeStatus: CollaborationRunStatus;
  diagnostics?: CollaborationDiagnostics;
  actions?: CollaborationAction[];
}) {
  return {
    run_id: input.runId,
    source_type: input.sourceType,
    runtime_status: input.runtimeStatus,
    ...(input.diagnostics ? { diagnostics: input.diagnostics } : {}),
    ...(input.actions ? { actions: input.actions } : {})
  };
}

export class QaGateway {
  private readonly eventStore = new QaEventStore();

  private readonly inflight = new Map<string, { aborted: boolean; messageId: string }>();

  private readonly pendingByMessage = new Map<string, Promise<void>>();

  private readonly traceSnapshots = new Map<string, Map<string, string>>();

  private appendTrace(
    sessionId: string,
    traceType: string,
    sourceType: string,
    summary: string,
    payload: Record<string, unknown>,
    options?: {
      parentTraceId?: string | null;
      spanId?: string;
      status?: 'running' | 'completed' | 'failed' | 'aborted';
      fileChanges?: Array<{ path: string; changeType: 'created' | 'modified' | 'deleted'; diff: string }>;
    }
  ): { id: string } | null {
    const database = (this.core as unknown as { database?: { agentTrace?: { append: (input: { sessionId: string; traceType: string; sourceType: string; summary: string; payload: Record<string, unknown>; parentTraceId?: string | null; spanId?: string; status?: 'running' | 'completed' | 'failed' | 'aborted'; fileChanges?: Array<{ path: string; changeType: 'created' | 'modified' | 'deleted'; diff: string }> }) => { id: string } } } }).database;
    return database?.agentTrace?.append({ sessionId, traceType, sourceType, summary, payload, ...options }) ?? null;
  }

  private getTraceSnapshotKey(sessionId: string, clientMessageId: string): string {
    return `${sessionId}:${clientMessageId}`;
  }

  private getRepositoryPath(sessionId: string): string | null {
    const database = (this.core as unknown as {
      database?: {
        sessions?: { getById: (sessionId: string) => { repoId: string } | null };
        repositories?: { getById: (repoId: string) => { path: string } | null };
      };
    }).database;
    const session = database?.sessions?.getById(sessionId) ?? null;
    if (!session) {
      return null;
    }
    return database?.repositories?.getById(session.repoId)?.path ?? null;
  }

  private captureGitSnapshot(repoPath: string): Map<string, string> {
    try {
      const output = execFileSync('git', ['-C', repoPath, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf-8' });
      const snapshot = new Map<string, string>();
      output.split(/\r?\n/).filter(Boolean).forEach((line) => {
        const trimmed = line.trimEnd();
        const path = trimmed.slice(3).trim();
        if (path) {
          snapshot.set(path, trimmed.slice(0, 2));
        }
      });
      return snapshot;
    } catch {
      return new Map();
    }
  }

  private collectGitFileChanges(repoPath: string, baseline: Map<string, string>): Array<{ path: string; changeType: 'created' | 'modified' | 'deleted'; diff: string }> {
    const current = this.captureGitSnapshot(repoPath);
    const changedPaths = Array.from(current.keys()).filter((path) => baseline.get(path) !== current.get(path));
    return changedPaths.map((path) => {
      const status = current.get(path) ?? ' M';
      let changeType: 'created' | 'modified' | 'deleted' = 'modified';
      if (status.includes('??') || status.includes('A')) {
        changeType = 'created';
      } else if (status.includes('D')) {
        changeType = 'deleted';
      }

      let diff = '';
      try {
        diff = execFileSync('git', ['-C', repoPath, 'diff', '--', path], { encoding: 'utf-8', maxBuffer: 1024 * 1024 }).slice(0, 4000);
      } catch {
        diff = '';
      }

      if (!diff.trim()) {
        diff = changeType === 'created' ? `# Created\n${path}` : changeType === 'deleted' ? `# Deleted\n${path}` : `# Modified\n${path}`;
      }

      return { path, changeType, diff };
    });
  }

  constructor(private readonly core: OkkCore) {}

  onConnection(socket: WebSocket, sessionId: string): void {
    socket.on("message", (raw) => {
      void this.handleRawMessage(socket, sessionId, raw.toString());
    });
  }

  private async handleRawMessage(socket: WebSocket, sessionId: string, rawMessage: string): Promise<void> {
    let message: QaClientMessage;
    try {
      message = parseQaClientMessage(rawMessage);
    } catch (error) {
      const event = this.eventStore.createEvent(sessionId, "qa.error", {
        reason: error instanceof Error ? error.message : "unknown_error",
      });
      sendJson(socket, event);
      return;
    }

    switch (message.action) {
      case "ask":
      case "follow_up":
        await this.handleAskOrFollowup(socket, sessionId, message);
        return;
      case "abort":
        await this.handleAbort(socket, sessionId, message.client_message_id);
        return;
      case "resume":
        await this.handleResume(socket, sessionId, message);
        return;
    }
  }

  private async handleAskOrFollowup(socket: WebSocket, sessionId: string, message: QaAskMessage): Promise<void> {
    const pendingKey = `${sessionId}:${message.client_message_id}`;
    const pending = this.pendingByMessage.get(pendingKey);
    if (pending) {
      await pending;
      const replay = this.eventStore.getIdempotentEvents(sessionId, message.client_message_id);
      if (replay) {
        for (const event of replay) {
          sendJson(socket, event);
        }
      }
      return;
    }

    const duplicatedEvents = this.eventStore.getIdempotentEvents(sessionId, message.client_message_id);
    if (duplicatedEvents) {
      for (const event of duplicatedEvents) {
        sendJson(socket, event);
      }
      return;
    }

    let resolvePending: (() => void) | undefined;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    this.pendingByMessage.set(pendingKey, pendingPromise);

    const emittedEvents: BackendEventEnvelope[] = [];
    let assistantContent = "";
    let knowledgeReferences: unknown[] = [];
    const teamId = `team-${sessionId}`;
    const memberId = `${message.backend}:${message.agent_name}`.toLowerCase();
    const taskId = `${teamId}:${memberId}:${message.client_message_id}`;
    const startedAt = new Date().toISOString();
    const appendAndSend = (type: string, payload: Record<string, unknown>) => {
      const event = this.eventStore.createEvent(sessionId, type, payload);
      emittedEvents.push(event);
      sendJson(socket, event);
    };
    const publishCapabilityStatus = (input: {
      capabilityId: string;
      capabilityName: string;
      sourceType: "skill" | "mcp";
      summary: string;
      route: string;
    }) => {
      this.core.team.publish({
        teamId,
        type: "capability_status",
        payload: {
          capability_id: input.capabilityId,
          capability_name: input.capabilityName,
          summary: input.summary,
          configured: true,
          ...buildRuntimeMeta({
            runId: `${taskId}:${input.sourceType}:${input.capabilityId}`,
            sourceType: input.sourceType,
            runtimeStatus: "ready",
            actions: [buildRouteAction(input.sourceType === "skill" ? "打开 Skills" : "打开 MCP 配置", input.route)]
          })
        }
      });
    };

    this.core.team.publish({
      teamId,
      type: "team_start",
      payload: {
        team_name: "Q&A Team",
        member_count: 1,
        ...buildRuntimeMeta({
          runId: taskId,
          sourceType: "team",
          runtimeStatus: "running"
        })
      }
    });
    this.core.team.publish({
      teamId,
      type: "team_member_add",
      payload: {
        member_id: memberId,
        agent_name: message.agent_name,
        status: "running",
        current_task: `${message.action}: ${summarize(message.content, 48)}`,
        backend: message.backend,
        started_at: startedAt,
        updated_at: startedAt,
        ...buildRuntimeMeta({
          runId: taskId,
          sourceType: "agent",
          runtimeStatus: "running"
        })
      }
    });
    this.core.team.publish({
      teamId,
      type: "team_task_update",
      payload: {
        task_id: taskId,
        title: `处理消息 ${message.client_message_id}`,
        status: "running",
        depends_on: [],
        owner_member_id: memberId,
        ...buildRuntimeMeta({
          runId: taskId,
          sourceType: "team",
          runtimeStatus: "running"
        })
      }
    });
    this.core.team.publish({
      teamId,
      type: "team_message",
      payload: {
        message_id: `${taskId}:start`,
        member_id: memberId,
        content: "开始处理请求",
        created_at: startedAt,
        ...buildRuntimeMeta({
          runId: taskId,
          sourceType: "agent",
          runtimeStatus: "running"
        })
      }
    });
    for (const skillId of message.skill_ids ?? []) {
      publishCapabilityStatus({
        capabilityId: skillId,
        capabilityName: skillId,
        sourceType: "skill",
        summary: `Skill ${skillId} 已加入当前请求`,
        route: "/skills"
      });
    }
    for (const serverId of message.mcp_server_ids ?? []) {
      publishCapabilityStatus({
        capabilityId: serverId,
        capabilityName: serverId,
        sourceType: "mcp",
        summary: `MCP ${serverId} 已加入当前请求`,
        route: "/settings/mcp"
      });
    }

    const traceSpanId = randomUUID();
    const traceSnapshotKey = this.getTraceSnapshotKey(sessionId, message.client_message_id);
    const repoPath = this.getRepositoryPath(sessionId);
    if (repoPath) {
      this.traceSnapshots.set(traceSnapshotKey, this.captureGitSnapshot(repoPath));
    }
    const requestTrace = this.appendTrace(sessionId, "request_started", "backend", `请求开始：${message.agent_name}`, { backend: message.backend, agentName: message.agent_name, clientMessageId: message.client_message_id }, { spanId: traceSpanId, status: "running" });
    appendAndSend("qa.accepted", {
      action: message.action,
      backend: message.backend,
      agent_name: message.agent_name,
      client_message_id: message.client_message_id,
    });

    const state = {
      aborted: false,
      messageId: message.client_message_id,
    };
    this.inflight.set(sessionId, state);

    try {
      let knowledgeReferences: Array<{
        id: string;
        title: string;
        summary: string;
        category: string;
        updatedAt: string;
        injectionKind: "background" | "related";
      }> = [];
      for await (const chunk of this.core.qa.streamAnswer({
        sessionId,
        action: message.action,
        backend: message.backend,
        agentName: message.agent_name,
        clientMessageId: message.client_message_id,
        content: message.content,
        skillIds: message.skill_ids,
        mcpServerIds: message.mcp_server_ids,
      })) {
        if (state.aborted) {
          break;
        }
        if (Array.isArray(chunk.knowledgeReferences)) {
          knowledgeReferences = chunk.knowledgeReferences;
        }
        if (!chunk.content) {
          continue;
        }
        assistantContent += chunk.content;
        this.appendTrace(sessionId, "text_chunk", "backend", "流式回复片段", { chunk: chunk.content.slice(0, 160) }, { parentTraceId: requestTrace?.id ?? null, spanId: traceSpanId, status: "running" });
        appendAndSend("qa.chunk", {
          backend: message.backend,
          agent_name: message.agent_name,
          client_message_id: message.client_message_id,
          chunk: chunk.content,
        });
      }

      if (state.aborted) {
        const fileChanges = repoPath ? this.collectGitFileChanges(repoPath, this.traceSnapshots.get(traceSnapshotKey) ?? new Map()) : [];
        this.appendTrace(sessionId, "request_aborted", "backend", "请求已中止", { clientMessageId: message.client_message_id, fileChangeCount: fileChanges.length }, { parentTraceId: requestTrace?.id ?? null, spanId: traceSpanId, status: "aborted", fileChanges });
        appendAndSend("qa.aborted", {
          client_message_id: message.client_message_id,
        });
        const updatedAt = new Date().toISOString();
        this.core.team.publish({
          teamId,
          type: "team_member_update",
          payload: {
            member_id: memberId,
            agent_name: message.agent_name,
            status: "error",
            current_task: "用户中止",
            backend: message.backend,
            started_at: startedAt,
            updated_at: updatedAt,
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "agent",
              runtimeStatus: "aborted",
              diagnostics: buildDiagnostics("请求已中止", { code: "qa_aborted", retryable: true }),
              actions: buildActions("retry", "copy_diagnostic")
            })
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_task_update",
          payload: {
            task_id: taskId,
            title: `处理消息 ${message.client_message_id}`,
            status: "error",
            depends_on: [],
            owner_member_id: memberId,
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "team",
              runtimeStatus: "aborted",
              diagnostics: buildDiagnostics("请求已中止", { code: "qa_aborted", retryable: true }),
              actions: buildActions("retry", "copy_diagnostic")
            })
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_end",
          payload: {
            status: "error",
            summary: "请求已中止",
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "team",
              runtimeStatus: "aborted",
              diagnostics: buildDiagnostics("请求已中止", { code: "qa_aborted", retryable: true }),
              actions: buildActions("retry", "copy_diagnostic")
            })
          }
        });
      } else {
        const fileChanges = repoPath ? this.collectGitFileChanges(repoPath, this.traceSnapshots.get(traceSnapshotKey) ?? new Map()) : [];
        this.appendTrace(sessionId, "request_completed", "backend", "请求处理完成", { clientMessageId: message.client_message_id, assistantSummary: assistantContent.slice(0, 200), fileChangeCount: fileChanges.length }, { parentTraceId: requestTrace?.id ?? null, spanId: traceSpanId, status: "completed", fileChanges });
        appendAndSend("qa.completed", {
          backend: message.backend,
          agent_name: message.agent_name,
          client_message_id: message.client_message_id,
          knowledgeReferences
        });
        const suggestion = this.createSuggestion(sessionId, message, assistantContent);
        if (suggestion) {
          appendAndSend("knowledge_suggestion", {
            suggestion: toSuggestionView(suggestion)
          });
        }
        const updatedAt = new Date().toISOString();
        this.core.team.publish({
          teamId,
          type: "team_member_update",
          payload: {
            member_id: memberId,
            agent_name: message.agent_name,
            status: "done",
            current_task: "处理完成",
            backend: message.backend,
            started_at: startedAt,
            updated_at: updatedAt,
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "agent",
              runtimeStatus: "completed"
            })
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_task_update",
          payload: {
            task_id: taskId,
            title: `处理消息 ${message.client_message_id}`,
            status: "done",
            depends_on: [],
            owner_member_id: memberId,
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "team",
              runtimeStatus: "completed"
            })
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_message",
          payload: {
            message_id: `${taskId}:done`,
            member_id: memberId,
            content: "请求处理完成",
            created_at: updatedAt,
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "agent",
              runtimeStatus: "completed"
            })
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_end",
          payload: {
            status: "done",
            summary: "请求处理完成",
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "team",
              runtimeStatus: "completed"
            })
          }
        });
      }
    } catch (error) {
      const fileChanges = repoPath ? this.collectGitFileChanges(repoPath, this.traceSnapshots.get(traceSnapshotKey) ?? new Map()) : [];
      this.appendTrace(sessionId, "request_failed", "backend", "请求处理失败", { clientMessageId: message.client_message_id, reason: error instanceof Error ? error.message : "unknown_error", fileChangeCount: fileChanges.length }, { parentTraceId: requestTrace?.id ?? null, spanId: traceSpanId, status: "failed", fileChanges });
      appendAndSend("qa.error", {
        client_message_id: message.client_message_id,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
      const errorMessage = error instanceof Error ? error.message : "unknown_error";
      const updatedAt = new Date().toISOString();
      this.core.team.publish({
        teamId,
        type: "team_member_update",
        payload: {
          member_id: memberId,
          agent_name: message.agent_name,
            status: "error",
            current_task: "执行失败",
            backend: message.backend,
            started_at: startedAt,
            updated_at: updatedAt,
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "agent",
              runtimeStatus: "failed",
              diagnostics: buildDiagnostics(errorMessage, { code: "qa_error", retryable: true }),
              actions: buildActions("retry", "copy_diagnostic")
            })
          }
        });
      this.core.team.publish({
        teamId,
        type: "team_task_update",
        payload: {
            task_id: taskId,
            title: `处理消息 ${message.client_message_id}`,
            status: "error",
            depends_on: [],
            owner_member_id: memberId,
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "team",
              runtimeStatus: "failed",
              diagnostics: buildDiagnostics(errorMessage, { code: "qa_error", retryable: true }),
              actions: buildActions("retry", "copy_diagnostic")
            })
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_end",
          payload: {
            status: "error",
            summary: "请求处理失败",
            ...buildRuntimeMeta({
              runId: taskId,
              sourceType: "team",
              runtimeStatus: "failed",
              diagnostics: buildDiagnostics(errorMessage, { code: "qa_error", retryable: true }),
              actions: buildActions("retry", "copy_diagnostic")
            })
          }
        });
    } finally {
      if (this.inflight.get(sessionId) === state) {
        this.inflight.delete(sessionId);
      }
      this.traceSnapshots.delete(traceSnapshotKey);
      this.eventStore.saveIdempotentEvents(sessionId, message.client_message_id, emittedEvents);
      this.pendingByMessage.delete(pendingKey);
      resolvePending?.();
    }
  }

  private async handleAbort(socket: WebSocket, sessionId: string, clientMessageId: string): Promise<void> {
    const inflight = this.inflight.get(sessionId);
    let aborted = false;
    const abortedMessageId = inflight?.messageId ?? clientMessageId;
    if (inflight) {
      inflight.aborted = true;
      aborted = true;
    }
    const coreAborted = await this.core.qa.abort(sessionId);
    const event = this.eventStore.createEvent(sessionId, aborted || coreAborted ? "qa.aborted" : "qa.abort_ignored", {
      client_message_id: abortedMessageId,
    });
    sendJson(socket, event);
  }

  private async handleResume(socket: WebSocket, sessionId: string, message: QaResumeMessage): Promise<void> {
    const lastEventId = message.last_event_id ?? 0;
    const replay = this.eventStore.eventsSince(sessionId, lastEventId);
    if (replay.length === 0) {
      const event = this.eventStore.createEvent(sessionId, "qa.resume_failed", {
        client_message_id: message.client_message_id,
        last_event_id: lastEventId,
        latest_event_id: this.eventStore.lastEventId(sessionId),
      });
      sendJson(socket, event);
      return;
    }

    for (const event of replay) {
      sendJson(socket, event);
    }

    const ack = this.eventStore.createEvent(sessionId, "qa.resume_ack", {
      client_message_id: message.client_message_id,
      replay_count: replay.length,
      last_event_id: lastEventId,
    });
    sendJson(socket, ack);
  }

  async saveSuggestion(
    sessionId: string,
    suggestionId: string,
    overrides?: {
      title?: string;
      content?: string;
      tags?: string[];
    }
  ): Promise<SuggestionView> {
    const suggestion = this.eventStore.getSuggestion(sessionId, suggestionId);
    if (!suggestion) {
      throw new Error("knowledge suggestion not found");
    }

    if (suggestion.status === "ignored") {
      throw new Error("knowledge suggestion already ignored");
    }

    if (suggestion.status !== "saved") {
      const nextTitle = overrides?.title?.trim() || suggestion.title;
      const nextContent = overrides?.content?.trim() || suggestion.content;
      const nextTags = normalizeSuggestionTags(overrides?.tags, suggestion.tags);
      const created = await this.core.knowledge.create({
        title: nextTitle,
        content: nextContent,
        tags: nextTags,
        category: suggestion.category,
        status: "draft"
      });

      this.eventStore.saveSuggestion(sessionId, {
        ...suggestion,
        title: nextTitle,
        summary: summarize(nextContent),
        content: nextContent,
        tags: nextTags,
        knowledgeEntryId: created.id,
        status: "saved"
      });
    }

    const updated = this.eventStore.updateSuggestionStatus(sessionId, suggestionId, "saved");
    if (!updated) {
      throw new Error("knowledge suggestion update failed");
    }

    return toSuggestionView(updated);
  }

  ignoreSuggestion(sessionId: string, suggestionId: string): SuggestionView {
    const suggestion = this.eventStore.getSuggestion(sessionId, suggestionId);
    if (!suggestion) {
      throw new Error("knowledge suggestion not found");
    }

    const updated = this.eventStore.updateSuggestionStatus(sessionId, suggestionId, "ignored");
    if (!updated) {
      throw new Error("knowledge suggestion update failed");
    }
    return toSuggestionView(updated);
  }

  private createSuggestion(
    sessionId: string,
    message: QaAskMessage,
    assistantContent: string
  ): KnowledgeSuggestionSnapshot | null {
    const answer = assistantContent.trim();
    if (!answer) {
      return null;
    }

    const normalizedQuestion = message.content.trim();
    const firstLine = normalizedQuestion.split("\n")[0] ?? "对话知识";
    const title = summarize(firstLine, 64) || "对话知识";
    const suggestion: KnowledgeSuggestionSnapshot = {
      id: `ks-${randomUUID()}`,
      title,
      summary: summarize(answer),
      category: "general",
      tags: ["qa", message.agent_name].filter(Boolean),
      content: buildSuggestionContent(normalizedQuestion, answer),
      knowledgeEntryId: null,
      status: "pending",
      createdAt: new Date().toISOString(),
      sourceMessageId: message.client_message_id
    };

    return this.eventStore.saveSuggestion(sessionId, suggestion);
  }
}
