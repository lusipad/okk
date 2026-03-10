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
      <div className='auth-shell'>
        <section className='auth-showcase' aria-label='OKK 产品概览'>
          <div className='auth-showcase-copy'>
            <p className='auth-kicker'>OKK / CYBER OPERATIONS</p>
            <h1>把协作、记忆与执行收束进一张工程作战台。</h1>
            <p className='auth-subtitle'>
              面向 AI-native 团队的统一工作界面。对话、技能、治理、记忆和工作流不再散落在多个孤立系统里。
            </p>
          </div>

          <div className='auth-stat-grid' aria-label='系统能力摘要'>
            <article className='auth-stat-card'>
              <span className='auth-stat-value'>10+</span>
              <span className='auth-stat-label'>工作域面板</span>
            </article>
            <article className='auth-stat-card'>
              <span className='auth-stat-value'>MCP</span>
              <span className='auth-stat-label'>工具与上下文接入</span>
            </article>
            <article className='auth-stat-card'>
              <span className='auth-stat-value'>Live</span>
              <span className='auth-stat-label'>协作状态实时可见</span>
            </article>
          </div>

          <section className='auth-preview-panel' aria-label='产品预览'>
            <div className='auth-preview-header'>
              <span className='auth-preview-badge'>Mission Feed</span>
              <span className='auth-preview-meta'>实时编排</span>
            </div>
            <div className='auth-preview-list'>
              <article className='auth-preview-item is-primary'>
                <strong>Memory Layer</strong>
                <p>共享上下文、沉淀事实、减少重复解释。</p>
              </article>
              <article className='auth-preview-item'>
                <strong>Governance Mesh</strong>
                <p>规则、审批与风险提示在同一操作平面内完成。</p>
              </article>
              <article className='auth-preview-item'>
                <strong>Workflow Pulse</strong>
                <p>任务流转、状态切换和执行结果持续反馈。</p>
              </article>
            </div>
          </section>
        </section>

        <form className='auth-card' onSubmit={handleSubmit}>
          <div className='auth-heading'>
            <p className='auth-card-kicker'>WELCOME BACK</p>
            <h1>进入你的指挥台</h1>
            <p className='auth-subtitle'>登录后继续与你的赛博合伙人协作、治理与执行。</p>
          </div>

          <section className='auth-tip-card auth-tip-card-info'>
            <p className='auth-tip-title'>开发环境默认账号</p>
            <p className='auth-tip-body'>
              <strong>admin / admin</strong>
              <span>仅用于本地开发和联调。</span>
            </p>
          </section>

          <div className='auth-field-grid'>
            <label className='auth-field'>
              <span>用户名</span>
              <input
                data-testid='login-username'
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder='输入账号'
                required
              />
            </label>

            <label className='auth-field'>
              <span>密码</span>
              <input
                data-testid='login-password'
                type='password'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder='输入密码'
                required
              />
            </label>
          </div>

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

          <div className='auth-actions'>
            <button data-testid='login-submit' type='submit' className='primary-button auth-submit' disabled={loading}>
              {loading ? '登录中...' : '进入工作台'}
            </button>
            <button type='button' className='ghost-button auth-fill-button' onClick={handleFillDevAccount} disabled={loading}>
              一键填充账号
            </button>
          </div>

          <p className='auth-footnote'>登录后将进入 OKK Web 工作台；后续可继续扩展为整套全新视觉系统。</p>
        </form>
      </div>
    </div>
  );
}



