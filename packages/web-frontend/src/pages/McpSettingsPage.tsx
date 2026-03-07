import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIO } from '../io/io-context';
import type {
  CreateMcpServerInput,
  McpResourceInfo,
  McpResourceReadContent,
  McpServerSetting,
  McpToolInfo
} from '../io/types';
import { useChatStore } from '../state/chat-store';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { TeamPanelState } from '../types/domain';

interface ServerDraft {
  name: string;
  description: string;
  command: string;
  argsText: string;
  cwd: string;
}

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

export function McpSettingsPage() {
  const io = useIO();
  const navigate = useNavigate();
  const { state, dispatch } = useChatStore();

  const [servers, setServers] = useState<McpServerSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ServerDraft>>({});

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgsText, setNewArgsText] = useState('');
  const [newCwd, setNewCwd] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyServerId, setBusyServerId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [runtimeServerId, setRuntimeServerId] = useState<string | null>(null);
  const [runtimeTools, setRuntimeTools] = useState<McpToolInfo[]>([]);
  const [runtimeResources, setRuntimeResources] = useState<McpResourceInfo[]>([]);
  const [runtimeResourceContents, setRuntimeResourceContents] = useState<McpResourceReadContent[]>([]);
  const [runtimeToolName, setRuntimeToolName] = useState('');
  const [runtimeToolArgs, setRuntimeToolArgs] = useState('{}');
  const [runtimeResourceUri, setRuntimeResourceUri] = useState('');
  const [runtimeOutput, setRuntimeOutput] = useState('');

  const createSession = async (): Promise<void> => {
    try {
      const session = await io.createSession();
      dispatch({ type: 'upsert_session', session });
      dispatch({ type: 'set_current_session', sessionId: session.id });
      navigate('/');
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '新建会话失败');
    }
  };

  const createDraft = (server: McpServerSetting): ServerDraft => ({
    name: server.name,
    description: server.description,
    command: server.command,
    argsText: server.args.join(' '),
    cwd: server.cwd ?? ''
  });

  const syncDrafts = (items: McpServerSetting[]): void => {
    setDrafts((current) => {
      const next: Record<string, ServerDraft> = {};

      for (const server of items) {
        next[server.id] = current[server.id] ?? createDraft(server);
      }

      return next;
    });
  };

  const loadServers = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [data, sessions] = await Promise.all([io.listMcpServers(), io.listSessions()]);
      setServers(data);
      dispatch({ type: 'set_sessions', sessions });
      syncDrafts(data);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const serverById = useMemo(() => {
    const map = new Map<string, McpServerSetting>();
    for (const server of servers) {
      map.set(server.id, server);
    }
    return map;
  }, [servers]);

  const updateServerInList = (updated: McpServerSetting): void => {
    setServers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setDrafts((current) => ({ ...current, [updated.id]: createDraft(updated) }));
  };

  const setDraftField = (serverId: string, field: keyof ServerDraft, value: string): void => {
    setDrafts((current) => ({
      ...current,
      [serverId]: {
        ...(current[serverId] ?? {
          name: '',
          description: '',
          command: '',
          argsText: '',
          cwd: ''
        }),
        [field]: value
      }
    }));
  };

  const toggleServer = async (serverId: string, enabled: boolean): Promise<void> => {
    setBusyServerId(serverId);
    setError(null);

    try {
      const updated = await io.setMcpServerEnabled(serverId, enabled);
      updateServerInList(updated);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '更新失败');
    } finally {
      setBusyServerId(null);
    }
  };

  const startServer = async (serverId: string): Promise<void> => {
    setBusyServerId(serverId);
    setError(null);

    try {
      const updated = await io.startMcpServer(serverId);
      updateServerInList(updated);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '启动失败');
    } finally {
      setBusyServerId(null);
    }
  };

  const stopServer = async (serverId: string): Promise<void> => {
    setBusyServerId(serverId);
    setError(null);

    try {
      const updated = await io.stopMcpServer(serverId);
      updateServerInList(updated);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '停止失败');
    } finally {
      setBusyServerId(null);
    }
  };

  const saveServer = async (serverId: string): Promise<void> => {
    const draft = drafts[serverId];
    if (!draft) {
      return;
    }

    setBusyServerId(serverId);
    setError(null);

    try {
      const updated = await io.updateMcpServer(serverId, {
        name: draft.name.trim(),
        description: draft.description,
        command: draft.command.trim(),
        args: draft.argsText
          .split(' ')
          .map((item) => item.trim())
          .filter(Boolean),
        cwd: draft.cwd.trim() || null
      });
      updateServerInList(updated);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '保存失败');
    } finally {
      setBusyServerId(null);
    }
  };

  const deleteServer = async (serverId: string): Promise<void> => {
    setBusyServerId(serverId);
    setError(null);

    try {
      await io.deleteMcpServer(serverId);
      setServers((current) => current.filter((item) => item.id !== serverId));
      setDrafts((current) => {
        const { [serverId]: _, ...rest } = current;
        return rest;
      });
      if (runtimeServerId === serverId) {
        setRuntimeServerId(null);
        setRuntimeTools([]);
        setRuntimeResources([]);
        setRuntimeResourceContents([]);
        setRuntimeOutput('');
      }
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '删除失败');
    } finally {
      setBusyServerId(null);
    }
  };

  const createServer = async (): Promise<void> => {
    if (!newName.trim() || !newCommand.trim()) {
      setError('新增 MCP 需要填写名称和命令');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const payload: CreateMcpServerInput = {
        name: newName.trim(),
        description: newDescription.trim(),
        command: newCommand.trim(),
        args: newArgsText
          .split(' ')
          .map((item) => item.trim())
          .filter(Boolean),
        cwd: newCwd.trim() || null,
        enabled: false
      };

      const created = await io.createMcpServer(payload);
      setServers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')));
      setDrafts((current) => ({ ...current, [created.id]: createDraft(created) }));

      setNewName('');
      setNewDescription('');
      setNewCommand('');
      setNewArgsText('');
      setNewCwd('');
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '新增失败');
    } finally {
      setCreating(false);
    }
  };

  const inspectRuntime = async (serverId: string): Promise<void> => {
    setBusyServerId(serverId);
    setError(null);
    setRuntimeOutput('');
    try {
      const [tools, resources] = await Promise.all([io.listMcpTools(serverId), io.listMcpResources(serverId)]);
      setRuntimeServerId(serverId);
      setRuntimeTools(tools);
      setRuntimeResources(resources);
      setRuntimeResourceContents([]);
      if (tools.length > 0) {
        setRuntimeToolName((current) => current || tools[0].name);
      }
      if (resources.length > 0) {
        setRuntimeResourceUri((current) => current || resources[0].uri);
      }
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '读取 MCP 运行能力失败');
    } finally {
      setBusyServerId(null);
    }
  };

  const callTool = async (): Promise<void> => {
    if (!runtimeServerId) {
      setError('请先选择一个 MCP Server');
      return;
    }
    if (!runtimeToolName.trim()) {
      setError('请填写 Tool 名称');
      return;
    }

    setBusyServerId(runtimeServerId);
    setError(null);
    try {
      let parsedArgs: Record<string, unknown> = {};
      const trimmed = runtimeToolArgs.trim();
      if (trimmed.length > 0) {
        const parsed = JSON.parse(trimmed) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('工具参数必须是 JSON 对象');
        }
        parsedArgs = parsed as Record<string, unknown>;
      }

      const result = await io.callMcpTool(runtimeServerId, runtimeToolName.trim(), parsedArgs);
      setRuntimeOutput(result.content || JSON.stringify(result.raw, null, 2));
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '调用工具失败');
    } finally {
      setBusyServerId(null);
    }
  };

  const readResource = async (): Promise<void> => {
    if (!runtimeServerId) {
      setError('请先选择一个 MCP Server');
      return;
    }
    if (!runtimeResourceUri.trim()) {
      setError('请填写资源 URI');
      return;
    }

    setBusyServerId(runtimeServerId);
    setError(null);
    try {
      const contents = await io.readMcpResource(runtimeServerId, runtimeResourceUri.trim());
      setRuntimeResourceContents(contents);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '读取资源失败');
    } finally {
      setBusyServerId(null);
    }
  };

  const statusClass = (status: McpServerSetting['status']): string => {
    if (status === 'running') {
      return 'pill-success';
    }
    if (status === 'error') {
      return 'pill-error';
    }
    return 'pill-warning';
  };

  return (
    <ShellLayout
      left={
        <LeftSidebar
          sessions={state.sessions}
          currentSessionId={state.currentSessionId}
          onSelectSession={(sessionId) => {
            dispatch({ type: 'set_current_session', sessionId });
            navigate('/');
          }}
          onCreateSession={() => void createSession()}
        />
      }
      center={
        <section className='chat-panel'>
          <header className='panel-header'>
            <div>
              <p className='eyebrow'>MCP Runtime</p>
              <h2>MCP 设置中心</h2>
            </div>
            <button type='button' className='ghost-button' onClick={() => void loadServers()} disabled={loading}>
              刷新
            </button>
          </header>

          <p className='empty-hint'>统一管理 MCP Server 配置、启停状态和运行时工具调试能力，让赛博合伙人安全接入外部工具与资源。</p>

          <article className='settings-card'>
            <div className='settings-form-grid'>
              <input data-testid='mcp-create-name' value={newName} onChange={(event) => setNewName(event.target.value)} placeholder='名称' />
              <input
                data-testid='mcp-create-description'
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder='描述（可选）'
              />
              <input
                data-testid='mcp-create-command'
                value={newCommand}
                onChange={(event) => setNewCommand(event.target.value)}
                placeholder='命令（如 mcp-server）'
              />
              <input
                data-testid='mcp-create-args'
                value={newArgsText}
                onChange={(event) => setNewArgsText(event.target.value)}
                placeholder='参数（空格分隔，可选）'
              />
              <input data-testid='mcp-create-cwd' value={newCwd} onChange={(event) => setNewCwd(event.target.value)} placeholder='工作目录（可选）' />
            </div>
            <button data-testid='mcp-create-submit' type='button' className='primary-button' disabled={creating} onClick={() => void createServer()}>
              {creating ? '新增中...' : '新增 MCP'}
            </button>
          </article>

          {error && <p className='error-text'>{error}</p>}

          {loading ? (
            <p>加载中...</p>
          ) : servers.length === 0 ? (
            <p className='empty-hint'>暂无 MCP Server，先为你的赛博合伙人接入外部能力。</p>
          ) : (
            <ul className='settings-list' data-testid='mcp-server-list'>
              {servers.map((server) => {
                const draft = drafts[server.id] ?? createDraft(server);
                const busy = busyServerId === server.id;
                const persisted = serverById.get(server.id) ?? server;

                return (
                  <li key={server.id} className='settings-item settings-item-vertical' data-testid={`mcp-server-${server.id}`}>
                    <div className='settings-form-grid'>
                      <input
                        value={draft.name}
                        onChange={(event) => setDraftField(server.id, 'name', event.target.value)}
                        placeholder='名称'
                      />
                      <input
                        value={draft.description}
                        onChange={(event) => setDraftField(server.id, 'description', event.target.value)}
                        placeholder='描述'
                      />
                      <input
                        value={draft.command}
                        onChange={(event) => setDraftField(server.id, 'command', event.target.value)}
                        placeholder='命令'
                      />
                      <input
                        value={draft.argsText}
                        onChange={(event) => setDraftField(server.id, 'argsText', event.target.value)}
                        placeholder='参数（空格分隔）'
                      />
                      <input
                        value={draft.cwd}
                        onChange={(event) => setDraftField(server.id, 'cwd', event.target.value)}
                        placeholder='工作目录（可选）'
                      />
                      <div className='chip-row'>
                        <span className={`pill ${statusClass(persisted.status)}`}>状态: {persisted.status}</span>
                        <span className='pill pill-running'>启用: {persisted.enabled ? 'true' : 'false'}</span>
                        {persisted.lastStartedAt && <span className='pill'>started: {persisted.lastStartedAt}</span>}
                        {persisted.lastStoppedAt && <span className='pill'>stopped: {persisted.lastStoppedAt}</span>}
                      </div>
                    </div>
                    <div className='row-actions'>
                      <button
                        data-testid={`mcp-toggle-${server.id}`}
                        type='button'
                        className='ghost-button'
                        disabled={busy}
                        onClick={() => void toggleServer(server.id, !persisted.enabled)}
                      >
                        {persisted.enabled ? '禁用' : '启用'}
                      </button>
                      <button
                        data-testid={`mcp-start-${server.id}`}
                        type='button'
                        className='ghost-button'
                        disabled={busy || persisted.status === 'running'}
                        onClick={() => void startServer(server.id)}
                      >
                        启动
                      </button>
                      <button
                        data-testid={`mcp-stop-${server.id}`}
                        type='button'
                        className='ghost-button'
                        disabled={busy || persisted.status !== 'running'}
                        onClick={() => void stopServer(server.id)}
                      >
                        停止
                      </button>
                      <button
                        data-testid={`mcp-save-${server.id}`}
                        type='button'
                        className='primary-button'
                        disabled={busy}
                        onClick={() => void saveServer(server.id)}
                      >
                        保存
                      </button>
                      <button
                        data-testid={`mcp-runtime-${server.id}`}
                        type='button'
                        className='ghost-button'
                        disabled={busy}
                        onClick={() => void inspectRuntime(server.id)}
                      >
                        运行能力
                      </button>
                      <button
                        data-testid={`mcp-delete-${server.id}`}
                        type='button'
                        className='danger-button'
                        disabled={busy}
                        onClick={() => void deleteServer(server.id)}
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {runtimeServerId && (
            <div className='panel space-top'>
              <div className='panel-header'>
                <h3>MCP 运行态调试（{runtimeServerId}）</h3>
              </div>
              <p className='small-text'>可直接读取工具列表、调用工具和读取资源，用于验证 MCP 真实可用性。</p>
              <div className='settings-item'>
                <div className='settings-form-grid'>
                  <input
                    data-testid='mcp-runtime-tool-name'
                    value={runtimeToolName}
                    onChange={(event) => setRuntimeToolName(event.target.value)}
                    placeholder='Tool 名称'
                  />
                  <textarea
                    data-testid='mcp-runtime-tool-args'
                    value={runtimeToolArgs}
                    onChange={(event) => setRuntimeToolArgs(event.target.value)}
                    rows={4}
                    placeholder='Tool 参数 JSON，例如 {"text":"hello"}'
                  />
                </div>
                <button
                  data-testid='mcp-runtime-call'
                  type='button'
                  className='primary-button'
                  onClick={() => void callTool()}
                  disabled={busyServerId === runtimeServerId}
                >
                  调用 Tool
                </button>
              </div>
              {runtimeTools.length > 0 && (
                <p className='small-text'>Tools: {runtimeTools.map((item) => item.name).join('，')}</p>
              )}
              <div className='settings-item'>
                <div className='settings-form-grid'>
                  <input
                    data-testid='mcp-runtime-resource-uri'
                    value={runtimeResourceUri}
                    onChange={(event) => setRuntimeResourceUri(event.target.value)}
                    placeholder='资源 URI，例如 memo://hello'
                  />
                </div>
                <button
                  data-testid='mcp-runtime-read'
                  type='button'
                  className='ghost-button'
                  onClick={() => void readResource()}
                  disabled={busyServerId === runtimeServerId}
                >
                  读取资源
                </button>
              </div>
              {runtimeResources.length > 0 && (
                <p className='small-text'>Resources: {runtimeResources.map((item) => item.uri).join('，')}</p>
              )}
              {runtimeOutput && (
                <pre className='runtime-output' data-testid='mcp-runtime-output'>
                  {runtimeOutput}
                </pre>
              )}
              {runtimeResourceContents.length > 0 && (
                <pre className='runtime-output' data-testid='mcp-runtime-resource-output'>
                  {runtimeResourceContents.map((item) => `${item.uri}\n${item.text}`).join('\n\n')}
                </pre>
              )}
            </div>
          )}
        </section>
      }
      right={
        <RightSidebar
          suggestions={[]}
          teamView={EMPTY_TEAM_VIEW}
          onSaveSuggestion={() => undefined}
          onIgnoreSuggestion={() => undefined}
        />
      }
    />
  );
}

