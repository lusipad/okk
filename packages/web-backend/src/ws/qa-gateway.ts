import type { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import type { OkclawCore } from "../core/types.js";
import type { BackendEventEnvelope, QaAskMessage, QaClientMessage, QaResumeMessage } from "../types/contracts.js";
import { parseQaClientMessage } from "../types/contracts.js";
import { QaEventStore, type KnowledgeSuggestionSnapshot } from "./qa-event-store.js";

function sendJson(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== socket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

type SuggestionView = Omit<KnowledgeSuggestionSnapshot, "content" | "sourceMessageId" | "createdAt">;

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
    status: input.status
  };
}

export class QaGateway {
  private readonly eventStore = new QaEventStore();

  private readonly inflight = new Map<string, { aborted: boolean; messageId: string }>();

  private readonly pendingByMessage = new Map<string, Promise<void>>();

  constructor(private readonly core: OkclawCore) {}

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
    const teamId = `team-${sessionId}`;
    const memberId = `${message.backend}:${message.agent_name}`.toLowerCase();
    const taskId = `${teamId}:${memberId}:${message.client_message_id}`;
    const startedAt = new Date().toISOString();
    const appendAndSend = (type: string, payload: Record<string, unknown>) => {
      const event = this.eventStore.createEvent(sessionId, type, payload);
      emittedEvents.push(event);
      sendJson(socket, event);
    };

    this.core.team.publish({
      teamId,
      type: "team_start",
      payload: {
        team_name: "Q&A Team",
        member_count: 1
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
        updated_at: startedAt
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
        owner_member_id: memberId
      }
    });
    this.core.team.publish({
      teamId,
      type: "team_message",
      payload: {
        message_id: `${taskId}:start`,
        member_id: memberId,
        content: "开始处理请求",
        created_at: startedAt
      }
    });

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
        assistantContent += chunk.content;
        appendAndSend("qa.chunk", {
          backend: message.backend,
          agent_name: message.agent_name,
          client_message_id: message.client_message_id,
          chunk: chunk.content,
        });
      }

      if (state.aborted) {
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
            updated_at: updatedAt
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
            owner_member_id: memberId
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_end",
          payload: {
            status: "error",
            summary: "请求已中止"
          }
        });
      } else {
        appendAndSend("qa.completed", {
          backend: message.backend,
          agent_name: message.agent_name,
          client_message_id: message.client_message_id,
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
            updated_at: updatedAt
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
            owner_member_id: memberId
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_message",
          payload: {
            message_id: `${taskId}:done`,
            member_id: memberId,
            content: "请求处理完成",
            created_at: updatedAt
          }
        });
        this.core.team.publish({
          teamId,
          type: "team_end",
          payload: {
            status: "done",
            summary: "请求处理完成"
          }
        });
      }
    } catch (error) {
      appendAndSend("qa.error", {
        client_message_id: message.client_message_id,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
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
          updated_at: updatedAt
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
          owner_member_id: memberId
        }
      });
      this.core.team.publish({
        teamId,
        type: "team_end",
        payload: {
          status: "error",
          summary: "请求处理失败"
        }
      });
    } finally {
      if (this.inflight.get(sessionId) === state) {
        this.inflight.delete(sessionId);
      }
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

  async saveSuggestion(sessionId: string, suggestionId: string): Promise<SuggestionView> {
    const suggestion = this.eventStore.getSuggestion(sessionId, suggestionId);
    if (!suggestion) {
      throw new Error("knowledge suggestion not found");
    }

    if (suggestion.status === "ignored") {
      throw new Error("knowledge suggestion already ignored");
    }

    if (suggestion.status !== "saved") {
      await this.core.knowledge.create({
        title: suggestion.title,
        content: suggestion.content,
        tags: suggestion.tags,
        category: suggestion.category,
        status: "draft"
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
      status: "pending",
      createdAt: new Date().toISOString(),
      sourceMessageId: message.client_message_id
    };

    return this.eventStore.saveSuggestion(sessionId, suggestion);
  }
}
