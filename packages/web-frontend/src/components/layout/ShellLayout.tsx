import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface ShellLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ShellLayout({ left, center, right }: ShellLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('okk.focus-mode');
    return stored === '1';
  });
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!leftOpen && !rightOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [leftOpen, rightOpen]);

  useEffect(() => {
    if (!commandOpen) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [commandOpen]);

  useEffect(() => {
    localStorage.setItem('okk.focus-mode', focusMode ? '1' : '0');
    if (focusMode) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, [focusMode]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') {
        return;
      }
      event.preventDefault();
      setCommandOpen((current) => !current);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, []);
  useEffect(() => {
    const handleFocusShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'l') {
        return;
      }
      event.preventDefault();
      setFocusMode((current) => !current);
    };
    window.addEventListener('keydown', handleFocusShortcut);
    return () => {
      window.removeEventListener('keydown', handleFocusShortcut);
    };
  }, []);

  const switchTheme = (): void => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('okk.theme', next);
    setThemeMode(next);
  };
  const toggleFocusMode = (): void => {
    setFocusMode((current) => !current);
  };
  const toggleRightPanel = (): void => {
    setRightOpen((current) => !current);
  };

  const commandItems = useMemo(
    () => [
      {
        id: 'go-chat',
        title: '进入 Chat',
        subtitle: '打开会话页',
        action: () => navigate('/')
      },
      {
        id: 'go-mcp',
        title: '进入 MCP 设置',
        subtitle: '查看并管理 MCP 连接',
        action: () => navigate('/settings/mcp')
      },
      {
        id: 'go-skills',
        title: '进入 Skills',
        subtitle: '查看技能与市场安装',
        action: () => navigate('/skills')
      },
      {
        id: 'toggle-theme',
        title: themeMode === 'dark' ? '切换浅色主题' : '切换深色主题',
        subtitle: '立即切换全局外观',
        action: () => switchTheme()
      },
      {
        id: 'toggle-focus',
        title: focusMode ? '退出专注模式' : '开启专注模式',
        subtitle: '隐藏侧边栏，聚焦当前会话',
        action: () => toggleFocusMode()
      },
      {
        id: 'toggle-collab',
        title: rightOpen ? '关闭协作面板' : '打开协作面板',
        subtitle: '查看 Team 时间线与任务图',
        action: () => toggleRightPanel()
      }
    ],
    [focusMode, navigate, rightOpen, themeMode]
  );
  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return commandItems;
    }
    return commandItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.id.includes(query)
    );
  }, [commandItems, commandQuery]);
  const executeCommand = (commandId: string): void => {
    const target = commandItems.find((item) => item.id === commandId);
    if (!target) {
      return;
    }
    target.action();
    setCommandOpen(false);
    setCommandQuery('');
  };

  return (
    <div className='app-shell'>
      <header className='app-topbar' aria-label='全局顶栏'>
        <div className='topbar-brand'>
          <span className='topbar-brand-icon' aria-hidden='true'>
            ◎
          </span>
          <h1>OKK</h1>
        </div>
        <div className='topbar-center'>
          <span className='topbar-model'>
            {location.pathname === '/' ? 'Chat' : location.pathname === '/settings/mcp' ? 'MCP' : 'Skills'}
          </span>
        </div>
        <div className='topbar-actions'>
          <button
            type='button'
            className='ghost-button topbar-command-button'
            aria-label='打开命令面板'
            title='Command palette (Ctrl/Cmd + K)'
            onClick={() => setCommandOpen(true)}
          >
            ⌘K
          </button>
          {!focusMode && (
            <button
              type='button'
              className={`ghost-button topbar-collab-toggle ${rightOpen ? 'is-active' : ''}`}
              aria-expanded={rightOpen}
              aria-label='协作面板'
              onClick={toggleRightPanel}
            >
              {rightOpen ? '协作开' : '协作'}
            </button>
          )}
          <button type='button' className='ghost-button app-topbar-drawer-button' onClick={() => setLeftOpen(true)}>
            导航
          </button>
          <button
            type='button'
            className='ghost-button app-topbar-drawer-button'
            aria-expanded={rightOpen}
            onClick={() => setRightOpen(true)}
          >
            协作
          </button>
        </div>
      </header>
      <header className='mobile-header'>
        <button type='button' className='ghost-button' aria-label='打开导航菜单' onClick={() => setLeftOpen(true)}>
          菜单
        </button>
        <div className='mobile-title'>
          <span className='status-dot' aria-hidden='true' />
          <h1>OKK</h1>
        </div>
        <button type='button' className='ghost-button' aria-label='打开上下文面板' onClick={() => setRightOpen(true)}>
          上下文
        </button>
      </header>

      <div className={`app-shell-grid ${focusMode ? 'focus-mode' : ''}`}>
        <aside className={`left-column desktop-only ${focusMode ? 'focus-hidden' : ''}`}>{left}</aside>
        <main className='center-column'>{center}</main>
      </div>

      {leftOpen && (
        <div className='drawer-mask' role='presentation' onClick={() => setLeftOpen(false)}>
          <aside
            className='drawer drawer-left'
            role='dialog'
            aria-modal='true'
            aria-label='导航抽屉'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='drawer-actions'>
              <button type='button' className='ghost-button' onClick={() => setLeftOpen(false)}>
                关闭
              </button>
            </div>
            {left}
          </aside>
        </div>
      )}

      {rightOpen && (
        <div className='drawer-mask' role='presentation' onClick={() => setRightOpen(false)}>
          <aside
            className='context-sidepanel'
            role='dialog'
            aria-modal='true'
            aria-label='协作面板'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='drawer-actions context-sidepanel-actions'>
              <h2>协作面板</h2>
              <button type='button' className='ghost-button' onClick={() => setRightOpen(false)}>
                关闭
              </button>
            </div>
            {right}
          </aside>
        </div>
      )}

      {commandOpen && (
        <div className='drawer-mask command-palette-mask' role='presentation' onClick={() => setCommandOpen(false)}>
          <aside
            className='command-palette'
            role='dialog'
            aria-modal='true'
            aria-label='命令面板'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='command-palette-head'>
              <input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder='输入命令，如：chat / mcp / skill / theme'
              />
              <span className='small-text'>Esc 关闭</span>
            </div>
            <ul className='command-palette-list'>
              {filteredCommands.length === 0 ? (
                <li className='command-palette-empty'>没有匹配命令</li>
              ) : (
                filteredCommands.map((item) => (
                  <li key={item.id}>
                    <button type='button' className='command-palette-item' onClick={() => executeCommand(item.id)}>
                      <strong>{item.title}</strong>
                      <span className='small-text'>{item.subtitle}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
