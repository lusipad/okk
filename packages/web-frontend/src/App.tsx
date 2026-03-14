import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ChatStoreProvider } from './state/chat-store';
import { HttpWsIOProvider } from './io/http-ws-provider';
import { IOContext } from './io/io-context';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { McpSettingsPage } from './pages/McpSettingsPage';
import { SkillsPage } from './pages/SkillsPage';
import { IdentityPage } from './pages/IdentityPage';
import { MemoryPage } from './pages/MemoryPage';
import { GovernancePage } from './pages/GovernancePage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { KnowledgeImportsPage } from './pages/KnowledgeImportsPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { KnowledgeSharingPage } from './pages/KnowledgeSharingPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { MemorySharingPage } from './pages/MemorySharingPage';

interface DesktopRuntimeConfig {
  phase?: 'starting' | 'ready' | 'error';
  summary?: string;
  detail?: string;
  checks?: DesktopRuntimeCheck[];
  apiBaseUrl?: string;
  wsBaseUrl?: string;
  logPath?: string;
  updatedAt?: string;
  getStatus?: () => Promise<DesktopRuntimeStatus>;
  onStatus?: (listener: (status: DesktopRuntimeStatus) => void) => () => void;
  reload?: () => Promise<DesktopRuntimeStatus>;
  openLogs?: () => Promise<boolean>;
}

interface DesktopRuntimeCheck {
  id: string;
  label: string;
  status: 'pending' | 'ready' | 'warning' | 'error';
  summary: string;
  detail?: string;
}

interface DesktopRuntimeStatus {
  phase: 'starting' | 'ready' | 'error';
  summary: string;
  detail?: string;
  checks: DesktopRuntimeCheck[];
  apiBaseUrl?: string;
  wsBaseUrl?: string;
  logPath?: string;
  updatedAt: string;
}

function readDesktopRuntimeConfig(): DesktopRuntimeConfig | null {
  const runtimeConfig = (
    window as Window & {
      okkDesktopRuntime?: DesktopRuntimeConfig;
    }
  ).okkDesktopRuntime;
  return runtimeConfig && typeof runtimeConfig === 'object' ? runtimeConfig : null;
}

function readInitialDesktopRuntimeStatus(runtimeConfig: DesktopRuntimeConfig | null): DesktopRuntimeStatus | null {
  if (!runtimeConfig?.phase || !runtimeConfig.summary || !Array.isArray(runtimeConfig.checks) || !runtimeConfig.updatedAt) {
    return null;
  }

  return {
    phase: runtimeConfig.phase,
    summary: runtimeConfig.summary,
    detail: runtimeConfig.detail,
    checks: runtimeConfig.checks,
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    wsBaseUrl: runtimeConfig.wsBaseUrl,
    logPath: runtimeConfig.logPath,
    updatedAt: runtimeConfig.updatedAt
  };
}

