import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { CreateKnowledgeEntryInput, RepoRecord, SearchKnowledgeEntriesInput, UpdateKnowledgeEntryInput } from '../io/types';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import type {
  KnowledgeEntry,
  KnowledgeSearchResult,
  KnowledgeShareRecord,
  KnowledgeShareReview,
  KnowledgeStatus,
  KnowledgeVersion,
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

interface KnowledgeEditorState {
  id: string | null;
  title: string;
  content: string;
  summary: string;
  repoId: string;
  category: string;
  sourceSessionId: string | null;
  qualityScore: number;
  status: KnowledgeStatus;
  tags: string[];
  metadata: Record<string, unknown>;
}

const DEFAULT_STATUS: KnowledgeStatus = 'draft';

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

function formatTags(tags: string[]): string {
  return tags.join(', ');
}

function toEditorState(entry: KnowledgeEntry): KnowledgeEditorState {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    summary: entry.summary,
    repoId: entry.repoId,
    category: entry.category,
    sourceSessionId: entry.sourceSessionId,
    qualityScore: entry.qualityScore,
    status: entry.status,
    tags: [...entry.tags],
    metadata: entry.metadata
  };
}

function createEmptyEditor(repoId: string, sourceSessionId: string | null): KnowledgeEditorState {
  return {
    id: null,
    title: '',
    content: '',
    summary: '',
    repoId,
    category: 'general',
    sourceSessionId,
    qualityScore: 0,
    status: DEFAULT_STATUS,
    tags: [],
    metadata: {}
  };
}

function toCreateInput(editor: KnowledgeEditorState): CreateKnowledgeEntryInput {
  return {
    title: editor.title.trim(),
    content: editor.content,
    summary: editor.summary.trim() || undefined,
    repoId: editor.repoId || undefined,
    category: editor.category.trim() || undefined,
    sourceSessionId: editor.sourceSessionId,
    qualityScore: editor.qualityScore,
    status: editor.status,
    metadata: editor.metadata,
    tags: editor.tags
  };
}

function toUpdateInput(editor: KnowledgeEditorState): UpdateKnowledgeEntryInput {
  return {
    title: editor.title.trim(),
    content: editor.content,
    summary: editor.summary.trim() || undefined,
    category: editor.category.trim() || undefined,
    sourceSessionId: editor.sourceSessionId,
    qualityScore: editor.qualityScore,
    status: editor.status,
    metadata: editor.metadata,
    tags: editor.tags,
    changeSummary: 'knowledge-page-save'
  };
}

