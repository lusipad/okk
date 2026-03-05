import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useIO } from '../io/io-context';

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000';

function isBackendUnavailable(message: string | null): boolean {
  if (!message) {
    return false;
  }
  return [
    /failed to fetch/i,
    /networkerror/i,
    /network request failed/i,
    /fetch failed/i,
    /err_connection/i,
    /http 502/i,
    /http 503/i,
    /http 504/i
  ].some((pattern) => pattern.test(message));
}

export function LoginPage() {
  const io = useIO();
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const backendUnavailable = isBackendUnavailable(error);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await io.login(username, password);
      auth.login(result.token, result.user);
      navigate('/', { replace: true });
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDevAccount = (): void => {
    setUsername('admin');
    setPassword('admin');
    setError(null);
  };

  return (
    <div className='auth-page'>
      <form className='auth-card' onSubmit={handleSubmit}>
        <div className='auth-heading'>
          <h1>欢迎登录 OKK</h1>
          <p className='auth-subtitle'>登录后继续使用会话、Agent 与工具能力。</p>
        </div>
        <section className='auth-tip-card auth-tip-card-info'>
          <p className='auth-tip-title'>开发环境默认账号</p>
          <p className='auth-tip-body'>
            <strong>admin / admin</strong>
            <span>仅用于本地开发和联调。</span>
          </p>
          <button type='button' className='ghost-button auth-fill-button' onClick={handleFillDevAccount} disabled={loading}>
            一键填充账号
          </button>
        </section>
        <label>
          用户名
          <input data-testid='login-username' value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label>
          密码
          <input
            data-testid='login-password'
            type='password'
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className='error-text'>{error}</p>}
        {backendUnavailable && (
          <section className='auth-tip-card auth-tip-card-warning'>
            <p className='auth-tip-title'>连接诊断建议</p>
            <ul className='auth-diagnosis-list'>
              <li>确认后端服务已启动，并监听地址：{DEFAULT_API_BASE_URL}</li>
              <li>检查前端环境变量 `VITE_API_BASE_URL` 是否与后端地址一致。</li>
              <li>在终端验证连通性：`curl {DEFAULT_API_BASE_URL}/api/health`（若项目提供该接口）。</li>
            </ul>
          </section>
        )}
        <button data-testid='login-submit' type='submit' className='primary-button' disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}


