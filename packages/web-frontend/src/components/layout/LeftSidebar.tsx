import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { SessionInfo } from '../../types/domain';

const COMMAND_PALETTE_EVENT = 'okk:command-palette';

interface ProjectContextSummary {
  repoName: string;
  preferredAgentName?: string | null;
  lastActivitySummary?: string | null;
  loading?: boolean;
  error?: string | null;
}

interface LeftSidebarProps {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  projectContext?: ProjectContextSummary | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onArchiveSession?: (sessionId: string) => void;
  onRestoreSession?: (sessionId: string) => void;
  onReferenceSession?: (sessionId: string) => void;
  onContinueProjectContext?: () => void;
  onSaveProjectContext?: () => void;
  onRefreshProjectContext?: () => void;
}

interface PrimaryLinkItem {
  id: string;
  label: string;
  to: string;
  active: boolean;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

function formatRelativeTime(value: string): string {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return '时间未知';
  }

  const deltaSeconds = Math.round((target.getTime() - Date.now()) / 1000);
  const absoluteDelta = Math.abs(deltaSeconds);

  if (absoluteDelta < 60) {
    return '刚刚';
  }

  if (absoluteDelta < 60 * 60) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / 60), 'minute');
  }

  if (absoluteDelta < 60 * 60 * 24) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / (60 * 60)), 'hour');
  }

  return relativeTimeFormatter.format(Math.round(deltaSeconds / (60 * 60 * 24)), 'day');
}

function formatAbsoluteTime(value: string): string {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return '时间未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(target);
}

