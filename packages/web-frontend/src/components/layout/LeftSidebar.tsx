import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { SessionInfo } from '../../types/domain';

interface LeftSidebarProps {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
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

  if (absoluteDelta < 60 * 60 * 24 * 7) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / (60 * 60 * 24)), 'day');
  }

  if (absoluteDelta < 60 * 60 * 24 * 30) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / (60 * 60 * 24 * 7)), 'week');
  }

  if (absoluteDelta < 60 * 60 * 24 * 365) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / (60 * 60 * 24 * 30)), 'month');
  }

  return relativeTimeFormatter.format(Math.round(deltaSeconds / (60 * 60 * 24 * 365)), 'year');
}

function formatAbsoluteTime(value: string): string {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return '时间未知';
  }

  return target.toLocaleString('zh-CN', { hour12: false });
}

export function LeftSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession
}: LeftSidebarProps) {
  const [sessionQuery, setSessionQuery] = useState('');
  const location = useLocation();
  const inChat = location.pathname === '/';
  const normalizedSessionQuery = sessionQuery.trim().toLowerCase();
  const filteredSessions = useMemo(() => {
    if (!normalizedSessionQuery) {
      return sessions;
    }
    return sessions.filter((session) => {
      const title = session.title || '未命名会话';
      return title.toLowerCase().includes(normalizedSessionQuery);
    });
  }, [normalizedSessionQuery, sessions]);
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

  return (
    <section className='panel left-sidebar-panel'>
      <button type='button' className='primary-button session-create-button sidebar-new-chat' onClick={onCreateSession}>
        <span aria-hidden='true'>+</span>
        <span>New chat</span>
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
      <nav className='sidebar-primary-nav' aria-label='主导航'>
        <Link data-testid='nav-chat' className={`sidebar-link ${inChat ? 'active' : ''}`} to='/' aria-current={inChat ? 'page' : undefined}>
          Chats
        </Link>
        <Link
          data-testid='nav-mcp'
          className={`sidebar-link ${location.pathname === '/settings/mcp' ? 'active' : ''}`}
          to='/settings/mcp'
          aria-current={location.pathname === '/settings/mcp' ? 'page' : undefined}
        >
          MCP
        </Link>
        <Link
          data-testid='nav-skills'
          className={`sidebar-link ${location.pathname === '/skills' ? 'active' : ''}`}
          to='/skills'
          aria-current={location.pathname === '/skills' ? 'page' : undefined}
        >
          Skills
        </Link>
      </nav>
      <div className='panel-header panel-header-tight sidebar-chat-title'>
        <h2>Chats</h2>
        <span className='small-text'>{filteredSessions.length}</span>
      </div>
      {sessions.length === 0 ? (
        <p className='empty-hint'>暂无会话，点击“New Chat”开始提问。</p>
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
                      <button
                        type='button'
                        className={`session-item ${isActive ? 'active' : ''}`}
                        onClick={() => onSelectSession(session.id)}
                        aria-pressed={isActive}
                      >
                        <span className='session-title-row'>
                          <span className='session-title'>{session.title || '未命名会话'}</span>
                          {isActive ? <span className='session-current-badge'>当前</span> : null}
                        </span>
                        <time
                          className='timestamp'
                          dateTime={session.updatedAt}
                          title={absoluteUpdatedAt}
                          aria-label={`最近更新 ${relativeUpdatedAt}，具体时间 ${absoluteUpdatedAt}`}
                        >
                          {relativeUpdatedAt}
                        </time>
                      </button>
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

