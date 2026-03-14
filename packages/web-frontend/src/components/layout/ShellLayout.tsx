import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface TopbarContext {
  title: string;
  identityName?: string | null;
}

interface ShellLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  topbarContext?: TopbarContext;
}

interface DesktopShellBridge {
  search?: {
    onQuery?: (listener: (query: string) => void) => () => void;
  };
  files?: {
    pick?: () => Promise<string[]>;
  };
}

interface CommandPaletteEventDetail {
  query?: string;
}


interface DesktopFileSelectionDetail {
  paths?: string[];
}

declare global {
  interface WindowEventMap {
    'okk:command-palette': CustomEvent<CommandPaletteEventDetail>;
    'okk:desktop-files-selected': CustomEvent<DesktopFileSelectionDetail>;
  }
}

const COMMAND_PALETTE_EVENT = 'okk:command-palette';
const DESKTOP_FILES_SELECTED_EVENT = 'okk:desktop-files-selected';
const FOCUS_MODE_STORAGE_KEY = 'okk.focus-mode';
const RIGHT_PANEL_STORAGE_KEY = 'okk.right-panel-open';

function normalizeCommandQuery(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getDefaultTopbarTitle(pathname: string): string {
  if (pathname === '/') return '对话工作台';
  if (pathname === '/imports' || pathname === '/knowledge/imports') return '知识导入';
  if (pathname === '/knowledge' || pathname.startsWith('/knowledge/')) return '知识工作台';
  if (pathname === '/identity') return '身份';
  if (pathname === '/memory') return '记忆';
  if (pathname === '/workspaces') return '工作区';
  if (pathname === '/settings/mcp') return 'MCP';
  if (pathname === '/skills') return '技能';
  if (pathname === '/governance') return '治理';
  if (pathname === '/workflows') return '工作流';
  if (pathname === '/memory-sharing') return '共享';
  return '工作台';
}

export function ShellLayout({ left, center, right, topbarContext }: ShellLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState<boolean>(() => localStorage.getItem(RIGHT_PANEL_STORAGE_KEY) === '1');
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    const stored = localStorage.getItem(FOCUS_MODE_STORAGE_KEY);
    return stored === '1';
  });
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const desktopBridge = useMemo(() => (window as Window & { okkDesktop?: DesktopShellBridge }).okkDesktop, []);
  const resolvedTopbarTitle = topbarContext?.title?.trim() || getDefaultTopbarTitle(location.pathname);
  const resolvedIdentityName = topbarContext?.identityName?.trim() || null;

  const closeCommandPalette = (): void => {
    setCommandOpen(false);
    setCommandQuery('');
  };

  const openCommandPalette = (query: unknown = ''): void => {
    setCommandQuery(normalizeCommandQuery(query));
    setCommandOpen(true);
  };

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
        closeCommandPalette();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [commandOpen]);

  useEffect(() => {
    localStorage.setItem(FOCUS_MODE_STORAGE_KEY, focusMode ? '1' : '0');
    if (focusMode) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, [focusMode]);

  useEffect(() => {
    localStorage.setItem(RIGHT_PANEL_STORAGE_KEY, rightOpen ? '1' : '0');
  }, [rightOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') {
        return;
      }
      event.preventDefault();
      if (commandOpen) {
        closeCommandPalette();
        return;
      }
      openCommandPalette();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [commandOpen]);

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

  useEffect(() => {
    const subscribe = desktopBridge?.search?.onQuery;
    if (!subscribe) {
      return undefined;
    }

    const unsubscribe = subscribe((query) => {
      setLeftOpen(false);
      setRightOpen(false);
      openCommandPalette(query);
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [desktopBridge]);

  useEffect(() => {
    const handleCommandPaletteRequest = (event: CustomEvent<CommandPaletteEventDetail>): void => {
      openCommandPalette(event.detail?.query);
    };

    window.addEventListener(COMMAND_PALETTE_EVENT, handleCommandPaletteRequest);
    return () => {
      window.removeEventListener(COMMAND_PALETTE_EVENT, handleCommandPaletteRequest);
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
  const pickDesktopFiles = async (): Promise<void> => {
    const pick = desktopBridge?.files?.pick;
    if (!pick) {
      return;
    }
    const paths = await pick();
    if (paths.length === 0) {
      return;
    }
    navigate('/');
    window.dispatchEvent(new CustomEvent(DESKTOP_FILES_SELECTED_EVENT, { detail: { paths } }));
    closeCommandPalette();
  };

  const commandItems = useMemo(
    () =>
      [
        {
          id: 'go-chat',
          title: '进入 Chat',
          subtitle: '回到你和赛博合伙人的当前会话',
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
          id: 'pick-desktop-files',
          title: '选择本地文件或目录',
          subtitle: '通过桌面原生文件选择器把路径注入当前工作台',
          action: () => pickDesktopFiles()
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
      ] as Array<{ id: string; title: string; subtitle: string; action: () => void | Promise<void> }>,
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
    void Promise.resolve(target.action());
    closeCommandPalette();
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
          <div className='topbar-model topbar-context' aria-label='页面上下文'>
            <span className='topbar-context-title'>{resolvedTopbarTitle}</span>
            {resolvedIdentityName ? (
              <>
                <span className='topbar-context-divider' aria-hidden='true'>
                  ·
                </span>
                <span className='topbar-context-identity'>{resolvedIdentityName}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className='topbar-actions'>
          <button
            type='button'
            className='ghost-button topbar-command-button'
            aria-label='打开命令面板'
            title='Command palette (Ctrl/Cmd + K)'
            onClick={() => openCommandPalette()}
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
        <div className='drawer-mask command-palette-mask' role='presentation' onClick={closeCommandPalette}>
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
            <div className='command-palette-body'>
              {filteredCommands.length === 0 ? (
                <p className='empty-hint'>没有匹配“{commandQuery.trim()}”的命令。</p>
              ) : (
                <ul className='command-palette-list'>
                  {filteredCommands.map((item) => (
                    <li key={item.id}>
                      <button type='button' className='command-palette-item' onClick={() => executeCommand(item.id)}>
                        <strong>{item.title}</strong>
                        <span>{item.subtitle}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