export function LeftSidebar({
  sessions,
  currentSessionId,
  projectContext = null,
  onSelectSession,
  onCreateSession,
  onArchiveSession,
  onRestoreSession,
  onReferenceSession,
  onContinueProjectContext,
  onSaveProjectContext,
  onRefreshProjectContext
}: LeftSidebarProps) {
  const [sessionQuery, setSessionQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const location = useLocation();
  const inChat = location.pathname === '/';
  const normalizedSessionQuery = sessionQuery.trim().toLowerCase();
  const filteredSessions = useMemo(() => {
    const scopedSessions = sessions.filter((session) =>
      showArchived ? Boolean(session.archivedAt) : !session.archivedAt
    );
    if (!normalizedSessionQuery) {
      return scopedSessions;
    }
    return scopedSessions.filter((session) => {
      const title = session.title || '未命名会话';
      const summary = session.summary || '';
      const tags = (session.tags ?? []).join(' ');
      const haystack = [title, summary, tags].join(' ').toLowerCase();
      return haystack.includes(normalizedSessionQuery);
    });
  }, [normalizedSessionQuery, sessions, showArchived]);
  const groupedSessions = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const lastWeekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const groups = {
      today: [] as SessionInfo[],
      yesterday: [] as SessionInfo[],
      last7Days: [] as SessionInfo[],
      earlier: [] as SessionInfo[]
    };

    filteredSessions.forEach((session) => {
      const value = new Date(session.updatedAt).getTime();
      if (Number.isNaN(value)) {
        groups.earlier.push(session);
        return;
      }
      if (value >= todayStart) {
        groups.today.push(session);
        return;
      }
      if (value >= yesterdayStart) {
        groups.yesterday.push(session);
        return;
      }
      if (value >= lastWeekStart) {
        groups.last7Days.push(session);
        return;
      }
      groups.earlier.push(session);
    });

    return [
      { key: 'today', label: '今天', items: groups.today },
      { key: 'yesterday', label: '昨天', items: groups.yesterday },
      { key: 'last7Days', label: '近 7 天', items: groups.last7Days },
      { key: 'earlier', label: '更早', items: groups.earlier }
    ].filter((group) => group.items.length > 0);
  }, [filteredSessions]);
  const primaryLinks = useMemo<PrimaryLinkItem[]>(
    () => [
      { id: 'chat', label: 'Chats', to: '/', active: inChat },
      { id: 'mcp', label: 'MCP', to: '/settings/mcp', active: location.pathname === '/settings/mcp' },
      { id: 'skills', label: 'Skills', to: '/skills', active: location.pathname === '/skills' }
    ],
    [inChat, location.pathname]
  );

  return (
    <section className='panel left-sidebar-panel'>
      <p className='eyebrow sidebar-section-label'>New chat</p>
      <button type='button' className='primary-button session-create-button sidebar-new-chat' onClick={onCreateSession}>
        <span aria-hidden='true'>+</span>
        <span>New chat</span>
      </button>

      <div className='sidebar-section'>
        <p className='sidebar-section-label'>Search</p>
        <button
          type='button'
          className='sidebar-link sidebar-link-button'
          data-testid='sidebar-search-trigger'
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(COMMAND_PALETTE_EVENT, {
                detail: {
                  query: sessionQuery.trim()
                }
              })
            )
          }
        >
          <span className='sidebar-link-icon' aria-hidden='true'>
            /
          </span>
          <span className='sidebar-link-label'>Open command palette</span>
        </button>
        <label className='session-search'>
          <span className='sr-only'>筛选会话</span>
          <input
            data-testid='session-search-input'
            value={sessionQuery}
            placeholder='Search chats'
            onChange={(event) => setSessionQuery(event.target.value)}
          />
        </label>
        <p className='sidebar-section-hint'>快速筛选历史会话，保持当前工作台上下文不跳转。</p>
        <button
          type='button'
          className='ghost-button small-button'
          data-testid='sidebar-archived-toggle'
          onClick={() => setShowArchived((value) => !value)}
        >
          {showArchived ? '查看活跃会话' : '查看归档会话'}
        </button>
      </div>

      <div className='sidebar-section'>
        <p className='sidebar-section-label'>Primary links</p>
        <nav className='sidebar-primary-nav' aria-label='主导航'>
          {primaryLinks.map((link) => (
            <Link
              key={link.id}
              data-testid={`nav-${link.id}`}
              className={`sidebar-link ${link.active ? 'active' : ''}`}
              to={link.to}
              aria-current={link.active ? 'page' : undefined}
            >
              <span className='sidebar-link-icon' aria-hidden='true'>
                ◦
              </span>
              <span className='sidebar-link-label'>{link.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className='sidebar-section'>
        <p className='sidebar-section-label'>Project context</p>
        {projectContext?.loading ? (
          <p className='small-text'>正在同步项目上下文…</p>
        ) : projectContext?.error ? (
          <>
            <p className='small-text'>{projectContext.error}</p>
            {onRefreshProjectContext && (
              <button type='button' className='small-button' data-testid='sidebar-project-refresh' onClick={onRefreshProjectContext}>
                刷新
              </button>
            )}
          </>
        ) : projectContext ? (
          <div className='sidebar-project-context' data-testid='sidebar-project-context'>
            <p className='small-text'>当前仓库：{projectContext.repoName}</p>
            <p className='small-text'>偏好 Agent：{projectContext.preferredAgentName || '未设置'}</p>
            <p className='small-text'>最近活动：{projectContext.lastActivitySummary || '暂无记录'}</p>
            <div className='row-actions'>
              {onContinueProjectContext && (
                <button type='button' className='small-button' data-testid='sidebar-project-continue' onClick={onContinueProjectContext}>
                  继续上次工作
                </button>
              )}
              {onSaveProjectContext && (
                <button type='button' className='ghost-button small-button' data-testid='sidebar-project-save' onClick={onSaveProjectContext}>
                  记住当前偏好
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className='small-text'>切换到具体会话后会显示仓库级上下文与继续工作入口。</p>
        )}
      </div>

      <p className='eyebrow sidebar-section-label sidebar-chat-title'>Chats</p>
      {sessions.length === 0 ? (
        <p className='empty-hint'>还没有和赛博合伙人的历史协作。</p>
      ) : filteredSessions.length === 0 ? (
        <p className='empty-hint'>没有匹配“{sessionQuery.trim()}”的会话。</p>
      ) : (
        <ul className='session-list'>
          {groupedSessions.map((group) => (
            <li key={group.key} className='session-group'>
              <p className='session-group-label'>{group.label}</p>
              <ul className='session-list session-list-nested'>
                {group.items.map((session) => {
                  const isActive = session.id === currentSessionId;
                  const relativeUpdatedAt = formatRelativeTime(session.updatedAt);
                  const absoluteUpdatedAt = formatAbsoluteTime(session.updatedAt);

                  return (
                    <li key={session.id}>
                      <div className={`session-item ${isActive ? 'active' : ''}`}>
                        <button
                          type='button'
                          className='session-item-main'
                          onClick={() => onSelectSession(session.id)}
                          aria-pressed={isActive}
                        >
                          <span className='session-title-row'>
                            <span className='session-title'>{session.title || '未命名会话'}</span>
                          </span>
                          {session.summary ? <span className='small-text'>{session.summary}</span> : null}
                          <time
                            className='timestamp'
                            dateTime={session.updatedAt}
                            title={absoluteUpdatedAt}
                            aria-label={`最近更新 ${relativeUpdatedAt}，具体时间 ${absoluteUpdatedAt}`}
                          >
                            {relativeUpdatedAt}
                          </time>
                        </button>
                        <div className='row-actions'>
                          {onReferenceSession && !showArchived && (
                            <button
                              type='button'
                              className='ghost-button small-button'
                              data-testid={`session-reference-${session.id}`}
                              onClick={() => onReferenceSession(session.id)}
                            >
                              引用
                            </button>
                          )}
                          {showArchived ? (
                            onRestoreSession && (
                              <button
                                type='button'
                                className='ghost-button small-button'
                                data-testid={`session-restore-${session.id}`}
                                onClick={() => onRestoreSession(session.id)}
                              >
                                恢复
                              </button>
                            )
                          ) : (
                            onArchiveSession && (
                              <button
                                type='button'
                                className='ghost-button small-button'
                                data-testid={`session-archive-${session.id}`}
                                onClick={() => onArchiveSession(session.id)}
                              >
                                归档
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
