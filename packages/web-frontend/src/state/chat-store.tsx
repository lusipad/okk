import { createContext, useContext, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type {
  AgentInfo,
  ChatMessage,
  CollaborationAction,
  CollaborationDiagnostics,
  CollaborationRunStatus,
  CollaborationSourceType,
  KnowledgeSuggestion,
  SessionInfo,
  SessionRuntimeState,
  TeamMemberStatus,
  TeamPanelState,
  ToolCall
} from '../types/domain';
import type {
  KnowledgeSuggestionPayload,
  MessageAbortedPayload,
  MessageChunkPayload,
  MessageDonePayload,
  MessageErrorPayload,
  MessageStartedPayload,
  SessionAbortIgnoredPayload,
  SessionEventEnvelope,
  SessionResumeFailedPayload,
  SessionResumedPayload,
  TeamWsEvent,
  ToolCallPayload,
  WsConnectionState
} from '../io/types';

interface ChatState {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  agents: AgentInfo[];
  selectedAgentId: string | null;
  selectedSkillIds: string[];
  selectedMcpServerIds: string[];
  connectionState: WsConnectionState;
  messagesBySession: Record<string, ChatMessage[]>;
  suggestionsBySession: Record<string, KnowledgeSuggestion[]>;
  teamViewBySession: Record<string, TeamPanelState>;
  runtimeStateBySession: Record<string, SessionRuntimeState>;
  lastEventIdBySession: Record<string, number>;
  seenEventIdsBySession: Record<string, number[]>;
}

type ChatAction =
  | { type: 'set_sessions'; sessions: SessionInfo[] }
  | { type: 'upsert_session'; session: SessionInfo }
  | { type: 'set_current_session'; sessionId: string }
  | { type: 'set_agents'; agents: AgentInfo[] }
  | { type: 'set_selected_agent'; agentId: string | null }
  | { type: 'set_selected_skills'; skillIds: string[] }
  | { type: 'set_selected_mcp_servers'; serverIds: string[] }
  | { type: 'set_connection_state'; sessionId?: string | null; state: WsConnectionState }
  | {
      type: 'append_user_message';
      sessionId: string;
      message: ChatMessage;
    }
  | { type: 'apply_event'; event: SessionEventEnvelope }
  | { type: 'apply_team_event'; sessionId: string; event: TeamWsEvent }
  | {
      type: 'update_suggestion_status';
      sessionId: string;
      suggestionId: string;
      status: KnowledgeSuggestion['status'];
    };

interface ChatStoreContextValue {
  state: ChatState;
  dispatch: Dispatch<ChatAction>;
}

const MAX_SEEN_EVENT_IDS = 500;

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  agents: [],
  selectedAgentId: null,
  selectedSkillIds: [],
  selectedMcpServerIds: [],
  connectionState: 'disconnected',
  messagesBySession: {},
  suggestionsBySession: {},
  teamViewBySession: {},
  runtimeStateBySession: {},
  lastEventIdBySession: {},
  seenEventIdsBySession: {}
};


