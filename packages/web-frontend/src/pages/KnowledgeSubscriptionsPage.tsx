import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { CreateKnowledgeSubscriptionInput, RepoRecord } from '../io/types';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import type {
  KnowledgeSubscriptionConsumeStatus,
  KnowledgeSubscriptionRecord,
  KnowledgeSubscriptionUpdateRecord,
  TeamPanelState
} from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

type UpdateFilter = 'all' | KnowledgeSubscriptionConsumeStatus;

export function KnowledgeSubscriptionsPage() {
  const io = useIO();
  const navigate = useNavigate();
  const { state, dispatch } = useChatStore();
  const [repos, setRepos] = useState<RepoRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<KnowledgeSubscriptionRecord[]>([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<KnowledgeSubscriptionUpdateRecord[]>([]);
  const [sourceType, setSourceType] = useState<'team' | 'project' | 'topic'>('team');
  const [sourceId, setSourceId] = useState('team');
  const [sourceLabel, setSourceLabel] = useState('');
  const [targetRepoId, setTargetRepoId] = useState('');
  const [detailSourceLabel, setDetailSourceLabel] = useState('');
  const [detailTargetRepoId, setDetailTargetRepoId] = useState('');
  const [detailEnabled, setDetailEnabled] = useState(true);
  const [updateFilter, setUpdateFilter] = useState<UpdateFilter>('all');
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importingUpdateId, setImportingUpdateId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectedSubscription = useMemo(
    () => subscriptions.find((item) => item.id === selectedSubscriptionId) ?? null,
    [selectedSubscriptionId, subscriptions]
  );

  const visibleUpdates = useMemo(
    () => (updateFilter === 'all' ? updates : updates.filter((item) => item.consumeStatus === updateFilter)),
    [updateFilter, updates]
  );

  const createSession = async (): Promise<void> => {
    const session = await io.createSession();
    dispatch({ type: 'upsert_session', session });
    dispatch({ type: 'set_current_session', sessionId: session.id });
    navigate('/');
  };

  const loadSubscriptions = async (preferredId?: string | null): Promise<void> => {
    const items = await io.listKnowledgeSubscriptions();
    setSubscriptions(items);
    const nextSelectedId =
      preferredId && items.some((item) => item.id === preferredId)
        ? preferredId
        : items[0]?.id ?? null;
    setSelectedSubscriptionId(nextSelectedId);
  };

  const loadUpdates = async (subscriptionId: string): Promise<void> => {
    setListLoading(true);
    setDetailError(null);
    try {
      const payload = await io.listKnowledgeSubscriptionUpdates(subscriptionId);
      setUpdates(payload.items);
      setSubscriptions((current) =>
        current.map((item) => (item.id === payload.item.id ? payload.item : item))
      );
    } catch (incoming) {
      setDetailError(incoming instanceof Error ? incoming.message : '加载订阅更新失败');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [sessions, repoItems, subscriptionItems] = await Promise.all([
          io.listSessions(),
          io.listRepos(),
          io.listKnowledgeSubscriptions()
        ]);
        if (cancelled) {
          return;
        }
        dispatch({ type: 'set_sessions', sessions });
        setRepos(repoItems);
        setTargetRepoId(repoItems[0]?.id ?? '');
        setSubscriptions(subscriptionItems);
        setSelectedSubscriptionId(subscriptionItems[0]?.id ?? null);
      } catch (incoming) {
        if (!cancelled) {
          setError(incoming instanceof Error ? incoming.message : '加载知识订阅工作台失败');
        }
      } finally {
        if (!cancelled) {
          setBootstrapLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, io]);

  useEffect(() => {
    if (!selectedSubscription) {
      setDetailSourceLabel('');
      setDetailTargetRepoId('');
      setDetailEnabled(true);
      setUpdates([]);
      return;
    }

    setDetailSourceLabel(selectedSubscription.source.label);
    setDetailTargetRepoId(selectedSubscription.targetRepoId);
    setDetailEnabled(selectedSubscription.status === 'active');
  }, [selectedSubscription]);

  useEffect(() => {
    if (!selectedSubscriptionId) {
      return;
    }
    void loadUpdates(selectedSubscriptionId);
  }, [selectedSubscriptionId]);

  const createSubscription = async (): Promise<void> => {
    const resolvedSourceId =
      sourceType === 'team' ? 'team' : sourceId.trim();
    if (!resolvedSourceId || !targetRepoId) {
      setError('请填写来源并选择目标仓库。');
      return;
    }

    setCreating(true);
    setError(null);
    setFeedback(null);
    try {
      const input: CreateKnowledgeSubscriptionInput = {
        sourceType,
        targetRepoId,
        ...(sourceType !== 'team' ? { sourceId: resolvedSourceId } : {}),
        ...(sourceType === 'team' ? { sourceId: 'team' } : {}),
        ...(sourceLabel.trim() ? { sourceLabel: sourceLabel.trim() } : {})
      };
      const created = await io.createKnowledgeSubscription(input);
      setSourceLabel('');
      setSourceId(sourceType === 'team' ? 'team' : '');
      await loadSubscriptions(created.id);
      setFeedback('订阅已创建。');
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '创建订阅失败');
    } finally {
      setCreating(false);
    }
  };

  const saveSubscription = async (): Promise<void> => {
    if (!selectedSubscription) {
      return;
    }

    setSaving(true);
    setDetailError(null);
    setFeedback(null);
    try {
      const updated = await io.updateKnowledgeSubscription(selectedSubscription.id, {
        sourceLabel: detailSourceLabel.trim() || undefined,
        targetRepoId: detailTargetRepoId || undefined,
        enabled: detailEnabled
      });
      setSubscriptions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setFeedback('订阅设置已保存。');
    } catch (incoming) {
      setDetailError(incoming instanceof Error ? incoming.message : '保存订阅失败');
    } finally {
      setSaving(false);
    }
  };

  const syncSubscription = async (): Promise<void> => {
    if (!selectedSubscription) {
      return;
    }

    setSyncing(true);
    setDetailError(null);
    setFeedback(null);
    try {
      const payload = await io.syncKnowledgeSubscription(selectedSubscription.id);
      setUpdates(payload.items);
      setSubscriptions((current) => current.map((item) => (item.id === payload.item.id ? payload.item : item)));
      setFeedback(`同步完成，当前共有 ${payload.items.length} 条更新。`);
    } catch (incoming) {
      setDetailError(incoming instanceof Error ? incoming.message : '同步订阅失败');
    } finally {
      setSyncing(false);
    }
  };

  const importUpdate = async (updateId: string): Promise<void> => {
    setImportingUpdateId(updateId);
    setDetailError(null);
    setFeedback(null);
    try {
      const payload = await io.importKnowledgeSubscriptionUpdate(updateId);
      if (payload.item) {
        setUpdates((current) => current.map((item) => (item.id === payload.item?.id ? payload.item : item)));
      }
      if (payload.subscription) {
        setSubscriptions((current) =>
          current.map((item) => (item.id === payload.subscription?.id ? payload.subscription : item))
        );
      }
      setFeedback(`已处理更新，目标知识：${payload.entry.title}`);
    } catch (incoming) {
      setDetailError(incoming instanceof Error ? incoming.message : '导入订阅更新失败');
    } finally {
      setImportingUpdateId(null);
    }
  };

  return (
    <ShellLayout
      topbarContext={{ title: 'Knowledge Subscriptions' }}
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
              <h2>知识订阅</h2>
              <p className='small-text'>订阅团队、项目或主题知识源，查看增量更新并一键导入到目标仓库。</p>
            </div>
            <div className='row-actions'>
              <button type='button' className='ghost-button' onClick={() => navigate('/knowledge')}>
                返回知识工作台
              </button>
            </div>
          </header>

          {error && <p className='error-text'>{error}</p>}
          {feedback && <p className='small-text'>{feedback}</p>}

          <div className='settings-card'>
            <div className='panel-header'>
              <h3>新建订阅</h3>
            </div>
            <div className='knowledge-filter-grid'>
              <label className='settings-item settings-item-vertical'>
                <span>来源类型</span>
                <select
                  data-testid='knowledge-subscription-source-type'
                  value={sourceType}
                  onChange={(event) => {
                    const nextType = event.target.value as 'team' | 'project' | 'topic';
                    setSourceType(nextType);
                    setSourceId(nextType === 'team' ? 'team' : '');
                  }}
                >
                  <option value='team'>team</option>
                  <option value='project'>project</option>
                  <option value='topic'>topic</option>
                </select>
              </label>
              <label className='settings-item settings-item-vertical'>
                <span>来源标识</span>
                {sourceType === 'project' ? (
                  <select
                    data-testid='knowledge-subscription-source-id'
                    value={sourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                  >
                    <option value=''>选择来源仓库</option>
                    {repos.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    data-testid='knowledge-subscription-source-id'
                    value={sourceType === 'team' ? 'team' : sourceId}
                    disabled={sourceType === 'team'}
                    placeholder={sourceType === 'topic' ? '例如：release' : 'team'}
                    onChange={(event) => setSourceId(event.target.value)}
                  />
                )}
              </label>
              <label className='settings-item settings-item-vertical'>
                <span>展示名称</span>
                <input
                  data-testid='knowledge-subscription-source-label'
                  value={sourceLabel}
                  placeholder='可选，自定义来源名称'
                  onChange={(event) => setSourceLabel(event.target.value)}
                />
              </label>
              <label className='settings-item settings-item-vertical'>
                <span>目标仓库</span>
                <select
                  data-testid='knowledge-subscription-target-repo'
                  value={targetRepoId}
                  onChange={(event) => setTargetRepoId(event.target.value)}
                >
                  <option value=''>选择目标仓库</option>
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className='row-actions space-top'>
              <button
                type='button'
                className='primary-button'
                data-testid='knowledge-subscription-create-button'
                onClick={() => void createSubscription()}
                disabled={creating || bootstrapLoading}
              >
                {creating ? '创建中…' : '创建订阅'}
              </button>
            </div>
          </div>

          <div className='knowledge-workbench-grid space-top'>
            <div className='knowledge-list-column'>
              <div className='panel'>
                <div className='panel-header'>
                  <h3>订阅列表</h3>
                  <span className='small-text'>{bootstrapLoading ? '加载中…' : `${subscriptions.length} 个订阅`}</span>
                </div>
                {subscriptions.length === 0 ? (
                  <p className='small-text'>还没有知识订阅，先创建一个新的来源。</p>
                ) : (
                  <ul className='settings-list knowledge-entry-list'>
                    {subscriptions.map((item) => (
                      <li key={item.id} className='settings-item settings-item-vertical'>
                        <button
                          type='button'
                          className={`knowledge-entry-button ${selectedSubscriptionId === item.id ? 'is-active' : ''}`}
                          data-testid={`knowledge-subscription-${item.id}`}
                          onClick={() => setSelectedSubscriptionId(item.id)}
                        >
                          <div className='panel-header panel-header-tight'>
                            <strong>{item.source.label}</strong>
                            <span className='chip'>{item.status}</span>
                          </div>
                          <p>{item.source.type} · 目标仓库 {item.targetRepoId}</p>
                          <div className='chip-row'>
                            <span className='chip'>待处理 {item.pendingUpdateCount}</span>
                            <span className='chip'>{item.lastSyncStatus}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className='knowledge-detail-column'>
              {selectedSubscription ? (
                <>
                  <div className='settings-card'>
                    <div className='panel-header'>
                      <h3>{selectedSubscription.source.label}</h3>
                      <div className='row-actions'>
                        <button
                          type='button'
                          className='ghost-button'
                          data-testid='knowledge-subscription-sync-button'
                          onClick={() => void syncSubscription()}
                          disabled={syncing || selectedSubscription.status !== 'active'}
                        >
                          {syncing ? '同步中…' : '立即同步'}
                        </button>
                        <button
                          type='button'
                          className='primary-button'
                          data-testid='knowledge-subscription-save-button'
                          onClick={() => void saveSubscription()}
                          disabled={saving}
                        >
                          {saving ? '保存中…' : '保存设置'}
                        </button>
                      </div>
                    </div>
                    <p className='small-text'>
                      来源 {selectedSubscription.source.type}:{selectedSubscription.source.id} · 最近同步{' '}
                      {selectedSubscription.lastSyncedAt ? new Date(selectedSubscription.lastSyncedAt).toLocaleString('zh-CN') : '未同步'}
                    </p>
                    {selectedSubscription.lastSyncSummary && (
                      <p className='small-text'>{selectedSubscription.lastSyncSummary}</p>
                    )}
                    {detailError && <p className='error-text'>{detailError}</p>}
                    <div className='knowledge-filter-grid space-top'>
                      <label className='settings-item settings-item-vertical'>
                        <span>展示名称</span>
                        <input
                          data-testid='knowledge-subscription-detail-label'
                          value={detailSourceLabel}
                          onChange={(event) => setDetailSourceLabel(event.target.value)}
                        />
                      </label>
                      <label className='settings-item settings-item-vertical'>
                        <span>目标仓库</span>
                        <select
                          data-testid='knowledge-subscription-detail-target-repo'
                          value={detailTargetRepoId}
                          onChange={(event) => setDetailTargetRepoId(event.target.value)}
                        >
                          <option value=''>选择目标仓库</option>
                          {repos.map((repo) => (
                            <option key={repo.id} value={repo.id}>
                              {repo.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className='settings-item'>
                        <input
                          data-testid='knowledge-subscription-detail-enabled'
                          type='checkbox'
                          checked={detailEnabled}
                          onChange={(event) => setDetailEnabled(event.target.checked)}
                        />
                        <span>启用订阅</span>
                      </label>
                    </div>
                  </div>

                  <div className='panel space-top'>
                    <div className='panel-header'>
                      <h3>最近更新</h3>
                      <div className='row-actions'>
                        <label className='settings-item'>
                          <span>状态</span>
                          <select
                            data-testid='knowledge-subscription-update-filter'
                            value={updateFilter}
                            onChange={(event) => setUpdateFilter(event.target.value as UpdateFilter)}
                          >
                            <option value='all'>all</option>
                            <option value='pending'>pending</option>
                            <option value='imported'>imported</option>
                            <option value='duplicate'>duplicate</option>
                            <option value='skipped'>skipped</option>
                          </select>
                        </label>
                        <span className='small-text'>{listLoading ? '刷新中…' : `${visibleUpdates.length} 条`}</span>
                      </div>
                    </div>
                    {visibleUpdates.length === 0 ? (
                      <p className='small-text'>当前没有符合筛选条件的订阅更新。</p>
                    ) : (
                      <ul className='settings-list knowledge-entry-list'>
                        {visibleUpdates.map((item) => (
                          <li key={item.id} className='settings-item settings-item-vertical'>
                            <div className='panel-header panel-header-tight'>
                              <strong>{item.title}</strong>
                              <span className='chip'>{item.consumeStatus}</span>
                            </div>
                            <p>{item.summary}</p>
                            <p className='small-text'>
                              作者 {item.sourceAuthorName ?? item.sourceAuthorId} · {new Date(item.sourceUpdatedAt).toLocaleString('zh-CN')}
                            </p>
                            <div className='chip-row'>
                              <span className='chip'>{item.category}</span>
                              {item.tags.map((tag) => (
                                <span key={`${item.id}-${tag}`} className='chip'>
                                  #{tag}
                                </span>
                              ))}
                              {item.importedEntryId && <span className='chip'>entry:{item.importedEntryId}</span>}
                            </div>
                            <div className='row-actions space-top'>
                              <button
                                type='button'
                                className='primary-button'
                                data-testid={`knowledge-subscription-import-${item.id}`}
                                onClick={() => void importUpdate(item.id)}
                                disabled={item.consumeStatus !== 'pending' || importingUpdateId === item.id}
                              >
                                {importingUpdateId === item.id ? '导入中…' : item.consumeStatus === 'pending' ? '一键导入' : '已处理'}
                              </button>
                              {item.importedEntryId && (
                                <button
                                  type='button'
                                  className='ghost-button'
                                  onClick={() => navigate(`/knowledge/${encodeURIComponent(item.importedEntryId as string)}`)}
                                >
                                  打开知识
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <div className='settings-card knowledge-empty-state'>
                  <h3>选择一个订阅开始查看</h3>
                  <p className='small-text'>这里会展示订阅来源、同步状态和可导入的最近更新。</p>
                </div>
              )}
            </div>
          </div>
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
