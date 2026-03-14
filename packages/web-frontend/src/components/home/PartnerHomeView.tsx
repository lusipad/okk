import type { ContinueWorkCandidate, MissionSummaryRecord, PartnerSummaryRecord, SessionInfo } from '../../types/domain';

interface PartnerHomeQuickAction {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

interface PartnerHomeSummaryCard {
  loading: boolean;
  error?: string | null;
  item?: PartnerSummaryRecord | null;
}

interface PartnerHomeViewProps {
  partnerName: string;
  loading: boolean;
  recentSessions: SessionInfo[];
  activeMissions?: MissionSummaryRecord[];
  continueCandidate?: ContinueWorkCandidate | null;
  summaryCard?: PartnerHomeSummaryCard;
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
  activeMissions = [],
  continueCandidate = null,
  summaryCard,
  quickActions,
  onSelectSession,
  onContinueWork,
  onApplyQuickAction
}: PartnerHomeViewProps) {
  const continueButtonLabel = continueCandidate?.source === 'session' ? '打开最近会话' : '继续当前工作';

  return (
    <section className='partner-home' aria-label='合伙人首页'>
      <div className='partner-home-hero'>
        <p className='eyebrow'>工作台首页</p>
        <h2>欢迎回来，{partnerName}</h2>
        <p className='partner-home-copy'>
          {loading
            ? '正在整理最近会话、项目上下文与可用能力…'
            : '先从一个明确入口开始：继续当前任务、回到最近对话，或者直接投递一条新的执行指令。'}
        </p>
      </div>

      <section className='partner-home-section' aria-labelledby='partner-home-summary-title'>
        <div className='partner-home-section-head'>
          <h3 id='partner-home-summary-title'>认识你</h3>
          <span className='partner-home-section-meta'>身份与记忆联动摘要</span>
        </div>
        {summaryCard?.loading ? (
          <p className='small-text'>正在加载身份与记忆摘要…</p>
        ) : summaryCard?.error ? (
          <p className='small-text'>{summaryCard.error}</p>
        ) : summaryCard?.item ? (
          <div className='partner-home-summary-card' data-testid='partner-home-summary-card'>
            <div className='partner-home-summary-topline'>
              <div>
                <p className='partner-home-summary-name'>{summaryCard.item.identity?.name ?? '尚未设置活跃身份'}</p>
                <p className='partner-home-summary-copy'>
                  {summaryCard.item.identity?.summary || '完善 Identity 后，这里会显示你的合伙人画像摘要。'}
                </p>
              </div>
              <div className='partner-home-summary-kpis'>
                <span className='partner-home-summary-kpi'>记忆 {summaryCard.item.memoryCount}</span>
                <span className='partner-home-summary-kpi'>仓库 {summaryCard.item.activeRepoName ?? '未激活'}</span>
              </div>
            </div>
            <div className='partner-home-memory-list'>
              {summaryCard.item.recentMemories.length > 0 ? (
                summaryCard.item.recentMemories.map((memory) => (
                  <span key={memory.id} className='partner-home-memory-chip'>
                    {memory.title}
                  </span>
                ))
              ) : (
                <span className='small-text'>还没有近期记忆，后续协作会逐步沉淀到这里。</span>
              )}
            </div>
          </div>
        ) : (
          <p className='small-text'>身份与记忆摘要暂不可用，但你仍然可以继续当前工作。</p>
        )}
      </section>

      <div className='partner-home-grid'>
        <section className='partner-home-section partner-home-section-continue' aria-labelledby='partner-home-continue-title'>
          <div className='partner-home-section-head'>
            <h3 id='partner-home-continue-title'>继续工作</h3>
            <span className='partner-home-section-meta'>首页主入口</span>
          </div>
          {continueCandidate ? (
            <div className='partner-home-continue-card' data-testid='partner-home-continue-card'>
              <p className='partner-home-continue-repo'>{continueCandidate.title}</p>
              <p className='partner-home-continue-summary'>
                {continueCandidate.loading
                  ? '正在同步继续工作上下文…'
                  : continueCandidate.error
                    ? continueCandidate.error
                    : continueCandidate.summary}
              </p>
              {continueCandidate.repoName ? <p className='small-text'>工作仓库：{continueCandidate.repoName}</p> : null}
              {onContinueWork && (
                <button
                  type='button'
                  className='small-button'
                  data-testid='partner-home-continue-button'
                  onClick={onContinueWork}
                  disabled={Boolean(continueCandidate.loading)}
                >
                  {continueCandidate.loading ? '同步中…' : continueButtonLabel}
                </button>
              )}
            </div>
          ) : (
            <p className='small-text'>当前还没有可继续的历史，先开始一段新的协作吧。</p>
          )}
        </section>

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

      </div>

      <section className='partner-home-section' aria-labelledby='partner-home-missions-title'>
        <div className='partner-home-section-head'>
          <h3 id='partner-home-missions-title'>进行中的任务</h3>
          <span className='partner-home-section-meta'>{activeMissions.length} 条 Mission</span>
        </div>
        {activeMissions.length === 0 ? (
          <p className='small-text'>当前还没有结构化 Mission，先从继续工作或快速操作开始。</p>
        ) : (
          <div className='partner-home-action-grid'>
            {activeMissions.slice(0, 3).map((mission) => (
              <article key={mission.id} className='partner-home-action-card' data-testid={`partner-home-mission-${mission.id}`}>
                <span className='partner-home-action-label'>{mission.title}</span>
                <span className='partner-home-action-description'>
                  阶段 {mission.phase} · {mission.workstreamCompleted}/{mission.workstreamTotal} 已完成 · 阻塞 {mission.blockedCount} · 待确认 {mission.openCheckpointCount}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

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
