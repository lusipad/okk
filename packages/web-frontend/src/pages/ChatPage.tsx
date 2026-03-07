import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import { createClientId } from '../utils/id';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import { ShellLayout } from '../components/layout/ShellLayout';
import { ConnectionBanner } from '../components/common/ConnectionBanner';
import { MessageList } from '../components/chat/MessageList';
import { Composer } from '../components/chat/Composer';
import type { ChatMessage, TeamPanelState } from '../types/domain';
import type { RuntimeBackendHealth, TeamRunRecord } from '../io/types';

interface SelectableSkill {
  id: string;
  name: string;
}

interface SelectableMcpServer {
  id: string;
  name: string;
}

interface CapabilitySnapshot {
  loading: boolean;
  skillsInstalled: number;
  skillsTotal: number;
  mcpEnabled: number;
  mcpTotal: number;
  runtimeBackends: RuntimeBackendHealth[];
  availableSkills: SelectableSkill[];
  availableMcpServers: SelectableMcpServer[];
}

interface DesktopFilesBridge {
  files?: {
    onDropped?: (listener: (paths: string[]) => void) => (() => void) | void;
  };
}

interface DesktopFileSelectionDetail {
  paths?: string[];
}

interface ComposerExternalDraft {
  id: string;
  text: string;
}

const DESKTOP_FILES_SELECTED_EVENT = 'okk:desktop-files-selected';

function buildDesktopDraft(paths: string[]): string {
  const normalized = paths.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return '';
  }
  return `请基于以下本地路径继续协作，并说明下一步操作：\n${normalized.map((item) => `- ${item}`).join('\n')}`;
}

const initialCapabilitySnapshot: CapabilitySnapshot = {
  loading: true,
  skillsInstalled: 0,
  skillsTotal: 0,
  mcpEnabled: 0,
  mcpTotal: 0,
  runtimeBackends: [],
  availableSkills: [],
  availableMcpServers: []
};

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