function createRuntimeState(input: Partial<SessionRuntimeState> = {}): SessionRuntimeState {
  return {
    phase: input.phase ?? 'idle',
    ...(input.message ? { message: input.message } : {}),
    ...(input.diagnostics ? { diagnostics: input.diagnostics } : {}),
    ...(input.retryable !== undefined ? { retryable: input.retryable } : {}),
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

function toRuntimeStateForConnection(
  current: SessionRuntimeState | undefined,
  state: WsConnectionState
): SessionRuntimeState | undefined {
  if (state === 'reconnecting') {
    return createRuntimeState({
      phase: 'recovering',
      message: '连接断开，正在恢复事件流…',
      diagnostics: {
        code: 'ws_reconnecting',
        message: '连接断开，正在恢复事件流…',
        retryable: true,
        severity: 'warning'
      },
      retryable: true
    });
  }

  if (state === 'connected' && current?.phase === 'recovering') {
    return createRuntimeState({
      phase: 'recovering',
      message: '已重新连接，正在等待恢复确认…',
      diagnostics: {
        code: 'ws_connected_wait_resume',
        message: '已重新连接，正在等待恢复确认…',
        retryable: true,
        severity: 'info'
      },
      retryable: true
    });
  }

  if (state === 'disconnected' && (current?.phase === 'streaming' || current?.phase === 'sending' || current?.phase === 'recovering')) {
    return createRuntimeState({
      phase: 'error',
      message: '连接已断开，当前会话未完成。',
      diagnostics: {
        code: 'ws_disconnected',
        message: '连接已断开，当前会话未完成。',
        retryable: true,
        severity: 'error'
      },
      retryable: true
    });
  }

  return current;
}
function updateMessageById(
  messages: ChatMessage[],
  messageId: string,
  updater: (current: ChatMessage) => ChatMessage
): ChatMessage[] {
  let matched = false;
  const next = messages.map((item) => {
    if (item.id !== messageId) {
      return item;
    }
    matched = true;
    return updater(item);
  });
  return matched ? next : messages;
}

function ensureAssistantMessage(messages: ChatMessage[], messageId: string): ChatMessage[] {
  if (messages.some((item) => item.id === messageId)) {
    return messages;
  }
  return [
    ...messages,
    {
      id: messageId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: new Date().toISOString(),
      toolCalls: []
    }
  ];
}

function upsertToolCall(toolCalls: ToolCall[], input: ToolCall): ToolCall[] {
  const index = toolCalls.findIndex((item) => item.id === input.id);
  if (index < 0) {
    return [...toolCalls, input];
  }
  const merged = {
    ...toolCalls[index],
    ...input
  };
  return [...toolCalls.slice(0, index), merged, ...toolCalls.slice(index + 1)];
}

function addSeenEventIds(list: number[], eventId: number): number[] {
  if (list.includes(eventId)) {
    return list;
  }
  const next = [...list, eventId];
  if (next.length <= MAX_SEEN_EVENT_IDS) {
    return next;
  }
  return next.slice(next.length - MAX_SEEN_EVENT_IDS);
}

function createEmptyTeamPanel(): TeamPanelState {
  return {
    teamName: null,
    status: 'idle',
    members: [],
    tasks: [],
    messages: [],
    eventFeed: []
  };
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toTeamStatus(value: unknown): TeamPanelState['status'] {
  if (value === 'running' || value === 'done' || value === 'error') {
    return value;
  }
  return 'idle';
}

function toMemberStatus(value: unknown): TeamMemberStatus {
  if (value === 'pending' || value === 'running' || value === 'done' || value === 'error') {
    return value;
  }
  return 'pending';
}

function toSourceType(value: unknown): CollaborationSourceType | undefined {
  return value === 'team' || value === 'agent' || value === 'skill' || value === 'mcp' || value === 'backend' || value === 'tool'
    ? value
    : undefined;
}

function toRunStatus(value: unknown): CollaborationRunStatus | undefined {
  return value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'aborted' ||
    value === 'ready' ||
    value === 'unavailable'
    ? value
    : undefined;
}

function toSeverity(value: unknown): CollaborationDiagnostics['severity'] | undefined {
  return value === 'info' || value === 'warning' || value === 'error' ? value : undefined;
}

function toDiagnostics(value: unknown): CollaborationDiagnostics | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const diagnostics = value as Record<string, unknown>;
  const message = toText(diagnostics.message) || toText(diagnostics.reason) || toText(diagnostics.detail);
  if (!message) {
    return undefined;
  }

  return {
    code: toText(diagnostics.code) || undefined,
    message,
    detail: toText(diagnostics.detail) || undefined,
    retryable: typeof diagnostics.retryable === 'boolean' ? diagnostics.retryable : undefined,
    severity: toSeverity(diagnostics.severity)
  };
}

function toActions(value: unknown): CollaborationAction[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const actions = value
    .map((item): CollaborationAction | null => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const action = item as Record<string, unknown>;
      const kind = action.kind;
      if (kind !== 'retry' && kind !== 'refresh' && kind !== 'copy_diagnostic' && kind !== 'open_route') {
        return null;
      }

      const label =
        toText(action.label) ||
        (kind === 'retry'
          ? '重试消息'
          : kind === 'refresh'
            ? '刷新状态'
            : kind === 'open_route'
              ? '打开配置'
              : '复制诊断');
      const route = toText(action.route) || undefined;

      return route ? { kind, label, route } : { kind, label };
    })
    .filter((item): item is CollaborationAction => item !== null);

  return actions.length > 0 ? actions : undefined;
}

function deriveEventStatus(event: TeamWsEvent, payload: Record<string, unknown>): CollaborationRunStatus | undefined {
  const explicit = toRunStatus(payload.runtime_status);
  if (explicit) {
    return explicit;
  }

  if (event.type === 'team_start' || event.type === 'team_message') {
    return 'running';
  }
  if (event.type === 'capability_status') {
    return 'ready';
  }
  if (event.type === 'team_member_add' || event.type === 'team_member_update' || event.type === 'team_task_update') {
    const status = toMemberStatus(payload.status);
    return status === 'done' ? 'completed' : status === 'error' ? 'failed' : status === 'running' ? 'running' : 'queued';
  }
  if (event.type === 'team_end') {
    return payload.status === 'done' ? 'completed' : 'failed';
  }
  return undefined;
}

function deriveSourceType(event: TeamWsEvent, payload: Record<string, unknown>): CollaborationSourceType | undefined {
  const explicit = toSourceType(payload.source_type);
  if (explicit) {
    return explicit;
  }
  if (event.type === 'team_member_add' || event.type === 'team_member_update' || event.type === 'team_message') {
    return 'agent';
  }
  if (event.type === 'capability_status') {
    return toSourceType(payload.source_type) ?? 'tool';
  }
  return 'team';
}

function describeTeamEvent(event: TeamWsEvent, payload: Record<string, unknown>): string {
  if (event.type === 'team_start') {
    return `团队启动：${toText(payload.team_name) || '未命名团队'}`;
  }
  if (event.type === 'team_member_add' || event.type === 'team_member_update') {
    return `${toText(payload.agent_name) || '成员'} · ${toMemberStatus(payload.status)}`;
  }
  if (event.type === 'team_task_update') {
    return `任务：${toText(payload.title) || toText(payload.task_id)}`;
  }
  if (event.type === 'team_message') {
    return toText(payload.content) || '成员消息';
  }
  if (event.type === 'capability_status') {
    return toText(payload.summary) || toText(payload.capability_name) || '能力状态更新';
  }
  if (event.type === 'team_end') {
    return `团队结束：${toTeamStatus(payload.status)}`;
  }
  return event.type;
}

function upsertById<T extends { [key in K]: string }, K extends string>(
  list: T[],
  idKey: K,
  item: T
): T[] {
  const index = list.findIndex((candidate) => candidate[idKey] === item[idKey]);
  if (index < 0) {
    return [...list, item];
  }
  return [...list.slice(0, index), item, ...list.slice(index + 1)];
}

function applyTeamEvent(panel: TeamPanelState, event: TeamWsEvent): TeamPanelState {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const diagnostics = toDiagnostics(payload.diagnostics);
  const eventFeed = [
    ...panel.eventFeed,
    {
      id: `${event.teamId}:${event.event_id}`,
      type: event.type,
      createdAt: event.timestamp,
      summary: describeTeamEvent(event, payload),
      runId: toText(payload.run_id) || event.teamId,
      sourceType: deriveSourceType(event, payload),
      status: deriveEventStatus(event, payload),
      diagnostics,
      actions: toActions(payload.actions)
    }
  ].slice(-200);

  if (event.type === 'team_start') {
    return {
      ...panel,
      teamName: toText(payload.team_name) || panel.teamName,
      status: 'running',
      eventFeed
    };
  }

  if (event.type === 'team_member_add' || event.type === 'team_member_update') {
    const member = {
      memberId: toText(payload.member_id),
      agentName: toText(payload.agent_name),
      backend: toText(payload.backend),
      status: toMemberStatus(payload.status),
      currentTask: toText(payload.current_task) || undefined,
      startedAt: toText(payload.started_at) || undefined,
      updatedAt: toText(payload.updated_at) || event.timestamp
    };

    return {
      ...panel,
      members: upsertById(panel.members, 'memberId', member),
      status: panel.status === 'idle' ? 'running' : panel.status,
      eventFeed
    };
  }

  if (event.type === 'team_task_update') {
    const task = {
      taskId: toText(payload.task_id),
      title: toText(payload.title),
      status: toMemberStatus(payload.status),
      dependsOn: Array.isArray(payload.depends_on) ? payload.depends_on.map((item) => toText(item)).filter(Boolean) : [],
      ownerMemberId: toText(payload.owner_member_id) || undefined
    };

    return {
      ...panel,
      tasks: upsertById(panel.tasks, 'taskId', task),
      status: panel.status === 'idle' ? 'running' : panel.status,
      eventFeed
    };
  }

  if (event.type === 'team_message') {
    const message = {
      id: toText(payload.message_id) || `${event.teamId}:${event.event_id}:msg`,
      memberId: toText(payload.member_id),
      content: toText(payload.content),
      createdAt: toText(payload.created_at) || event.timestamp
    };

    return {
      ...panel,
      messages: [...panel.messages, message].slice(-200),
      status: panel.status === 'idle' ? 'running' : panel.status,
      eventFeed
    };
  }

  if (event.type === 'team_end') {
    return {
      ...panel,
      status: toTeamStatus(payload.status),
      eventFeed
    };
  }

  return {
    ...panel,
    eventFeed
  };
}

function applySessionEvent(state: ChatState, event: SessionEventEnvelope): ChatState {
  const sessionId = event.sessionId;
  const seen = state.seenEventIdsBySession[sessionId] ?? [];

  if (seen.includes(event.event_id)) {
    return state;
  }

  const currentLastEventId = state.lastEventIdBySession[sessionId] ?? 0;
  if (event.event_id <= currentLastEventId) {
    return state;
  }

  const sessionMessages = state.messagesBySession[sessionId] ?? [];
  let nextMessages = [...sessionMessages];
  let nextSuggestions = state.suggestionsBySession[sessionId] ?? [];

  if (event.type === 'message_started') {
    const payload = event.payload as unknown as MessageStartedPayload;
    nextMessages = ensureAssistantMessage(nextMessages, payload.messageId);
  } else if (event.type === 'message_chunk') {
    const payload = event.payload as unknown as MessageChunkPayload;
    nextMessages = ensureAssistantMessage(nextMessages, payload.messageId);
    nextMessages = updateMessageById(nextMessages, payload.messageId, (item) => ({
      ...item,
      status: 'streaming',
      content: `${item.content}${payload.chunk}`
    }));
  } else if (event.type === 'message_done') {
    const payload = event.payload as unknown as MessageDonePayload;
    nextMessages = updateMessageById(nextMessages, payload.messageId, (item) => ({
      ...item,
      status: 'done'
    }));
  } else if (event.type === 'message_aborted') {
    const payload = event.payload as unknown as MessageAbortedPayload;
    nextMessages = updateMessageById(nextMessages, payload.messageId, (item) => ({
      ...item,
      status: 'aborted'
    }));
  } else if (event.type === 'message_error') {
    const payload = event.payload as unknown as MessageErrorPayload;
    nextMessages = updateMessageById(nextMessages, payload.messageId, (item) => ({
      ...item,
      status: 'error',
      error: payload.error
    }));
  } else if (event.type === 'tool_call') {
    const payload = event.payload as unknown as ToolCallPayload;
    nextMessages = updateMessageById(nextMessages, payload.messageId, (item) => ({
      ...item,
      toolCalls: upsertToolCall(item.toolCalls, payload.toolCall)
    }));
  } else if (event.type === 'knowledge_suggestion') {
    const payload = event.payload as unknown as KnowledgeSuggestionPayload;
    if (!nextSuggestions.some((item) => item.id === payload.suggestion.id)) {
      nextSuggestions = [...nextSuggestions, payload.suggestion];
    }
  }

  return {
    ...state,
    messagesBySession: {
      ...state.messagesBySession,
      [sessionId]: nextMessages
    },
    suggestionsBySession: {
      ...state.suggestionsBySession,
      [sessionId]: nextSuggestions
    },
    lastEventIdBySession: {
      ...state.lastEventIdBySession,
      [sessionId]: event.event_id
    },
    seenEventIdsBySession: {
      ...state.seenEventIdsBySession,
      [sessionId]: addSeenEventIds(seen, event.event_id)
    }
  };
}

function reducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === 'set_sessions') {
    const currentSessionId =
      state.currentSessionId && action.sessions.some((item) => item.id === state.currentSessionId)
        ? state.currentSessionId
        : action.sessions[0]?.id ?? null;
    return {
      ...state,
      sessions: action.sessions,
      currentSessionId
    };
  }

  if (action.type === 'upsert_session') {
    const exists = state.sessions.some((item) => item.id === action.session.id);
    const sessions = exists
      ? state.sessions.map((item) => (item.id === action.session.id ? action.session : item))
      : [action.session, ...state.sessions];
    return {
      ...state,
      sessions,
      currentSessionId: state.currentSessionId ?? action.session.id
    };
  }

  if (action.type === 'set_current_session') {
    return {
      ...state,
      currentSessionId: action.sessionId
    };
  }

  if (action.type === 'set_agents') {
    const currentSelectedId =
      state.selectedAgentId && action.agents.some((agent) => agent.id === state.selectedAgentId)
        ? state.selectedAgentId
        : null;
    const preferredCodexId = action.agents.find((agent) => agent.backend === 'codex')?.id ?? null;
    const selectedAgentId = currentSelectedId ?? preferredCodexId ?? action.agents[0]?.id ?? null;
    return {
      ...state,
      agents: action.agents,
      selectedAgentId
    };
  }

  if (action.type === 'set_selected_agent') {
    return {
      ...state,
      selectedAgentId: action.agentId
    };
  }

  if (action.type === 'set_selected_skills') {
    return {
      ...state,
      selectedSkillIds: Array.from(new Set(action.skillIds))
    };
  }

  if (action.type === 'set_selected_mcp_servers') {
    return {
      ...state,
      selectedMcpServerIds: Array.from(new Set(action.serverIds))
    };
  }

  if (action.type === 'set_connection_state') {
    const sessionId = action.sessionId ?? state.currentSessionId;
    const runtimeState = sessionId
      ? toRuntimeStateForConnection(state.runtimeStateBySession[sessionId], action.state)
      : undefined;

    return {
      ...state,
      connectionState: action.state,
      runtimeStateBySession:
        sessionId && runtimeState
          ? {
              ...state.runtimeStateBySession,
              [sessionId]: runtimeState
            }
          : state.runtimeStateBySession
    };
  }

  if (action.type === 'append_user_message') {
    const current = state.messagesBySession[action.sessionId] ?? [];
    return {
      ...state,
      messagesBySession: {
        ...state.messagesBySession,
        [action.sessionId]: [...current, action.message]
      }
    };
  }

  if (action.type === 'apply_event') {
    return applySessionEvent(state, action.event);
  }

  if (action.type === 'apply_team_event') {
    const current = state.teamViewBySession[action.sessionId] ?? createEmptyTeamPanel();
    return {
      ...state,
      teamViewBySession: {
        ...state.teamViewBySession,
        [action.sessionId]: applyTeamEvent(current, action.event)
      }
    };
  }

  if (action.type === 'update_suggestion_status') {
    const current = state.suggestionsBySession[action.sessionId] ?? [];
    return {
      ...state,
      suggestionsBySession: {
        ...state.suggestionsBySession,
        [action.sessionId]: current.map((item) =>
          item.id === action.suggestionId
            ? {
                ...item,
                status: action.status
              }
            : item
        )
      }
    };
  }

  return state;
}

const ChatStoreContext = createContext<ChatStoreContextValue | undefined>(undefined);

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <ChatStoreContext.Provider value={value}>{children}</ChatStoreContext.Provider>;
}

export function useChatStore(): ChatStoreContextValue {
  const value = useContext(ChatStoreContext);
  if (!value) {
    throw new Error('useChatStore must be used within ChatStoreProvider');
  }
  return value;
}



