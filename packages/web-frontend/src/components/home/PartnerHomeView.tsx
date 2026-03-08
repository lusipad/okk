import type { SessionInfo } from '../../types/domain';

interface PartnerHomeQuickAction {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

interface PartnerHomeContinueCard {
  repoName: string;
  summary?: string | null;
  loading?: boolean;
  error?: string | null;
}

interface PartnerHomeViewProps {
  partnerName: string;
  loading: boolean;
  recentSessions: SessionInfo[];
  continueCard?: PartnerHomeContinueCard | null;
  quickActions: PartnerHomeQuickAction[];
  onSelectSession: (sessionId: string) => void;
  onContinueWork?: () => void;
  onApplyQuickAction: (prompt: string) => void;
}

function formatRecentSessionTime(value: string): string {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return '时间未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(target);
}

export function PartnerHomeView({
  partnerName,
  loading,
  recentSessions,
  continueCard = null,
  quickActions,
  onSelectSession,
  onContinueWork,
  onApplyQuickAction
}: PartnerHomeViewProps) {
  return (
    <section className='partner-home' aria-label='合伙人首页'>
      <div className='partner-home-hero'>
        <p className='eyebrow'>Partner home</p>
        <h2>欢迎回来，{partnerName}</h2>
        <p className='partner-home-copy'>
          {loading
            ? '正在整理最近会话、项目上下文与可用能力…'
            : '我已经准备好基于你最近的上下文继续协作。你可以直接继续工作、切回最近会话，或先用一个快捷动作开始。'}
        </p>
      </div>

      <div className='partner-home-grid'>
        <section className='partner-home-section' aria-labelledby='partner-home-recent-title'>
          <div className='partner-home-section-head'>
            <h3 id='partner-home-recent-title'>最近会话</h3>
            <span className='partner-home-section-meta'>{recentSessions.length} 条可快速返回</span>
          </div>
          {recentSessions.length === 0 ? (
            <p className='small-text'>还没有可回看的最近会话，发出第一条消息后这里会展示你的协作历史。</p>
          ) : (
            <div className='partner-home-session-list'>
              {recentSessions.map((session) => (
                <button
                  key={session.id}
                  type='button'
                  className='partner-home-session-card'
                  data-testid={`partner-home-session-${session.id}`}
                  onClick={() => onSelectSession(session.id)}
                >
                  <span className='partner-home-session-title'>{session.title || '未命名会话'}</span>
                  <span className='partner-home-session-summary'>{session.summary || '回到该会话继续当前工作。'}</span>
                  <span className='partner-home-session-time'>{formatRecentSessionTime(session.updatedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className='partner-home-section' aria-labelledby='partner-home-continue-title'>
          <div className='partner-home-section-head'>
            <h3 id='partner-home-continue-title'>继续工作</h3>
            <span className='partner-home-section-meta'>当前上下文入口</span>
          </div>
          {continueCard ? (
            <div className='partner-home-continue-card' data-testid='partner-home-continue-card'>
              <p className='partner-home-continue-repo'>{continueCard.repoName}</p>
              <p className='partner-home-continue-summary'>
                {continueCard.loading
                  ? '正在同步该仓库的继续工作上下文…'
                  : continueCard.error
                    ? continueCard.error
                    : continueCard.summary || '继续当前仓库的最近任务与偏好。'}
              </p>
              {onContinueWork && (
                <button
                  type='button'
                  className='small-button'
                  data-testid='partner-home-continue-button'
                  onClick={onContinueWork}
                  disabled={Boolean(continueCard.loading)}
                >
                  {continueCard.loading ? '同步中…' : '继续上次工作'}
                </button>
              )}
            </div>
          ) : (
            <p className='small-text'>切换到具体会话后，这里会给出仓库级继续工作入口。</p>
          )}
        </section>
      </div>

      <section className='partner-home-section' aria-labelledby='partner-home-actions-title'>
        <div className='partner-home-section-head'>
          <h3 id='partner-home-actions-title'>快速操作</h3>
          <span className='partner-home-section-meta'>把想法直接注入草稿</span>
        </div>
        <div className='partner-home-action-grid'>
          {quickActions.map((action) => (
            <button
              key={action.id}
              type='button'
              className='partner-home-action-card'
              data-testid={`partner-home-action-${action.id}`}
              onClick={() => onApplyQuickAction(action.prompt)}
            >
              <span className='partner-home-action-label'>{action.label}</span>
              <span className='partner-home-action-description'>{action.description}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
