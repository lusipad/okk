import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import { useIO } from '../io/io-context';
import type { RepoRecord, WorkspaceStatusPayload } from '../io/types';
import { useChatStore } from '../state/chat-store';
import type { TeamPanelState, WorkspaceRecord, WorkspaceSearchRecord } from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

export function WorkspacesPage() {
  const navigate = useNavigate();
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [repos, setRepos] = useState<RepoRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkspaceStatusPayload | null>(null);
  const [results, setResults] = useState<WorkspaceSearchRecord[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (): Promise<void> => {
    const session = await io.createSession();
    dispatch({ type: 'upsert_session', session });
    dispatch({ type: 'set_current_session', sessionId: session.id });
    navigate('/');
  };

  const load = async (): Promise<void> => {
    try {
      const [sessions, repoItems, workspaceItems] = await Promise.all([io.listSessions(), io.listRepos(), io.listWorkspaces()]);
      dispatch({ type: 'set_sessions', sessions });
      setRepos(repoItems);
      setWorkspaces(workspaceItems);
      setSelectedWorkspaceId((current) => current ?? workspaceItems[0]?.id ?? null);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '加载工作区失败');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setStatus(null);
      setResults([]);
      return;
    }
    void io.getWorkspaceStatus(selectedWorkspaceId).then(setStatus).catch(() => undefined);
    void io.searchWorkspace(selectedWorkspaceId, query).then(setResults).catch(() => undefined);
  }, [io, query, selectedWorkspaceId]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((item) => item.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces]
  );

  const toggleRepo = (repoId: string) => {
    setSelectedRepoIds((current) => (current.includes(repoId) ? current.filter((item) => item !== repoId) : [...current, repoId]));
  };

  const createWorkspace = async (): Promise<void> => {
    if (!name.trim()) {
      return;
    }
    const item = await io.createWorkspace({
      name: name.trim(),
      description: description.trim() || null,
      repoIds: selectedRepoIds,
      activeRepoId: selectedRepoIds[0] ?? null
    });
    setName('');
    setDescription('');
    setSelectedRepoIds([]);
    await load();
    setSelectedWorkspaceId(item.id);
  };

  return (
    <ShellLayout
      topbarContext={{ title: 'Workspaces' }}
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
          <header className='chat-stage-header'>
            <div className='chat-stage-title'>
              <h2>Workspaces</h2>
              <p className='small-text'>多仓库聚合、活跃仓库切换与跨仓库检索。</p>
            </div>
          </header>
          {error && <p className='error-text'>{error}</p>}
          <div className='settings-card'>
            <h3>创建工作区</h3>
            <input value={name} placeholder='工作区名称' onChange={(event) => setName(event.target.value)} />
            <input value={description} placeholder='描述（可选）' onChange={(event) => setDescription(event.target.value)} />
            <div className='settings-list'>
              {repos.map((repo) => (
                <label key={repo.id} className='settings-item'>
                  <input type='checkbox' checked={selectedRepoIds.includes(repo.id)} onChange={() => toggleRepo(repo.id)} />
                  <span>{repo.name}</span>
                  <span className='small-text'>{repo.path}</span>
                </label>
              ))}
            </div>
            <button type='button' className='primary-button' onClick={() => void createWorkspace()}>创建工作区</button>
          </div>

          <div className='panel space-top'>
            <div className='panel-header'>
              <h3>现有工作区</h3>
            </div>
            <ul className='settings-list'>
              {workspaces.map((item) => (
                <li key={item.id} className='settings-item settings-item-vertical'>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.description || '暂无描述'}</p>
                    <p className='small-text'>仓库数：{item.repoIds.length}</p>
                  </div>
                  <div className='row-actions'>
                    <button type='button' className='ghost-button' onClick={() => setSelectedWorkspaceId(item.id)}>查看</button>
                    <button type='button' className='danger-button' onClick={() => void io.deleteWorkspace(item.id).then(load)}>删除</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {selectedWorkspace && status && (
            <div className='panel space-top'>
              <div className='panel-header'>
                <h3>{selectedWorkspace.name}</h3>
                <input value={query} placeholder='搜索工作区内仓库 / 会话 / 知识' onChange={(event) => setQuery(event.target.value)} />
              </div>
              <ul className='settings-list'>
                {status.repositories.map((repo) => (
                  <li key={repo.repoId} className='settings-item settings-item-vertical'>
                    <div>
                      <strong>{repo.name}</strong>
                      <p>{repo.path}</p>
                      <p className='small-text'>{repo.exists ? (repo.isActive ? '当前活跃仓库' : '可用仓库') : '仓库目录不存在，请修复路径'}</p>
                    </div>
                    <div className='row-actions'>
                      {!repo.isActive && repo.exists && (
                        <button type='button' className='primary-button' onClick={() => void io.activateWorkspaceRepo(selectedWorkspace.id, repo.repoId).then(() => io.getWorkspaceStatus(selectedWorkspace.id).then(setStatus))}>
                          设为活跃
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className='panel space-top'>
                <div className='panel-header'>
                  <h4>跨仓库结果</h4>
                  <span className='small-text'>{results.length} 条</span>
                </div>
                <ul className='settings-list'>
                  {results.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className='settings-item settings-item-vertical'>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.summary}</p>
                        <span className='chip'>{item.kind}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
