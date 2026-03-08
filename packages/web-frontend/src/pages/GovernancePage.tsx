import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { GovernanceDetailPayload } from '../io/types';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import type { KnowledgeGovernanceRecord, TeamPanelState } from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

export function GovernancePage() {
  const navigate = useNavigate();
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [items, setItems] = useState<KnowledgeGovernanceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GovernanceDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (): Promise<void> => {
    const session = await io.createSession();
    dispatch({ type: 'upsert_session', session });
    dispatch({ type: 'set_current_session', sessionId: session.id });
    navigate('/');
  };

  const load = async (): Promise<void> => {
    try {
      const [sessions, records] = await Promise.all([io.listSessions(), io.listGovernanceRecords()]);
      dispatch({ type: 'set_sessions', sessions });
      setItems(records);
      setSelectedId((current) => current ?? records[0]?.id ?? null);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '加载治理队列失败');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void io.getGovernanceDetail(selectedId).then(setDetail).catch(() => undefined);
  }, [io, selectedId]);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  const runAction = async (action: 'approve' | 'mark_stale' | 'merge' | 'rollback'): Promise<void> => {
    if (!selectedId || !detail) {
      return;
    }
    const firstConflict = detail.conflicts[0] as { id?: string } | undefined;
    const latestPreviousVersion = detail.versions.length > 1 ? detail.versions[detail.versions.length - 2] : detail.versions[0];
    const version = Number((latestPreviousVersion as { version?: unknown })?.version ?? 1);
    await io.reviewGovernance(selectedId, {
      action,
      ...(action === 'merge' && firstConflict?.id ? { targetEntryId: firstConflict.id } : {}),
      ...(action === 'rollback' ? { version } : {})
    });
    await load();
    setDetail(await io.getGovernanceDetail(selectedId));
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
              <h2>Knowledge Governance</h2>
              <p className='small-text'>过时检测、冲突发现、合并与回滚。</p>
            </div>
            <button type='button' className='primary-button' onClick={() => void io.refreshGovernance().then(setItems)}>
              刷新治理队列
            </button>
          </header>
          {error && <p className='error-text'>{error}</p>}
          <ul className='settings-list'>
            {items.map((item) => (
              <li key={item.id} className='settings-item settings-item-vertical'>
                <div>
                  <strong>{item.sourceLabel}</strong>
                  <p>{item.queueReason || item.staleReason || '治理记录'}</p>
                  <span className='chip'>{item.status}</span>
                  <span className='chip'>health {item.healthScore.toFixed(2)}</span>
                </div>
                <button type='button' className='ghost-button' onClick={() => setSelectedId(item.id)}>查看</button>
              </li>
            ))}
          </ul>

          {selectedItem && detail && (
            <div className='panel space-top'>
              <div className='panel-header'>
                <h3>治理详情</h3>
                <div className='row-actions'>
                  <button type='button' className='primary-button' onClick={() => void runAction('approve')}>通过</button>
                  <button type='button' className='ghost-button' onClick={() => void runAction('mark_stale')}>标记过时</button>
                  <button type='button' className='ghost-button' onClick={() => void runAction('merge')} disabled={detail.conflicts.length === 0}>合并冲突</button>
                  <button type='button' className='ghost-button' onClick={() => void runAction('rollback')} disabled={detail.versions.length === 0}>回滚版本</button>
                </div>
              </div>
              <p className='small-text'>Entry: {selectedItem.entryId}</p>
              <p className='small-text'>冲突数：{detail.conflicts.length} · 版本数：{detail.versions.length}</p>
              <div className='settings-card'>
                <h4>冲突项</h4>
                <ul className='settings-list'>
                  {detail.conflicts.map((item, index) => {
                    const record = item as { id?: string; title?: string; summary?: string };
                    return (
                      <li key={record.id ?? index} className='settings-item settings-item-vertical'>
                        <strong>{record.title || '未命名知识'}</strong>
                        <p>{record.summary || '暂无摘要'}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className='settings-card space-top'>
                <h4>版本历史</h4>
                <ul className='settings-list'>
                  {detail.versions.map((item, index) => {
                    const version = item as { version?: unknown; title?: unknown; changeSummary?: unknown; createdAt?: unknown };
                    return (
                      <li key={index} className='settings-item settings-item-vertical'>
                        <strong>v{String(version.version ?? index + 1)} {String(version.title ?? '')}</strong>
                        <p>{String(version.changeSummary ?? '无变更说明')}</p>
                        <p className='small-text'>{String(version.createdAt ?? '')}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
