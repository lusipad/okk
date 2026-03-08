import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { MemorySharingOverview } from '../io/types';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import type { MemoryEntry, MemoryShareRecord, TeamPanelState } from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

export function MemorySharingPage() {
  const navigate = useNavigate();
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [shares, setShares] = useState<MemoryShareRecord[]>([]);
  const [overview, setOverview] = useState<MemorySharingOverview | null>(null);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (): Promise<void> => {
    const session = await io.createSession();
    dispatch({ type: 'upsert_session', session });
    dispatch({ type: 'set_current_session', sessionId: session.id });
    navigate('/');
  };

  const load = async (): Promise<void> => {
    try {
      const [sessions, memoryItems, shareItems, overviewPayload] = await Promise.all([
        io.listSessions(),
        io.listMemoryEntries(),
        io.listMemoryShares(),
        io.getMemorySharingOverview()
      ]);
      dispatch({ type: 'set_sessions', sessions });
      setMemories(memoryItems);
      setShares(shareItems);
      setOverview(overviewPayload);
      setSelectedShareId((current) => current ?? shareItems[0]?.id ?? null);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '加载共享工作台失败');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedShare = useMemo(() => shares.find((item) => item.id === selectedShareId) ?? null, [selectedShareId, shares]);

  const requestShare = async (memoryId: string, visibility: 'private' | 'workspace' | 'team') => {
    await io.requestMemoryShare(memoryId, visibility);
    await load();
  };

  const runReview = async (action: 'approve' | 'reject' | 'publish' | 'rollback') => {
    if (!selectedShareId) {
      return;
    }
    await io.reviewMemoryShare(selectedShareId, { action });
    await load();
  };

  return (
    <ShellLayout
      left={
        <LeftSidebar
          sessions={state.sessions}
          currentSessionId={state.currentSessionId}
          onSelectSession={(sessionId) => dispatch({ type: 'set_current_session', sessionId })}
          onCreateSession={() => void createSession()}
        />
      }
      center={
        <section className='chat-panel'>
          <header className='chat-stage-header'>
            <div className='chat-stage-title'>
              <h2>Memory Sharing</h2>
              <p className='small-text'>可见性分级、审核流转、团队推荐与回滚路径。</p>
            </div>
          </header>
          {error && <p className='error-text'>{error}</p>}
          {overview && (
            <div className='settings-card'>
              <h3>团队概览</h3>
              <p className='small-text'>总量 {overview.summary.total} · 待审核 {overview.summary.pending} · 已发布 {overview.summary.published}</p>
              <ul className='settings-list'>
                {overview.recommendations.map((item) => (
                  <li key={item.memoryId} className='settings-item settings-item-vertical'>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                      <span className='chip'>confidence {item.confidence.toFixed(2)}</span>
                    </div>
                    <button type='button' className='primary-button' onClick={() => void requestShare(item.memoryId, 'team')}>申请团队共享</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className='panel space-top'>
            <div className='panel-header'>
              <h3>记忆列表</h3>
            </div>
            <ul className='settings-list'>
              {memories.slice(0, 20).map((memory) => (
                <li key={memory.id} className='settings-item settings-item-vertical'>
                  <div>
                    <strong>{memory.title}</strong>
                    <p>{memory.summary}</p>
                  </div>
                  <div className='row-actions'>
                    <button type='button' className='ghost-button' onClick={() => void requestShare(memory.id, 'workspace')}>共享到工作区</button>
                    <button type='button' className='primary-button' onClick={() => void requestShare(memory.id, 'team')}>共享到团队</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className='panel space-top'>
            <div className='panel-header'>
              <h3>审核队列</h3>
            </div>
            <ul className='settings-list'>
              {shares.map((share) => (
                <li key={share.id} className='settings-item settings-item-vertical'>
                  <div>
                    <strong>{share.memoryTitle}</strong>
                    <p>{share.memorySummary}</p>
                    <span className='chip'>{share.visibility}</span>
                    <span className='chip'>{share.reviewStatus}</span>
                  </div>
                  <button type='button' className='ghost-button' onClick={() => setSelectedShareId(share.id)}>查看</button>
                </li>
              ))}
            </ul>
          </div>

          {selectedShare && (
            <div className='panel space-top'>
              <div className='panel-header'>
                <h3>{selectedShare.memoryTitle}</h3>
                <div className='row-actions'>
                  <button type='button' className='primary-button' onClick={() => void runReview('approve')}>批准</button>
                  <button type='button' className='ghost-button' onClick={() => void runReview('reject')}>驳回</button>
                  <button type='button' className='ghost-button' onClick={() => void runReview('publish')}>发布</button>
                  <button type='button' className='ghost-button' onClick={() => void runReview('rollback')}>回滚</button>
                </div>
              </div>
              <p className='small-text'>可见性：{selectedShare.visibility} · 推荐分：{selectedShare.recommendationScore.toFixed(2)}</p>
              {selectedShare.rejectionReason && <p className='error-text'>{selectedShare.rejectionReason}</p>}
              {selectedShare.knowledgeEntryId && <p className='small-text'>已发布知识：{selectedShare.knowledgeEntryId}</p>}
            </div>
          )}
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