async function ensureCurrentSession(
  currentSessionId: string | null,
  createSession: () => Promise<{ id: string; title: string; updatedAt: string }>,
  onCreated: (session: { id: string; title: string; updatedAt: string }) => void
): Promise<string> {
  if (currentSessionId) {
    return currentSessionId;
  }
  const session = await createSession();
  onCreated(session);
  return session.id;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export function ChatPage() {
  const navigate = useNavigate();
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [error, setError] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [capabilitySnapshot, setCapabilitySnapshot] = useState<CapabilitySnapshot>(initialCapabilitySnapshot);
  const [teamRunError, setTeamRunError] = useState<string | null>(null);
  const [teamRunPending, setTeamRunPending] = useState(false);
  const [teamRuns, setTeamRuns] = useState<TeamRunRecord[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [composerExternalDraft, setComposerExternalDraft] = useState<ComposerExternalDraft | null>(null);

  const currentSessionId = state.currentSessionId;
  const messages = state.messagesBySession[currentSessionId ?? ''] ?? [];
  const suggestions = state.suggestionsBySession[currentSessionId ?? ''] ?? [];
  const teamView = state.teamViewBySession[currentSessionId ?? ''] ?? EMPTY_TEAM_VIEW;
  const runtimeState = state.runtimeStateBySession[currentSessionId ?? ''] ?? null;
  const isStreaming = useMemo(
    () => messages.some((item) => item.role === 'assistant' && item.status === 'streaming'),
    [messages]
  );
  const canRetry = useMemo(() => messages.some((item) => item.role === 'user'), [messages]);
  const selectedAgent = useMemo(
    () => state.agents.find((agent) => agent.id === state.selectedAgentId) ?? null,
    [state.agents, state.selectedAgentId]
  );
  const selectedAgentName = useMemo(() => selectedAgent?.name ?? '未选择 Agent', [selectedAgent]);
  const latestAssistantError = useMemo(
    () => [...messages].reverse().find((item) => item.role === 'assistant' && item.status === 'error') ?? null,
    [messages]
  );
  const selectedSkillIds = useMemo(() => {
    const available = new Set(capabilitySnapshot.availableSkills.map((item) => item.id));
    return state.selectedSkillIds.filter((item) => available.has(item));
  }, [capabilitySnapshot.availableSkills, state.selectedSkillIds]);
  const selectedMcpServerIds = useMemo(() => {
    const available = new Set(capabilitySnapshot.availableMcpServers.map((item) => item.id));
    return state.selectedMcpServerIds.filter((item) => available.has(item));
  }, [capabilitySnapshot.availableMcpServers, state.selectedMcpServerIds]);
  const activeTeamRun = useMemo(() => {
    if (activeRunId) {
      const matched = teamRuns.find((item) => item.id === activeRunId);
      if (matched) {
        return matched;
      }
    }
    return teamRuns[0] ?? null;
  }, [activeRunId, teamRuns]);
  const selectedBackendHealth = useMemo(() => {
    if (!selectedAgent?.backend) {
      return null;
    }
    return capabilitySnapshot.runtimeBackends.find((item) => item.backend === selectedAgent.backend) ?? null;
  }, [capabilitySnapshot.runtimeBackends, selectedAgent?.backend]);
  const sendBlockedReason = useMemo(() => {
    if (!selectedAgent?.backend || !selectedBackendHealth || selectedBackendHealth.available) {
      return null;
    }
    const detail = selectedBackendHealth.diagnostics?.message || selectedBackendHealth.reason || '请先修复桌面运行时或 CLI 环境。';
    return `${selectedAgent.backend} 当前不可用：${detail}`;
  }, [selectedAgent?.backend, selectedBackendHealth]);

  const loadBootstrap = useCallback(async (): Promise<void> => {
    setBootstrapLoading(true);
    setBootstrapError(null);
    try {
      const [sessions, agents] = await Promise.all([io.listSessions(), io.listAgents()]);
      dispatch({ type: 'set_sessions', sessions });
      dispatch({ type: 'set_agents', agents });
    } catch (incoming) {
      setBootstrapError(toErrorMessage(incoming, '基础数据加载失败，请稍后重试。'));
    } finally {
      setBootstrapLoading(false);
    }
  }, [dispatch, io]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const loadCapabilities = useCallback(async (): Promise<void> => {
    setCapabilitySnapshot((prev) => ({
      ...prev,
      loading: true
    }));
    setCapabilityError(null);
    const [skillsResult, mcpResult, runtimeResult] = await Promise.allSettled([
      io.listSkills(),
      io.listMcpServers(),
      io.listRuntimeBackends()
    ]);

    const skills = skillsResult.status === 'fulfilled' ? skillsResult.value : [];
    const mcpServers = mcpResult.status === 'fulfilled' ? mcpResult.value : [];
    const runtimeBackends = runtimeResult.status === 'fulfilled' ? runtimeResult.value : [];
    const availableSkills = skills
      .filter((item) => item.installed)
      .map((item) => ({ id: item.id, name: item.name }));
    const availableMcpServers = mcpServers
      .filter((item) => item.enabled)
      .map((item) => ({ id: item.id, name: item.name }));

    if (skillsResult.status === 'rejected' || mcpResult.status === 'rejected' || runtimeResult.status === 'rejected') {
      setCapabilityError('Skills/MCP/运行时能力列表加载不完整，可稍后重试刷新。');
    }

    setCapabilitySnapshot({
      loading: false,
      skillsInstalled: skills.filter((item) => item.installed).length,
      skillsTotal: skills.length,
      mcpEnabled: mcpServers.filter((item) => item.enabled).length,
      mcpTotal: mcpServers.length,
      runtimeBackends,
      availableSkills,
      availableMcpServers
    });
  }, [io]);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  const loadTeamRuns = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        setTeamRunError(null);
        const items = await io.listTeamRuns(sessionId);
        setTeamRuns(items);
        if (items.length > 0) {
          setActiveRunId((current) => current ?? items[0].id);
        } else {
          setActiveRunId(null);
        }
      } catch (incoming) {
        setTeamRunError(toErrorMessage(incoming, '加载团队运行记录失败'));
      }
    },
    [io]
  );

  useEffect(() => {
    if (!currentSessionId) {
      setTeamRuns([]);
      setActiveRunId(null);
      return;
    }
    void loadTeamRuns(currentSessionId);
  }, [currentSessionId, loadTeamRuns]);

  useEffect(() => {
    const applyDesktopPaths = (paths: string[]): void => {
      const nextValue = buildDesktopDraft(paths);
      if (!nextValue) {
        return;
      }
      setComposerExternalDraft({
        id: `${Date.now()}`,
        text: nextValue
      });
    };

    const desktopBridge = (window as Window & { okkDesktop?: DesktopFilesBridge }).okkDesktop;
    const subscribe = desktopBridge?.files?.onDropped;
    const unsubscribe = subscribe?.((paths) => {
      applyDesktopPaths(paths);
    });

    const handleDesktopSelection = (event: Event): void => {
      const detail = (event as CustomEvent<DesktopFileSelectionDetail>).detail;
      applyDesktopPaths(detail?.paths ?? []);
    };

    window.addEventListener('okk:desktop-files-selected', handleDesktopSelection);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      window.removeEventListener('okk:desktop-files-selected', handleDesktopSelection);
    };
  }, []);

  useEffect(() => {
    if (!activeTeamRun || activeTeamRun.status !== 'running') {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const latest = await io.getTeamRun(activeTeamRun.id);
        if (!latest) {
          return;
        }
        setTeamRuns((current) => {
          const index = current.findIndex((item) => item.id === latest.id);
          if (index < 0) {
            return [latest, ...current];
          }
          const next = [...current];
          next[index] = latest;
          return next;
        });
      } catch {
        // keep polling and expose errors through manual refresh instead
      }
    }, 1200);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeTeamRun, io]);

  useEffect(() => {
    if (!currentSessionId) {
      return undefined;
    }

    const resumeFromEventId = state.lastEventIdBySession[currentSessionId];
    return io.subscribeSession({
      sessionId: currentSessionId,
      lastEventId: resumeFromEventId,
      subscriber: {
        onEvent: (event) => dispatch({ type: 'apply_event', event }),
        onConnectionState: (status) => dispatch({ type: 'set_connection_state', sessionId: currentSessionId, state: status }),
        onError: (incoming) => setError(incoming.message)
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, dispatch, io]);

  useEffect(() => {
    if (!currentSessionId) {
      return undefined;
    }

    const teamId = `team-${currentSessionId}`;
    return io.subscribeTeam({
      teamId,
      subscriber: {
        onEvent: (event) => dispatch({ type: 'apply_team_event', sessionId: currentSessionId, event }),
        onError: (incoming) => setError(incoming.message)
      }
    });
  }, [currentSessionId, dispatch, io]);

  useEffect(() => {
    const listener = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !isStreaming || !currentSessionId) {
        return;
      }
      event.preventDefault();
      void io.abortSession(currentSessionId);
    };

    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [currentSessionId, io, isStreaming]);

  const startTeamRun = async (): Promise<void> => {
    try {
      setTeamRunError(null);
      setTeamRunPending(true);
      const sessionId = await ensureCurrentSession(
        currentSessionId,
        () => io.createSession(),
        (session) => dispatch({ type: 'upsert_session', session })
      );
      dispatch({ type: 'set_current_session', sessionId });

      const primaryPrompt =
        [...messages].reverse().find((item) => item.role === 'user')?.content ??
        '请围绕当前会话目标形成完整可执行结论。';
      const candidateAgents = state.agents.slice(0, Math.max(1, Math.min(3, state.agents.length)));
      if (candidateAgents.length === 0) {
        throw new Error('当前无可用 Agent，无法发起 Team Run。');
      }

      const members = candidateAgents.map((agent, index) => {
        const memberId = `member-${index + 1}`;
        const taskTitle =
          index === 0 ? '问题拆解与上下文梳理' : index === 1 ? '实现方案与执行建议' : '风险审查与交付检查';
        const dependsOn = index === 0 ? [] : [`member-${index}`];
        return {
          memberId,
          agentName: agent.name,
          ...(typeof agent.backend === 'string' && agent.backend ? { backend: agent.backend } : {}),
          taskTitle,
          prompt: `用户目标：${primaryPrompt}\n请聚焦“${taskTitle}”并输出结构化结果。`,
          dependsOn
        };
      });

      const created = await io.runTeam({
        teamId: `team-${sessionId}`,
        sessionId,
        teamName: '协作执行',
        members
      });

      setTeamRuns((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setActiveRunId(created.id);
      await loadTeamRuns(sessionId);
    } catch (incoming) {
      setTeamRunError(toErrorMessage(incoming, '启动 Team Run 失败'));
    } finally {
      setTeamRunPending(false);
    }
  };

  const createSession = async (): Promise<void> => {
    try {
      setError(null);
      const session = await io.createSession();
      dispatch({ type: 'upsert_session', session });
      dispatch({ type: 'set_current_session', sessionId: session.id });
    } catch (incoming) {
      setError(toErrorMessage(incoming, '新建会话失败'));
    }
  };

  const sendMessage = async (content: string): Promise<void> => {
    try {
      setError(null);
      const sessionId = await ensureCurrentSession(
        currentSessionId,
        () => io.createSession(),
        (session) => dispatch({ type: 'upsert_session', session })
      );

      const message: ChatMessage = {
        id: createClientId(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
        toolCalls: []
      };

      dispatch({ type: 'set_current_session', sessionId });
      dispatch({ type: 'append_user_message', sessionId, message });

      await io.askQuestion({
        sessionId,
        content,
        agentId: state.selectedAgentId ?? undefined,
        clientMessageId: createClientId(),
        skillIds: selectedSkillIds,
        mcpServerIds: selectedMcpServerIds
      });
    } catch (incoming) {
      const message = toErrorMessage(incoming, '发送失败');
      setError(message);
      throw new Error(message);
    }
  };

  const retryLast = async (): Promise<void> => {
    try {
      setError(null);
      if (!currentSessionId) {
        throw new Error('请先创建会话。');
      }

      const lastUserMessage = [...messages].reverse().find((item) => item.role === 'user');
      if (!lastUserMessage) {
        throw new Error('暂无可重试的问题。');
      }

      const retryMessage: ChatMessage = {
        id: createClientId(),
        role: 'user',
        content: lastUserMessage.content,
        createdAt: new Date().toISOString(),
        toolCalls: []
      };

      dispatch({ type: 'append_user_message', sessionId: currentSessionId, message: retryMessage });
      await io.retryQuestion({
        sessionId: currentSessionId,
        content: lastUserMessage.content,
        previousMessageId: lastUserMessage.id,
        agentId: state.selectedAgentId ?? undefined,
        clientMessageId: createClientId(),
        skillIds: selectedSkillIds,
        mcpServerIds: selectedMcpServerIds
      });
    } catch (incoming) {
      const message = toErrorMessage(incoming, '重试失败');
      setError(message);
      throw new Error(message);
    }
  };

  const stopStreaming = async (): Promise<void> => {
    try {
      setError(null);
      if (!currentSessionId) {
        throw new Error('当前没有可停止的会话。');
      }
      await io.abortSession(currentSessionId);
    } catch (incoming) {
      const message = toErrorMessage(incoming, '停止失败');
      setError(message);
      throw new Error(message);
    }
  };

  const saveSuggestion = async (suggestionId: string): Promise<void> => {
    if (!currentSessionId) {
      return;
    }
    try {
      await io.saveKnowledgeSuggestion({ sessionId: currentSessionId, suggestionId });
      dispatch({
        type: 'update_suggestion_status',
        sessionId: currentSessionId,
        suggestionId,
        status: 'saved'
      });
    } catch (incoming) {
      setError(toErrorMessage(incoming, '保存建议失败'));
    }
  };

  const ignoreSuggestion = async (suggestionId: string): Promise<void> => {
    if (!currentSessionId) {
      return;
    }
    try {
      await io.ignoreKnowledgeSuggestion({ sessionId: currentSessionId, suggestionId });
      dispatch({
        type: 'update_suggestion_status',
        sessionId: currentSessionId,
        suggestionId,
        status: 'ignored'
      });
    } catch (incoming) {
      setError(toErrorMessage(incoming, '忽略建议失败'));
    }
  };

  return (
    <ShellLayout
      left={
        <LeftSidebar
          sessions={state.sessions}
          currentSessionId={state.currentSessionId}
          onSelectSession={(sessionId) => dispatch({ type: 'set_current_session', sessionId })}
          onCreateSession={() => void createSession()}
        />
      }
      center={
        <section className='chat-panel'>
          <ConnectionBanner state={state.connectionState} />
          {messages.length > 0 && (
            <header className='chat-stage-header'>
              <div className='chat-stage-title'>
                <h2>{state.sessions.find((item) => item.id === currentSessionId)?.title || 'New chat'}</h2>
              </div>
              <div className='chat-stage-meta'>
                <span className='chat-stage-agent'>{selectedAgentName}</span>
              </div>
            </header>
          )}
          {bootstrapLoading && (
            <div className='panel-header'>
              <p className='small-text'>正在同步会话与 Agent 列表，请稍候...</p>
            </div>
          )}
          {bootstrapLoading && messages.length === 0 && (
            <div className='chat-skeleton' aria-hidden='true'>
              <span className='skeleton-line skeleton-line-lg' />
              <span className='skeleton-line skeleton-line-md' />
              <span className='skeleton-line skeleton-line-sm' />
            </div>
          )}
          {bootstrapError && (
            <div className='chat-alert' role='alert'>
              <span>{bootstrapError}</span>
              <button type='button' className='small-button' onClick={() => void loadBootstrap()}>
                重新加载
              </button>
            </div>
          )}
          {capabilityError && (
            <div className='panel-header capability-warning-bar'>
              <p className='small-text'>{capabilityError}</p>
              <button type='button' className='small-button' onClick={() => void loadCapabilities()}>
                刷新能力
              </button>
            </div>
          )}
          {error && (
            <div className='chat-alert' role='alert'>
              <span>{error}</span>
              <button type='button' className='small-button' onClick={() => setError(null)}>
                知道了
              </button>
            </div>
          )}
          {!error && runtimeState?.message && runtimeState.phase !== 'done' && (
            <div className={`panel-header ${runtimeState.phase === 'error' ? 'capability-warning-bar' : ''}`}>
              <p className='small-text'>{runtimeState.message}</p>
              {runtimeState.retryable && !isStreaming && (
                <button type='button' className='small-button' onClick={() => void retryLast()}>
                  重试继续
                </button>
              )}
            </div>
          )}
          {!error && !runtimeState?.message && latestAssistantError && !isStreaming && (
            <div className='panel-header'>
              <p className='small-text'>上一条回复异常中断，可立即重试继续。</p>
              <button type='button' className='small-button' onClick={() => void retryLast()}>
                立即重试
              </button>
            </div>
          )}
          <MessageList
            messages={messages}
            streaming={isStreaming}
            emptyHint={bootstrapLoading ? '正在同步中，请稍候…' : '今天想和你的赛博合伙人一起完成什么？'}
          />
          <Composer
            agents={state.agents}
            selectedAgentId={state.selectedAgentId}
            skills={capabilitySnapshot.availableSkills}
            mcpServers={capabilitySnapshot.availableMcpServers}
            selectedSkillIds={selectedSkillIds}
            selectedMcpServerIds={selectedMcpServerIds}
            streaming={isStreaming}
            canRetry={canRetry}
            onChangeAgent={(agentId) => dispatch({ type: 'set_selected_agent', agentId })}
            onChangeSkillIds={(skillIds) => dispatch({ type: 'set_selected_skills', skillIds })}
            onChangeMcpServerIds={(serverIds) => dispatch({ type: 'set_selected_mcp_servers', serverIds })}
            onSend={sendMessage}
            onStop={stopStreaming}
            onRetry={retryLast}
            injectedDraft={composerExternalDraft}
            onExternalDraftApplied={() => undefined}
            sendBlockedReason={sendBlockedReason}
          />
        </section>
      }
      right={
        <RightSidebar
          suggestions={suggestions}
          teamView={teamView}
          teamRun={activeTeamRun}
          teamRuns={teamRuns}
          runtimeBackends={capabilitySnapshot.runtimeBackends}
          teamRunPending={teamRunPending}
          teamRunError={teamRunError}
          onStartTeamRun={() => void startTeamRun()}
          onRefreshTeamRuns={() => void (currentSessionId ? loadTeamRuns(currentSessionId) : Promise.resolve())}
          onRefreshCapabilities={() => void loadCapabilities()}
          onRetryLastMessage={() => void retryLast()}
          onOpenRoute={(route) => navigate(route)}
          onSaveSuggestion={(suggestionId) => void saveSuggestion(suggestionId)}
          onIgnoreSuggestion={(suggestionId) => void ignoreSuggestion(suggestionId)}
        />
      }
    />
  );
}






