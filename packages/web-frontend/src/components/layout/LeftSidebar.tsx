import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ContinueWorkCandidate, SessionInfo } from '../../types/domain';

const COMMAND_PALETTE_EVENT = 'okk:command-palette';
const MORE_TOOLS_STORAGE_KEY = 'okk.sidebar.more-tools-expanded';

interface LeftSidebarProps {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  continueCandidate?: ContinueWorkCandidate | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onArchiveSession?: (sessionId: string) => void;
  onRestoreSession?: (sessionId: string) => void;
  onReferenceSession?: (sessionId: string) => void;
  onContinueProjectContext?: () => void;
  onSaveProjectContext?: () => void;
  onRefreshProjectContext?: () => void;
}

interface NavLinkItem {
  id: string;
  label: string;
  to: string;
  active: boolean;
}

const PRIMARY_LINK_IDS = new Set(['chat', 'knowledge', 'identity', 'memory', 'workspaces']);
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

function readMoreToolsExpanded(): boolean {
  try {
    return window.localStorage.getItem(MORE_TOOLS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistMoreToolsExpanded(expanded: boolean): void {
  try {
    window.localStorage.setItem(MORE_TOOLS_STORAGE_KEY, expanded ? '1' : '0');
  } catch {
    // ignore persistence failure
  }
}

export function LeftSidebar({
  sessions,
  currentSessionId,
  continueCandidate = null,
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
  const [moreToolsExpanded, setMoreToolsExpanded] = useState<boolean>(() => readMoreToolsExpanded());
  const location = useLocation();
  const inChat = location.pathname === '/';
  const inKnowledgeImports = location.pathname === '/imports' || location.pathname === '/knowledge/imports';
  const normalizedSessionQuery = sessionQuery.trim().toLowerCase();

  useEffect(() => {
    persistMoreToolsExpanded(moreToolsExpanded);
  }, [moreToolsExpanded]);

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

  const navigationLinks = useMemo<NavLinkItem[]>(
    () => [
      { id: 'chat', label: 'Chats', to: '/', active: inChat },
      {
        id: 'knowledge',
        label: 'Knowledge',
        to: '/knowledge',
        active: (location.pathname === '/knowledge' || location.pathname.startsWith('/knowledge/')) && !inKnowledgeImports
      },
      { id: 'identity', label: 'Identity', to: '/identity', active: location.pathname === '/identity' },
      { id: 'memory', label: 'Memory', to: '/memory', active: location.pathname === '/memory' },
      { id: 'workspaces', label: 'Workspaces', to: '/workspaces', active: location.pathname === '/workspaces' },
      { id: 'skills', label: 'Skills', to: '/skills', active: location.pathname === '/skills' },
      { id: 'mcp', label: 'MCP', to: '/settings/mcp', active: location.pathname === '/settings/mcp' },
      { id: 'governance', label: 'Governance', to: '/governance', active: location.pathname === '/governance' },
      { id: 'imports', label: 'Imports', to: '/imports', active: inKnowledgeImports },
      { id: 'workflows', label: 'Workflows', to: '/workflows', active: location.pathname === '/workflows' },
      { id: 'memory-sharing', label: 'Sharing', to: '/memory-sharing', active: location.pathname === '/memory-sharing' }
    ],
    [inChat, inKnowledgeImports, location.pathname]
  );

  const primaryLinks = useMemo(
    () => navigationLinks.filter((link) => PRIMARY_LINK_IDS.has(link.id)),
    [navigationLinks]
  );
  const secondaryLinks = useMemo(
    () => navigationLinks.filter((link) => !PRIMARY_LINK_IDS.has(link.id)),
    [navigationLinks]
  );
  const hasContinueSection = Boolean(continueCandidate || onContinueProjectContext);

  return (
    <section className='panel left-sidebar-panel'>
      <p className='eyebrow sidebar-section-label'>New chat</p>
      <button type='button' className='primary-button session-create-button sidebar-new-chat' onClick={onCreateSession}>
        <span aria-hidden='true'>+</span>
        <span>New chat</span>
      </button>

      {hasContinueSection && (
        <div className='sidebar-section'>
          <p className='sidebar-section-label'>Continue work</p>
          {continueCandidate ? (
            <div className='sidebar-project-context sidebar-continue-card' data-testid='sidebar-project-context'>
              <p className='small-text'>继续入口：{continueCandidate.title}</p>
              {continueCandidate.repoName ? <p className='small-text'>当前仓库：{continueCandidate.repoName}</p> : null}
              <p className='small-text'>最近活动：{continueCandidate.summary}</p>
              <div className='row-actions'>
                {onContinueProjectContext && (
                  <button
                    type='button'
                    className='small-button'
                    data-testid='sidebar-project-continue'
                    onClick={onContinueProjectContext}
                    disabled={Boolean(continueCandidate.loading)}
                  >
                    {continueCandidate.loading ? '同步中…' : '继续上次工作'}
                  </button>
                )}
                {continueCandidate.source === 'repo' && onSaveProjectContext && (
                  <button
                    type='button'
                    className='ghost-button small-button'
                    data-testid='sidebar-project-save'
                    onClick={onSaveProjectContext}
                  >
                    记住当前偏好
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className='small-text'>当前还没有可继续的历史，先开始一段新的协作吧。</p>
          )}
        </div>
      )}

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
        <div className='sidebar-section-header'>
          <p className='sidebar-section-label'>More tools</p>
          <button
            type='button'
            className='ghost-button small-button sidebar-more-tools-toggle'
            data-testid='sidebar-more-tools-toggle'
            aria-expanded={moreToolsExpanded ? 'true' : 'false'}
            onClick={() => setMoreToolsExpanded((value) => !value)}
          >
            {moreToolsExpanded ? '收起' : '展开'}
          </button>
        </div>
        {moreToolsExpanded ? (
          <nav className='sidebar-primary-nav sidebar-secondary-nav' aria-label='更多工具导航'>
            {secondaryLinks.map((link) => (
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
        ) : (
          <p className='sidebar-section-hint sidebar-more-tools-hint'>默认收起次级工具，保持主任务入口聚焦。</p>
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
