import { useEffect, useMemo } from 'react';
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

interface DesktopRuntimeConfig {
  apiBaseUrl?: string;
  wsBaseUrl?: string;
}

function resolveRuntimeBaseUrls(): { apiBaseUrl: string; wsBaseUrl: string } {
  const runtimeConfig = (
    window as Window & {
      okkDesktopRuntime?: DesktopRuntimeConfig;
    }
  ).okkDesktopRuntime;

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

export function App() {
  const { token, logout } = useAuth();
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;
  const { apiBaseUrl, wsBaseUrl } = useMemo(() => resolveRuntimeBaseUrls(), []);

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem('okk.theme');
    if (stored === 'light' || stored === 'dark') {
      root.dataset.theme = stored;
      return;
    }
    root.dataset.theme = 'dark';
  }, []);

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

  return (
    <IOContext.Provider value={io}>
      <ChatStoreProvider>
        <Router>
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
              path='/settings/mcp'
              element={
                <Guard authenticated={Boolean(token)}>
                  <McpSettingsPage />
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
