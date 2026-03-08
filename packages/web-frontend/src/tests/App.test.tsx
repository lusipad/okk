import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';

const {
  authState,
  mockIoLogin,
  mockLogout,
  mockNavigate,
  mockChatPage,
  mockLoginPage
} = vi.hoisted(() => {
  const authState = {
    token: null as string | null,
    user: null,
    login: vi.fn(),
    logout: vi.fn()
  };
  return {
    authState,
    mockIoLogin: vi.fn(),
    mockLogout: authState.logout,
    mockNavigate: vi.fn(),
    mockChatPage: vi.fn(() => <div>chat-page</div>),
    mockLoginPage: vi.fn(() => <div>login-page</div>)
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState
}));

vi.mock('../io/http-ws-provider', () => ({
  HttpWsIOProvider: vi.fn().mockImplementation(() => ({
    login: mockIoLogin
  }))
}));

vi.mock('../pages/LoginPage', () => ({
  LoginPage: () => mockLoginPage()
}));

vi.mock('../pages/ChatPage', () => ({
  ChatPage: () => mockChatPage()
}));

vi.mock('../pages/McpSettingsPage', () => ({
  McpSettingsPage: () => <div>mcp-page</div>
}));

vi.mock('../pages/SkillsPage', () => ({
  SkillsPage: () => <div>skills-page</div>
}));

vi.mock('../pages/IdentityPage', () => ({
  IdentityPage: () => <div>identity-page</div>
}));

vi.mock('../pages/MemoryPage', () => ({
  MemoryPage: () => <div>memory-page</div>
}));

vi.mock('../pages/GovernancePage', () => ({
  GovernancePage: () => <div>governance-page</div>
}));

vi.mock('../pages/WorkspacesPage', () => ({
  WorkspacesPage: () => <div>workspaces-page</div>
}));

vi.mock('../pages/KnowledgeImportsPage', () => ({
  KnowledgeImportsPage: () => <div>imports-page</div>
}));

vi.mock('../pages/WorkflowsPage', () => ({
  WorkflowsPage: () => <div>workflows-page</div>
}));

vi.mock('../pages/MemorySharingPage', () => ({
  MemorySharingPage: () => <div>sharing-page</div>
}));

describe('App desktop auto login', () => {
  beforeEach(() => {
    authState.token = null;
    authState.user = null;
    authState.login.mockReset();
    authState.logout.mockReset();
    mockIoLogin.mockReset();
    mockNavigate.mockReset();
    mockChatPage.mockClear();
    mockLoginPage.mockClear();
    delete (window as Window & { okkDesktopRuntime?: unknown }).okkDesktopRuntime;
  });

  it('桌面 runtime ready 时自动执行本地登录', async () => {
    (window as Window & { okkDesktopRuntime?: unknown }).okkDesktopRuntime = {
      phase: 'ready',
      summary: '桌面运行时已就绪',
      checks: [],
      apiBaseUrl: 'http://127.0.0.1:3230',
      wsBaseUrl: 'ws://127.0.0.1:3230',
      updatedAt: '2026-03-07T00:00:00.000Z',
      getStatus: vi.fn().mockResolvedValue({
        phase: 'ready',
        summary: '桌面运行时已就绪',
        checks: [],
        apiBaseUrl: 'http://127.0.0.1:3230',
        wsBaseUrl: 'ws://127.0.0.1:3230',
        updatedAt: '2026-03-07T00:00:00.000Z'
      }),
      onStatus: vi.fn()
    };

    mockIoLogin.mockResolvedValue({
      token: 'desktop-token',
      user: {
        id: 'u-admin',
        username: 'admin',
        displayName: '管理员'
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(mockIoLogin).toHaveBeenCalledWith('admin', 'admin');
    });
  });

  it('Web 环境不会触发桌面自动登录', async () => {
    render(<App />);

    expect(screen.getByText('login-page')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockIoLogin).not.toHaveBeenCalled();
    });
  });
});




