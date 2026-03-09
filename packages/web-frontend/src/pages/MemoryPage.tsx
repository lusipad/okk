import { useEffect, useState } from 'react';
import { useIO } from '../io/io-context';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { MemoryEntry, TeamPanelState } from '../types/domain';
import { useChatStore } from '../state/chat-store';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

export function MemoryPage() {
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [items, setItems] = useState<MemoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [memories, sessions] = await Promise.all([io.listMemoryEntries(), io.listSessions()]);
        setItems(memories);
        dispatch({ type: 'set_sessions', sessions });
      } catch (incoming) {
        setError(incoming instanceof Error ? incoming.message : '加载记忆失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [dispatch, io]);

  return (
    <ShellLayout
      topbarContext={{ title: 'Memory' }}
      left={
        <LeftSidebar
          sessions={state.sessions}
          currentSessionId={state.currentSessionId}
          onSelectSession={(sessionId) => dispatch({ type: 'set_current_session', sessionId })}
          onCreateSession={() => undefined}
        />
      }
      center={
        <section className='chat-panel'>
          <header className='chat-stage-header'>
            <div className='chat-stage-title'>
              <h2>Memory</h2>
            </div>
          </header>
          {loading ? <p>加载中...</p> : error ? <p className='error-text'>{error}</p> : (
            <ul className='settings-list'>
              {items.map((item) => (
                <li key={item.id} className='settings-item settings-item-vertical'>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                    <span className='chip'>{item.memoryType}</span>
                    <span className='chip'>{item.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