export function KnowledgePage() {
  const navigate = useNavigate();
  const { entryId } = useParams<{ entryId?: string }>();
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [repos, setRepos] = useState<RepoRecord[]>([]);
  const [items, setItems] = useState<Array<KnowledgeEntry | KnowledgeSearchResult>>([]);
  const [editor, setEditor] = useState<KnowledgeEditorState | null>(null);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<string>('');
  const [tagFilter, setTagFilter] = useState('');
  const [repoFilter, setRepoFilter] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareVisibility, setShareVisibility] = useState<'workspace' | 'team'>('team');
  const [shareNote, setShareNote] = useState('');
  const [shareState, setShareState] = useState<{ item: KnowledgeShareRecord | null; reviews: KnowledgeShareReview[] } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const currentSession = useMemo(
    () => state.sessions.find((item) => item.id === state.currentSessionId) ?? null,
    [state.currentSessionId, state.sessions]
  );

  const filteredTags = useMemo(() => parseTags(tagFilter), [tagFilter]);
  const currentRepoId = currentSession?.repoId ?? '';
  const selectedListId = editor?.id ?? entryId ?? null;

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
        const [sessions, repoItems] = await Promise.all([io.listSessions(), io.listRepos()]);
        if (cancelled) {
          return;
        }
        dispatch({ type: 'set_sessions', sessions });
        setRepos(repoItems);
        setRepoFilter((current) => current || currentRepoId || repoItems[0]?.id || '');
      } catch (incoming) {
        if (!cancelled) {
          setError(incoming instanceof Error ? incoming.message : '加载知识工作台失败');
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
  }, [currentRepoId, dispatch, io]);

  useEffect(() => {
    if (editor && editor.id === null && !editor.repoId && repoFilter) {
      setEditor((current) => (current && current.id === null ? { ...current, repoId: repoFilter } : current));
    }
  }, [editor, repoFilter]);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setError(null);

    const request: SearchKnowledgeEntriesInput = {
      repoId: repoFilter || undefined,
      category: category.trim() || undefined,
      status: (status || undefined) as KnowledgeStatus | undefined,
      tags: filteredTags,
      limit: 100
    };

    void (async () => {
      try {
        const nextItems = query.trim()
          ? await io.searchKnowledgeEntries({ ...request, keyword: query.trim() })
          : await io.listKnowledgeEntries(request);
        if (!cancelled) {
          setItems(nextItems);
        }
      } catch (incoming) {
        if (!cancelled) {
          setError(incoming instanceof Error ? incoming.message : '加载知识列表失败');
        }
      } finally {
        if (!cancelled) {
          setListLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category, filteredTags, io, query, repoFilter, status]);

  useEffect(() => {
    let cancelled = false;
    if (!entryId) {
      if (editor?.id) {
        setEditor(null);
      }
      setVersions([]);
      setShareState(null);
      setShareError(null);
      setDetailError(null);
      return undefined;
    }

    setDetailLoading(true);
    setDetailError(null);
    void (async () => {
      try {
        const [entry, nextVersions, nextShareState] = await Promise.all([
          io.getKnowledgeEntry(entryId),
          io.getKnowledgeVersions(entryId),
          io.getKnowledgeShareByEntry(entryId)
        ]);
        if (cancelled) {
          return;
        }
        if (!entry) {
          setEditor(null);
          setVersions([]);
          setShareState(null);
          setDetailError('知识条目不存在或已被删除。');
          return;
        }
        setEditor(toEditorState(entry));
        setVersions(nextVersions);
        setShareState(nextShareState);
        if (nextShareState.item?.visibility === 'workspace' || nextShareState.item?.visibility === 'team') {
          setShareVisibility(nextShareState.item.visibility);
        }
      } catch (incoming) {
        if (!cancelled) {
          setDetailError(incoming instanceof Error ? incoming.message : '加载知识详情失败');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editor?.id, entryId, io]);

  const openNewEntry = (): void => {
    const nextRepoId = repoFilter || currentRepoId || repos[0]?.id || '';
    setDetailError(null);
    setShareError(null);
    setVersions([]);
    setShareState(null);
    setShareNote('');
    setShareVisibility('team');
    setEditor(createEmptyEditor(nextRepoId, state.currentSessionId));
    navigate('/knowledge');
  };

  const selectEntry = (knowledgeId: string): void => {
    navigate(`/knowledge/${encodeURIComponent(knowledgeId)}`);
  };

  const refreshShareState = async (knowledgeId: string): Promise<void> => {
    const payload = await io.getKnowledgeShareByEntry(knowledgeId);
    setShareState(payload);
    if (payload.item?.visibility === 'workspace' || payload.item?.visibility === 'team') {
      setShareVisibility(payload.item.visibility);
    }
  };

  const refreshItems = async (): Promise<void> => {
    const request: SearchKnowledgeEntriesInput = {
      repoId: repoFilter || undefined,
      category: category.trim() || undefined,
      status: (status || undefined) as KnowledgeStatus | undefined,
      tags: filteredTags,
      limit: 100
    };
    const nextItems = query.trim()
      ? await io.searchKnowledgeEntries({ ...request, keyword: query.trim() })
      : await io.listKnowledgeEntries(request);
    setItems(nextItems);
  };

  const saveEntry = async (): Promise<void> => {
    if (!editor) {
      return;
    }
    if (!editor.title.trim() || !editor.content.trim()) {
      setDetailError('标题和内容不能为空。');
      return;
    }
    if (!editor.repoId.trim()) {
      setDetailError('请选择知识所属仓库。');
      return;
    }

    setSaving(true);
    setDetailError(null);
    try {
      const saved = editor.id
        ? await io.updateKnowledgeEntry(editor.id, toUpdateInput(editor))
        : await io.createKnowledgeEntry(toCreateInput(editor));
      const [nextVersions, nextShareState] = await Promise.all([
        io.getKnowledgeVersions(saved.id),
        io.getKnowledgeShareByEntry(saved.id)
      ]);
      await refreshItems();
      setEditor(toEditorState(saved));
      setVersions(nextVersions);
      setShareState(nextShareState);
      navigate(`/knowledge/${encodeURIComponent(saved.id)}`);
    } catch (incoming) {
      setDetailError(incoming instanceof Error ? incoming.message : '保存知识失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (): Promise<void> => {
    if (!editor?.id) {
      return;
    }

    setDeleting(true);
    setDetailError(null);
    try {
      await io.deleteKnowledgeEntry(editor.id);
      await refreshItems();
      setEditor(null);
      setVersions([]);
      setShareState(null);
      navigate('/knowledge');
    } catch (incoming) {
      setDetailError(incoming instanceof Error ? incoming.message : '删除知识失败');
    } finally {
      setDeleting(false);
    }
  };

  const requestShare = async (): Promise<void> => {
    if (!editor?.id) {
      return;
    }

    setSharing(true);
    setShareError(null);
    try {
      await io.requestKnowledgeShare(editor.id, shareVisibility, shareNote.trim() || undefined);
      await refreshShareState(editor.id);
      setVersions(await io.getKnowledgeVersions(editor.id));
      setShareNote('');
    } catch (incoming) {
      setShareError(incoming instanceof Error ? incoming.message : '发起知识共享失败');
    } finally {
      setSharing(false);
    }
  };

  const shareItem = shareState?.item ?? null;
  const canSubmitShare = Boolean(
    editor?.id &&
      (!shareItem ||
        shareItem.reviewStatus === 'rejected' ||
        shareItem.reviewStatus === 'changes_requested')
  );

  const emptyDetail = !editor && !entryId;

  return (
    <ShellLayout
      topbarContext={{ title: 'Knowledge' }}
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
              <h2>Knowledge</h2>
              <p className='small-text'>搜索、筛选、浏览和编辑知识条目，并查看版本历史。</p>
            </div>
            <div className='row-actions'>
              <button type='button' className='primary-button' data-testid='knowledge-new-entry' onClick={openNewEntry}>
                新建知识
              </button>
              <button type='button' className='ghost-button' onClick={() => navigate('/knowledge/sharing')}>
                审核队列
              </button>
              <button type='button' className='ghost-button' onClick={() => navigate('/knowledge/team')}>
                团队知识
              </button>
            </div>
          </header>

          {bootstrapLoading ? (
            <p>加载中...</p>
          ) : (
            <div className='knowledge-workbench-grid'>
              <div className='knowledge-list-column'>
                <div className='settings-card'>
                  <div className='panel-header'>
                    <h3>搜索与筛选</h3>
                  </div>
                  <div className='knowledge-filter-grid'>
                    <label className='settings-item settings-item-vertical'>
                      <span>关键词</span>
                      <input
                        data-testid='knowledge-search-input'
                        value={query}
                        placeholder='搜索标题、内容或摘要'
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <label className='settings-item settings-item-vertical'>
                      <span>仓库</span>
                      <select data-testid='knowledge-repo-filter' value={repoFilter} onChange={(event) => setRepoFilter(event.target.value)}>
                        <option value=''>全部仓库</option>
                        {repos.map((repo) => (
                          <option key={repo.id} value={repo.id}>
                            {repo.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className='settings-item settings-item-vertical'>
                      <span>分类</span>
                      <input value={category} placeholder='例如：guide' onChange={(event) => setCategory(event.target.value)} />
                    </label>
                    <label className='settings-item settings-item-vertical'>
                      <span>状态</span>
                      <select data-testid='knowledge-status-filter' value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value=''>全部状态</option>
                        <option value='draft'>draft</option>
                        <option value='published'>published</option>
                        <option value='stale'>stale</option>
                        <option value='archived'>archived</option>
                      </select>
                    </label>
                    <label className='settings-item settings-item-vertical knowledge-filter-tags'>
                      <span>标签</span>
                      <input value={tagFilter} placeholder='多个标签用逗号分隔' onChange={(event) => setTagFilter(event.target.value)} />
                    </label>
                  </div>
                </div>

                <div className='panel space-top'>
                  <div className='panel-header'>
                    <h3>知识列表</h3>
                    <span className='small-text'>{listLoading ? '刷新中…' : `${items.length} 条结果`}</span>
                  </div>
                  {error ? (
                    <p className='error-text'>{error}</p>
                  ) : items.length === 0 ? (
                    <p className='small-text'>当前筛选条件下没有知识条目。</p>
                  ) : (
                    <ul className='settings-list knowledge-entry-list'>
                      {items.map((item) => {
                        const summary = 'snippet' in item && item.snippet ? item.snippet : item.summary;
                        return (
                          <li key={item.id} className='settings-item settings-item-vertical'>
                            <button
                              type='button'
                              className={`knowledge-entry-button ${selectedListId === item.id ? 'is-active' : ''}`}
                              data-testid={`knowledge-entry-${item.id}`}
                              onClick={() => selectEntry(item.id)}
                            >
                              <div className='panel-header panel-header-tight'>
                                <strong>{item.title}</strong>
                                <span className='chip'>{item.status}</span>
                              </div>
                              <p>{summary}</p>
                              <div className='chip-row'>
                                <span className='chip'>{item.category}</span>
                                {item.tags.map((tag) => (
                                  <span key={`${item.id}-${tag}`} className='chip'>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className='knowledge-detail-column'>
                {detailLoading ? (
                  <div className='settings-card'>
                    <p>正在加载知识详情…</p>
                  </div>
                ) : detailError ? (
                  <div className='settings-card'>
                    <p className='error-text'>{detailError}</p>
                  </div>
                ) : emptyDetail ? (
                  <div className='settings-card knowledge-empty-state'>
                    <h3>选择一条知识开始查看</h3>
                    <p className='small-text'>你也可以直接新建一条知识，把当前经验沉淀进知识库。</p>
                  </div>
                ) : editor ? (
                  <>
                    <div className='settings-card'>
                      <div className='panel-header'>
                        <h3>{editor.id ? '知识详情' : '新建知识'}</h3>
                        <div className='row-actions'>
                          <button
                            type='button'
                            className='primary-button'
                            data-testid='knowledge-save-button'
                            onClick={() => void saveEntry()}
                            disabled={saving}
                          >
                            {saving ? '保存中…' : '保存'}
                          </button>
                          {editor.id && (
                            <button
                              type='button'
                              className='danger-button'
                              data-testid='knowledge-delete-button'
                              onClick={() => void deleteEntry()}
                              disabled={deleting}
                            >
                              {deleting ? '删除中…' : '删除'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className='knowledge-editor'>
                        <label className='settings-item settings-item-vertical'>
                          <span>标题</span>
                          <input
                            data-testid='knowledge-title-input'
                            value={editor.title}
                            onChange={(event) => setEditor((current) => (current ? { ...current, title: event.target.value } : current))}
                          />
                        </label>
                        <label className='settings-item settings-item-vertical'>
                          <span>摘要</span>
                          <input
                            data-testid='knowledge-summary-input'
                            value={editor.summary}
                            onChange={(event) => setEditor((current) => (current ? { ...current, summary: event.target.value } : current))}
                          />
                        </label>
                        <div className='knowledge-editor-meta'>
                          <label className='settings-item settings-item-vertical'>
                            <span>仓库</span>
                            <select
                              data-testid='knowledge-editor-repo'
                              value={editor.repoId}
                              onChange={(event) => setEditor((current) => (current ? { ...current, repoId: event.target.value } : current))}
                            >
                              <option value=''>选择仓库</option>
                              {repos.map((repo) => (
                                <option key={repo.id} value={repo.id}>
                                  {repo.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className='settings-item settings-item-vertical'>
                            <span>分类</span>
                            <input
                              value={editor.category}
                              onChange={(event) => setEditor((current) => (current ? { ...current, category: event.target.value } : current))}
                            />
                          </label>
                          <label className='settings-item settings-item-vertical'>
                            <span>状态</span>
                            <select
                              data-testid='knowledge-editor-status'
                              value={editor.status}
                              onChange={(event) =>
                                setEditor((current) =>
                                  current ? { ...current, status: event.target.value as KnowledgeStatus } : current
                                )
                              }
                            >
                              <option value='draft'>draft</option>
                              <option value='published'>published</option>
                              <option value='stale'>stale</option>
                              <option value='archived'>archived</option>
                            </select>
                          </label>
                        </div>
                        <label className='settings-item settings-item-vertical'>
                          <span>标签</span>
                          <input
                            data-testid='knowledge-tags-input'
                            value={formatTags(editor.tags)}
                            placeholder='例如：sqlite, guide'
                            onChange={(event) =>
                              setEditor((current) => (current ? { ...current, tags: parseTags(event.target.value) } : current))
                            }
                          />
                        </label>
                        <label className='settings-item settings-item-vertical'>
                          <span>正文</span>
                          <textarea
                            data-testid='knowledge-content-input'
                            rows={14}
                            value={editor.content}
                            onChange={(event) => setEditor((current) => (current ? { ...current, content: event.target.value } : current))}
                          />
                        </label>
                        {editor.id && (
                          <p className='small-text'>
                            版本 {versions[versions.length - 1]?.version ?? '—'} · 来源会话 {editor.sourceSessionId ?? '无'} · 质量分{' '}
                            {editor.qualityScore}
                          </p>
                        )}
                      </div>
                    </div>

                    {editor.id && (
                      <div className='panel space-top'>
                        <div className='panel-header'>
                          <h3>知识共享</h3>
                          {shareItem ? <span className='chip'>{shareItem.reviewStatus}</span> : <span className='chip'>not_shared</span>}
                        </div>
                        <p className='small-text'>
                          {shareItem
                            ? `可见性 ${shareItem.visibility} · 作者 ${shareItem.sourceAuthorName ?? shareItem.sourceAuthorId}`
                            : '当前条目还没有发起共享请求。'}
                        </p>
                        {shareItem?.requestNote && <p className='small-text'>申请备注：{shareItem.requestNote}</p>}
                        {shareItem?.reviewNote && <p className='small-text'>审核反馈：{shareItem.reviewNote}</p>}
                        {shareError && <p className='error-text'>{shareError}</p>}
                        <div className='knowledge-editor-meta space-top'>
                          <label className='settings-item settings-item-vertical'>
                            <span>共享范围</span>
                            <select
                              value={shareVisibility}
                              onChange={(event) => setShareVisibility(event.target.value as 'workspace' | 'team')}
                            >
                              <option value='workspace'>workspace</option>
                              <option value='team'>team</option>
                            </select>
                          </label>
                          <label className='settings-item settings-item-vertical knowledge-filter-tags'>
                            <span>共享备注</span>
                            <input
                              value={shareNote}
                              placeholder='给审核人的补充说明'
                              onChange={(event) => setShareNote(event.target.value)}
                            />
                          </label>
                        </div>
                        <div className='row-actions space-top'>
                          <button
                            type='button'
                            className='primary-button'
                            data-testid='knowledge-share-button'
                            onClick={() => void requestShare()}
                            disabled={!canSubmitShare || sharing}
                          >
                            {sharing
                              ? '提交中…'
                              : shareItem?.reviewStatus === 'rejected' || shareItem?.reviewStatus === 'changes_requested'
                                ? '重新提交共享'
                                : '发起共享'}
                          </button>
                          <button type='button' className='ghost-button' onClick={() => navigate('/knowledge/sharing')}>
                            查看审核队列
                          </button>
                          <button type='button' className='ghost-button' onClick={() => navigate('/knowledge/team')}>
                            查看团队知识
                          </button>
                        </div>
                        {shareState && shareState.reviews.length > 0 && (
                          <ul className='settings-list knowledge-version-list space-top'>
                            {shareState.reviews.slice(0, 3).map((review) => (
                              <li key={review.id} className='settings-item settings-item-vertical'>
                                <div className='panel-header panel-header-tight'>
                                  <strong>{review.action}</strong>
                                  <span className='small-text'>{new Date(review.createdAt).toLocaleString('zh-CN')}</span>
                                </div>
                                <p>{review.note ?? '无备注'}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {editor.id && (
                      <div className='panel space-top'>
                        <div className='panel-header'>
                          <h3>版本历史</h3>
                        </div>
                        {versions.length === 0 ? (
                          <p className='small-text'>暂无版本历史。</p>
                        ) : (
                          <ul className='settings-list knowledge-version-list' data-testid='knowledge-version-list'>
                            {versions.map((version) => (
                              <li key={version.id} className='settings-item settings-item-vertical'>
                                <div className='panel-header panel-header-tight'>
                                  <strong>v{version.version}</strong>
                                  <span className='small-text'>{new Date(version.createdAt).toLocaleString('zh-CN')}</span>
                                </div>
                                <p>{version.changeSummary ?? '无变更说明'}</p>
                                <p className='small-text knowledge-entry-preview'>{version.summary || version.content.slice(0, 120)}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
