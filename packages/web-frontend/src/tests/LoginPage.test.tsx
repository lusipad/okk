import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../pages/LoginPage';

const { mockNavigate, mockAuthLogin, mockAuthLogout, mockIoLogin } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAuthLogin: vi.fn(),
  mockAuthLogout: vi.fn(),
  mockIoLogin: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    token: null,
    user: null,
    login: mockAuthLogin,
    logout: mockAuthLogout
  })
}));

vi.mock('../io/io-context', () => ({
  useIO: () => ({
    login: mockIoLogin
  })
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIoLogin.mockResolvedValue({
      token: 'token',
      user: {
        id: 'u1',
        username: 'admin',
        displayName: '管理员'
      }
    });
  });

  it('展示默认账号提示，并支持一键填充账号清理错误状态', async () => {
    const user = userEvent.setup();
    mockIoLogin.mockRejectedValueOnce(new Error('登录失败示例'));
    render(<LoginPage />);

    expect(screen.getByText('开发环境默认账号')).toBeInTheDocument();
    expect(screen.getByText(/admin \/ admin/)).toBeInTheDocument();

    await user.type(screen.getByTestId('login-username'), 'foo');
    await user.type(screen.getByTestId('login-password'), 'bar');
    await user.click(screen.getByTestId('login-submit'));

    expect(await screen.findByText('登录失败示例')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '一键填充账号' }));
    expect(screen.getByTestId('login-username')).toHaveValue('admin');
    expect(screen.getByTestId('login-password')).toHaveValue('admin');
    expect(screen.queryByText('登录失败示例')).not.toBeInTheDocument();
  });
});
