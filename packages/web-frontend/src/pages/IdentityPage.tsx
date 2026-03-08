import { useEffect, useState } from 'react';
import { useIO } from '../io/io-context';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import { useChatStore } from '../state/chat-store';
import type { IdentityProfile, TeamPanelState } from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

export function IdentityPage() {
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [items, setItems] = useState<IdentityProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('默认合伙人');
  const [systemPrompt, setSystemPrompt] = useState('你是 OKK 的赛博合伙人。');

  useEffect(() => {
    void (async () => {
      const sessions = await io.listSessions();
      dispatch({ type: 'set_sessions', sessions });
      const profiles = await io.listIdentityProfiles();
      const active = await io.getActiveIdentity();
      setItems(profiles);
      if (active) {
        setActiveId(active.id);
        setName(active.name);
        setSystemPrompt(active.systemPrompt);
      }
    })();
  }, [dispatch, io]);

  const save = async (): Promise<void> => {
    const saved = await io.upsertIdentity({ name, systemPrompt, isActive: true, profileJson: {} });
    setActiveId(saved.id);
    setItems(await io.listIdentityProfiles());
  };

  return (
    <ShellLayout
      left={<LeftSidebar sessions={state.sessions} currentSessionId={state.currentSessionId} onSelectSession={(sessionId) => dispatch({ type: 'set_current_session', sessionId })} onCreateSession={() => undefined} />}
      center={
        <section className='chat-panel'>
          <header className='chat-stage-header'><div className='chat-stage-title'><h2>Identity</h2></div></header>
          <div className='settings-card'>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder='身份名称' />
            <textarea rows={8} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} />
            <button type='button' className='primary-button' onClick={() => void save()}>保存并激活</button>
          </div>
          <ul className='settings-list'>
            {items.map((item) => (
              <li key={item.id} className='settings-item settings-item-vertical'>
                <strong>{item.name}</strong>
                <p>{item.systemPrompt}</p>
                <p className='small-text'>{item.id === activeId ? '当前激活' : '未激活'}</p>
              </li>
            ))}
          </ul>
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
