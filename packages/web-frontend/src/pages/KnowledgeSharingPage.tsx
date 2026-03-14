import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import type { KnowledgeShareRecord, TeamPanelState } from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function KnowledgeSharingPage() {
  const io = useIO();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useChatStore();
  const mode = location.pathname.endsWith('/team') ? 'team' : 'review';
  const [overview, setOverview] = useState<import('../io/types').KnowledgeSharingOverview | null>(null);
  const [shares, setShares] = useState<KnowledgeShareRecord[]>([]);
  const [teamItems, setTeamItems] = useState<KnowledgeShareRecord[]>([]);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState('');
  const [repoId, setRepoId] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentItems = mode === 'team' ? teamItems : shares;
  const selectedShare = useMemo(
    () => currentItems.find((item) => item.id === selectedShareId) ?? null,
    [currentItems, selectedShareId]
  );
  const parsedTags = useMemo(() => parseTags(tagFilter), [tagFilter]);

  const createSession = async (): Promise<void> => {
    const session = await io.createSession();
    dispatch({ type: 'upsert_session', session });
    dispatch({ type: 'set_current_session', sessionId: session.id });
    navigate('/');
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [sessions, repos, nextOverview] = await Promise.all([
          io.listSessions(),
          io.listRepos(),
          io.getKnowledgeSharingOverview()
        ]);
        if (cancelled) {
          return;
        }
        dispatch({ type: 'set_sessions', sessions });
        setOverview(nextOverview);
        setRepoId((current) => current || repos[0]?.id || '');
      } catch (incoming) {
        if (!cancelled) {
          setError(incoming instanceof Error ? incoming.message : '加载知识共享工作台失败');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, io]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async (): Promise<void> => {
      try {
        if (mode === 'team') {
          const items = await io.listPublishedKnowledgeShares({
            repoId: repoId || undefined,
            category: category.trim() || undefined,
            tags: parsedTags,
            query: query.trim() || undefined
          });
          if (!cancelled) {
            setTeamItems(items);
            setSelectedShareId((current) => current ?? items[0]?.id ?? null);
          }
          return;
        }

        const items = await io.listKnowledgeShares({
          status: reviewStatus || undefined
        });
        const filtered = items.filter((item) => item.reviewStatus !== 'published' || reviewStatus === 'published');
        if (!cancelled) {
          setShares(filtered);
          setSelectedShareId((current) => current ?? filtered[0]?.id ?? null);
        }
      } catch (incoming) {
        if (!cancelled) {
          setError(incoming instanceof Error ? incoming.message : '加载知识共享列表失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [category, io, mode, parsedTags, query, repoId, reviewStatus]);

  const refreshOverview = async (): Promise<void> => {
    setOverview(await io.getKnowledgeSharingOverview());
  };

  const runReview = async (action: 'approve' | 'publish' | 'reject' | 'request_changes' | 'rollback'): Promise<void> => {
    if (!selectedShareId) {
      return;
    }

    await io.reviewKnowledgeShare(selectedShareId, {
      action,
      ...(reviewNote.trim() ? { note: reviewNote.trim() } : {})
    });
    setReviewNote('');
    await refreshOverview();

    const items = await io.listKnowledgeShares({
      status: reviewStatus || undefined
    });
    const filtered = items.filter((item) => item.reviewStatus !== 'published' || reviewStatus === 'published');
    setShares(filtered);
    setSelectedShareId(filtered.find((item) => item.id === selectedShareId)?.id ?? filtered[0]?.id ?? null);
  };

  return (
    <ShellLayout
      topbarContext={{ title: mode === 'team' ? 'Team Knowledge' : 'Knowledge Sharing' }}
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
              <h2>{mode === 'team' ? '团队知识库' : '知识共享审核'}</h2>
              <p className='small-text'>
                {mode === 'team' ? '仅浏览已发布共享知识，按标签、分类和来源快速筛选。' : '处理共享请求、退回修改并发布团队可见知识。'}
              </p>
            </div>
            <div className='row-actions'>
              <button type='button' className={mode === 'review' ? 'primary-button' : 'ghost-button'} onClick={() => navigate('/knowledge/sharing')}>
                审核队列
              </button>
              <button type='button' className={mode === 'team' ? 'primary-button' : 'ghost-button'} onClick={() => navigate('/knowledge/team')}>
                团队知识
              </button>
            </div>
          </header>

          {overview && (
            <div className='settings-card'>
              <h3>共享概览</h3>
              <p className='small-text'>
                总量 {overview.summary.total} · 待审 {overview.summary.pendingReview} · 已批准 {overview.summary.approved} · 已发布{' '}
                {overview.summary.published}
              </p>
            </div>
          )}

          {mode === 'team' ? (
            <div className='settings-card space-top'>
              <div className='knowledge-filter-grid'>
                <label className='settings-item settings-item-vertical'>
                  <span>关键词</span>
                  <input value={query} placeholder='搜索标题或摘要' onChange={(event) => setQuery(event.target.value)} />
                </label>
                <label className='settings-item settings-item-vertical'>
                  <span>仓库 ID</span>
                  <input value={repoId} placeholder='repo id' onChange={(event) => setRepoId(event.target.value)} />
                </label>
                <label className='settings-item settings-item-vertical'>
                  <span>分类</span>
                  <input value={category} placeholder='例如：guide' onChange={(event) => setCategory(event.target.value)} />
                </label>
                <label className='settings-item settings-item-vertical knowledge-filter-tags'>
                  <span>标签</span>
                  <input value={tagFilter} placeholder='多个标签用逗号分隔' onChange={(event) => setTagFilter(event.target.value)} />
                </label>
              </div>
            </div>
          ) : (
            <div className='settings-card space-top'>
              <label className='settings-item settings-item-vertical'>
                <span>审核状态</span>
                <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
                  <option value=''>全部待处理</option>
                  <option value='pending_review'>pending_review</option>
                  <option value='approved'>approved</option>
                  <option value='changes_requested'>changes_requested</option>
                  <option value='rejected'>rejected</option>
                  <option value='published'>published</option>
                </select>
              </label>
            </div>
          )}

          <div className='knowledge-workbench-grid space-top'>
            <div className='knowledge-list-column'>
              <div className='panel'>
                <div className='panel-header'>
                  <h3>{mode === 'team' ? '团队共享知识' : '共享请求列表'}</h3>
                  <span className='small-text'>{loading ? '刷新中…' : `${currentItems.length} 条`}</span>
                </div>
                {error ? (
                  <p className='error-text'>{error}</p>
                ) : currentItems.length === 0 ? (
                  <p className='small-text'>当前条件下没有结果。</p>
                ) : (
                  <ul className='settings-list knowledge-entry-list'>
                    {currentItems.map((item) => (
                      <li key={item.id} className='settings-item settings-item-vertical'>
                        <button
                          type='button'
                          className={`knowledge-entry-button ${selectedShareId === item.id ? 'is-active' : ''}`}
                          onClick={() => setSelectedShareId(item.id)}
                        >
                          <div className='panel-header panel-header-tight'>
                            <strong>{item.entryTitle}</strong>
                            <span className='chip'>{item.reviewStatus}</span>
                          </div>
                          <p>{item.entrySummary}</p>
                          <div className='chip-row'>
                            <span className='chip'>{item.entryCategory}</span>
                            <span className='chip'>{item.visibility}</span>
                            {item.entryTags.map((tag) => (
                              <span key={`${item.id}-${tag}`} className='chip'>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className='knowledge-detail-column'>
              {selectedShare ? (
                <div className='settings-card'>
                  <div className='panel-header'>
                    <h3>{selectedShare.entryTitle}</h3>
                    <div className='row-actions'>
                      <button type='button' className='ghost-button' onClick={() => navigate(`/knowledge/${encodeURIComponent(selectedShare.entryId)}`)}>
                        打开知识详情
                      </button>
                    </div>
                  </div>
                  <p className='small-text'>
                    作者 {selectedShare.sourceAuthorName ?? selectedShare.sourceAuthorId} · 状态 {selectedShare.reviewStatus} · 可见性{' '}
                    {selectedShare.visibility}
                  </p>
                  <p>{selectedShare.entrySummary}</p>
                  {selectedShare.requestNote && <p className='small-text'>申请备注：{selectedShare.requestNote}</p>}
                  {selectedShare.reviewNote && <p className='small-text'>最新审核备注：{selectedShare.reviewNote}</p>}
                  {selectedShare.publishedAt && <p className='small-text'>发布时间：{new Date(selectedShare.publishedAt).toLocaleString('zh-CN')}</p>}

                  {mode === 'review' && (
                    <>
                      <label className='settings-item settings-item-vertical space-top'>
                        <span>审核备注</span>
                        <textarea rows={4} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
                      </label>
                      <div className='row-actions space-top'>
                        {(selectedShare.reviewStatus === 'pending_review' || selectedShare.reviewStatus === 'changes_requested') && (
                          <button type='button' className='primary-button' onClick={() => void runReview('approve')}>
                            批准
                          </button>
                        )}
                        {selectedShare.reviewStatus === 'approved' && (
                          <button type='button' className='primary-button' onClick={() => void runReview('publish')}>
                            发布
                          </button>
                        )}
                        {(selectedShare.reviewStatus === 'pending_review' || selectedShare.reviewStatus === 'approved') && (
                          <button type='button' className='ghost-button' onClick={() => void runReview('request_changes')}>
                            退回修改
                          </button>
                        )}
                        {(selectedShare.reviewStatus === 'pending_review' ||
                          selectedShare.reviewStatus === 'approved' ||
                          selectedShare.reviewStatus === 'changes_requested') && (
                          <button type='button' className='ghost-button' onClick={() => void runReview('reject')}>
                            驳回
                          </button>
                        )}
                        {selectedShare.reviewStatus === 'published' && (
                          <button type='button' className='ghost-button' onClick={() => void runReview('rollback')}>
                            回滚发布
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className='settings-card knowledge-empty-state'>
                  <h3>选择一条共享记录开始查看</h3>
                  <p className='small-text'>这里会展示共享状态、审核备注以及团队发布信息。</p>
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