function resolveRuntimeBaseUrls(runtimeConfig: DesktopRuntimeConfig | null): { apiBaseUrl: string; wsBaseUrl: string } {
  const apiBaseUrl =
    runtimeConfig?.apiBaseUrl?.trim() ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://127.0.0.1:3000';
  const wsBaseUrl =
    runtimeConfig?.wsBaseUrl?.trim() ||
    import.meta.env.VITE_WS_BASE_URL ||
    'ws://127.0.0.1:3000';

  return { apiBaseUrl, wsBaseUrl };
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

interface GuardProps {
  authenticated: boolean;
  children: ReactNode;
}

function Guard({ authenticated, children }: GuardProps) {
  if (!authenticated) {
    return <Navigate to='/login' replace />;
  }
  return children;
}

function formatRuntimeStatusLabel(status: DesktopRuntimeCheck['status']): string {
  if (status === 'ready') {
    return 'Ready';
  }
  if (status === 'warning') {
    return 'Warning';
  }
  if (status === 'error') {
    return 'Error';
  }
  return 'Pending';
}

function getRuntimeStatusClass(status: DesktopRuntimeCheck['status']): string {
  if (status === 'ready') {
    return 'is-ready';
  }
  if (status === 'warning') {
    return 'is-warning';
  }
  if (status === 'error') {
    return 'is-error';
  }
  return 'is-pending';
}

function DesktopRuntimeScreen({
  status,
  onReload,
  onOpenLogs
}: {
  status: DesktopRuntimeStatus;
  onReload: () => Promise<void>;
  onOpenLogs: () => Promise<void>;
}) {
  const copyDiagnostics = async (): Promise<void> => {
    await navigator.clipboard.writeText(JSON.stringify(status, null, 2));
  };

  return (
    <section className={`desktop-runtime-screen ${status.phase === 'error' ? 'is-error' : ''}`}>
      <div className='desktop-runtime-card'>
        <p className='eyebrow'>Desktop Runtime</p>
        <h1>{status.phase === 'starting' ? 'OKK 正在启动' : 'OKK 启动异常'}</h1>
        <p className='desktop-runtime-summary'>{status.summary}</p>
        {status.detail && <p className='desktop-runtime-detail'>{status.detail}</p>}
        <ul className='desktop-runtime-checks'>
          {status.checks.map((check) => (
            <li key={check.id} className={`desktop-runtime-check ${getRuntimeStatusClass(check.status)}`}>
              <div>
                <strong>{check.label}</strong>
                <p>{check.summary}</p>
                {check.detail && <p>{check.detail}</p>}
              </div>
              <span className='pill'>{formatRuntimeStatusLabel(check.status)}</span>
            </li>
          ))}
        </ul>
        <div className='desktop-runtime-actions'>
          {status.phase === 'starting' ? (
            <button type='button' className='primary-button' disabled>
              启动中...
            </button>
          ) : (
            <>
              <button type='button' className='primary-button' onClick={() => void onReload()}>
                重试启动
              </button>
              <button type='button' className='ghost-button' onClick={() => void onOpenLogs()}>
                打开日志
              </button>
              <button type='button' className='ghost-button' onClick={() => void copyDiagnostics()}>
                复制诊断
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function DesktopRuntimeWarningBar({
  status,
  onOpenLogs
}: {
  status: DesktopRuntimeStatus;
  onOpenLogs: () => Promise<void>;
}) {
  const issues = status.checks.filter((check) => check.status === 'warning' || check.status === 'error');
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className='desktop-runtime-warning-bar' role='alert'>
      <div>
        <strong>桌面运行环境存在待处理项</strong>
        <p>{issues.map((item) => `${item.label}: ${item.summary}`).join(' · ')}</p>
      </div>
      <button type='button' className='small-button ghost-button' onClick={() => void onOpenLogs()}>
        查看日志
      </button>
    </div>
  );
}

function DesktopAutoLoginScreen({ loading, error }: { loading: boolean; error: string | null }) {
  return (
    <section className='desktop-runtime-screen'>
      <div className='desktop-runtime-card'>
        <p className='eyebrow'>Desktop Runtime</p>
        <h1>{loading ? '正在连接你的赛博合伙人' : '赛博合伙人连接失败'}</h1>
        <p className='desktop-runtime-summary'>
          {loading ? 'OKK 已完成本地启动，正在自动连接你的赛博合伙人。' : error ?? '自动登录未完成，请手动登录。'}
        </p>
      </div>
    </section>
  );
}

export function App() {
  const { token, login, logout } = useAuth();
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;
  const desktopRuntime = useMemo(() => readDesktopRuntimeConfig(), []);
  const { apiBaseUrl, wsBaseUrl } = useMemo(() => resolveRuntimeBaseUrls(desktopRuntime), [desktopRuntime]);
  const [desktopRuntimeStatus, setDesktopRuntimeStatus] = useState<DesktopRuntimeStatus | null>(() =>
    readInitialDesktopRuntimeStatus(desktopRuntime)
  );
  const [desktopAutoLoginState, setDesktopAutoLoginState] = useState<'idle' | 'running' | 'failed' | 'done'>('idle');
  const [desktopAutoLoginError, setDesktopAutoLoginError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem('okk.theme');
    if (stored === 'light' || stored === 'dark') {
      root.dataset.theme = stored;
      return;
    }
    root.dataset.theme = 'dark';
  }, []);

  useEffect(() => {
    if (!desktopRuntime?.getStatus) {
      return undefined;
    }

    let cancelled = false;
    void desktopRuntime.getStatus().then((status) => {
      if (!cancelled) {
        setDesktopRuntimeStatus(status);
      }
    });

    const unsubscribe = desktopRuntime.onStatus?.((status) => {
      if (!cancelled) {
        setDesktopRuntimeStatus(status);
      }
    });

    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [desktopRuntime]);

  const io = useMemo(
    () =>
      new HttpWsIOProvider({
        baseUrl: apiBaseUrl,
        wsBaseUrl,
        getToken: () => localStorage.getItem('okk.jwt'),
        onAuthExpired: logout
      }),
    [apiBaseUrl, wsBaseUrl, logout]
  );

  useEffect(() => {
    if (!desktopRuntime || token || desktopAutoLoginState !== 'idle' || desktopRuntimeStatus?.phase !== 'ready') {
      return;
    }

    setDesktopAutoLoginState('running');
    setDesktopAutoLoginError(null);

    void io
      .login('admin', 'admin')
      .then((result) => {
        login(result.token, result.user);
        setDesktopAutoLoginState('done');
      })
      .catch((error) => {
        setDesktopAutoLoginError(toErrorMessage(error, '桌面本地登录失败，请手动登录。'));
        setDesktopAutoLoginState('failed');
      });
  }, [desktopRuntime, desktopRuntimeStatus?.phase, desktopAutoLoginState, io, login, token]);

  const reloadDesktopRuntime = useMemo(
    () => async (): Promise<void> => {
      if (!desktopRuntime?.reload) {
        window.location.reload();
        return;
      }
      const next = await desktopRuntime.reload();
      setDesktopRuntimeStatus(next);
    },
    [desktopRuntime]
  );

  const openDesktopLogs = useMemo(
    () => async (): Promise<void> => {
      if (!desktopRuntime?.openLogs) {
        return;
      }
      await desktopRuntime.openLogs();
    },
    [desktopRuntime]
  );

  if (desktopRuntimeStatus?.phase === 'starting' || desktopRuntimeStatus?.phase === 'error') {
    return <DesktopRuntimeScreen status={desktopRuntimeStatus} onReload={reloadDesktopRuntime} onOpenLogs={openDesktopLogs} />;
  }

  if (desktopRuntime && !token && (desktopAutoLoginState === 'idle' || desktopAutoLoginState === 'running')) {
    return <DesktopAutoLoginScreen loading error={desktopAutoLoginError} />;
  }

  return (
    <IOContext.Provider value={io}>
      <ChatStoreProvider>
        <Router>
          {desktopRuntimeStatus && <DesktopRuntimeWarningBar status={desktopRuntimeStatus} onOpenLogs={openDesktopLogs} />}
          <Routes>
            <Route path='/login' element={token ? <Navigate to='/' replace /> : <LoginPage />} />
            <Route
              path='/'
              element={
                <Guard authenticated={Boolean(token)}>
                  <ChatPage />
                </Guard>
              }
            />
            <Route
              path='/workspaces'
              element={
                <Guard authenticated={Boolean(token)}>
                  <WorkspacesPage />
                </Guard>
              }
            />
            <Route
              path='/settings/mcp'
              element={
                <Guard authenticated={Boolean(token)}>
                  <McpSettingsPage />
                </Guard>
              }
            />
            <Route
              path='/governance'
              element={
                <Guard authenticated={Boolean(token)}>
                  <GovernancePage />
                </Guard>
              }
            />
            <Route
              path='/knowledge'
              element={
                <Guard authenticated={Boolean(token)}>
                  <KnowledgePage />
                </Guard>
              }
            />
            <Route
              path='/knowledge/:entryId'
              element={
                <Guard authenticated={Boolean(token)}>
                  <KnowledgePage />
                </Guard>
              }
            />
            <Route
              path='/knowledge/sharing'
              element={
                <Guard authenticated={Boolean(token)}>
                  <KnowledgeSharingPage />
                </Guard>
              }
            />
            <Route
              path='/knowledge/team'
              element={
                <Guard authenticated={Boolean(token)}>
                  <KnowledgeSharingPage />
                </Guard>
              }
            />
            <Route
              path='/imports'
              element={
                <Guard authenticated={Boolean(token)}>
                  <KnowledgeImportsPage />
                </Guard>
              }
            />
            <Route
              path='/workflows'
              element={
                <Guard authenticated={Boolean(token)}>
                  <WorkflowsPage />
                </Guard>
              }
            />
            <Route
              path='/identity'
              element={
                <Guard authenticated={Boolean(token)}>
                  <IdentityPage />
                </Guard>
              }
            />
            <Route
              path='/memory'
              element={
                <Guard authenticated={Boolean(token)}>
                  <MemoryPage />
                </Guard>
              }
            />
            <Route
              path='/memory-sharing'
              element={
                <Guard authenticated={Boolean(token)}>
                  <MemorySharingPage />
                </Guard>
              }
            />
            <Route
              path='/skills'
              element={
                <Guard authenticated={Boolean(token)}>
                  <SkillsPage />
                </Guard>
              }
            />
            <Route path='*' element={<Navigate to={token ? '/' : '/login'} replace />} />
          </Routes>
        </Router>
      </ChatStoreProvider>
    </IOContext.Provider>
  );
}




