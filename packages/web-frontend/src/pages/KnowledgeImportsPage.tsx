import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { KnowledgeImportPreviewInput, RepoRecord } from '../io/types';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import type { KnowledgeImportBatch, KnowledgeImportItem, TeamPanelState } from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

export function KnowledgeImportsPage() {
  const navigate = useNavigate();
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [repos, setRepos] = useState<RepoRecord[]>([]);
  const [batches, setBatches] = useState<KnowledgeImportBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<{ item: KnowledgeImportBatch; items: KnowledgeImportItem[] } | null>(null);
  const [name, setName] = useState('');
  const [sourceTypes, setSourceTypes] = useState<string[]>(['memory', 'sessions', 'knowledge']);
  const [repoIds, setRepoIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (): Promise<void> => {
    const session = await io.createSession();
    dispatch({ type: 'upsert_session', session });
    dispatch({ type: 'set_current_session', sessionId: session.id });
    navigate('/');
  };

  const load = async (): Promise<void> => {
    try {
      const [sessions, repoItems, batchItems] = await Promise.all([io.listSessions(), io.listRepos(), io.listKnowledgeImportBatches()]);
      dispatch({ type: 'set_sessions', sessions });
      setRepos(repoItems);
      setBatches(batchItems);
      if (batchItems[0]) {
        setSelectedBatch(await io.getKnowledgeImportBatch(batchItems[0].id));
      }
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '加载导入批次失败');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const preview = async (): Promise<void> => {
    const payload: KnowledgeImportPreviewInput = { name: name.trim() || undefined, sourceTypes, repoIds };
    const detail = await io.previewKnowledgeImport(payload);
    setSelectedBatch(detail);
    setBatches(await io.listKnowledgeImportBatches());
  };

  const selectedStats = useMemo(() => {
    if (!selectedBatch) {
      return null;
    }
    return {
      total: selectedBatch.items.length,
      pending: selectedBatch.items.filter((item) => item.status === 'pending').length,
      imported: selectedBatch.items.filter((item) => item.status === 'imported').length,
      duplicate: selectedBatch.items.filter((item) => item.status === 'duplicate').length
    };
  }, [selectedBatch]);

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
              <h2>Cross-Agent Knowledge Imports</h2>
              <p className='small-text'>多来源预览、证据保留、去重确认与历史回放。</p>
            </div>
          </header>
          {error && <p className='error-text'>{error}</p>}

          <div className='settings-card'>
            <h3>创建导入预览</h3>
            <input value={name} placeholder='批次名称（可选）' onChange={(event) => setName(event.target.value)} />
            <div className='settings-list'>
              {['memory', 'sessions', 'knowledge'].map((item) => (
                <label key={item} className='settings-item'>
                  <input type='checkbox' checked={sourceTypes.includes(item)} onChange={() => toggle(item, setSourceTypes)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
            <div className='settings-list'>
              {repos.map((repo) => (
                <label key={repo.id} className='settings-item'>
                  <input type='checkbox' checked={repoIds.includes(repo.id)} onChange={() => toggle(repo.id, setRepoIds)} />
                  <span>{repo.name}</span>
                </label>
              ))}
            </div>
            <button type='button' className='primary-button' onClick={() => void preview()}>生成预览</button>
          </div>

          <div className='panel space-top'>
            <div className='panel-header'>
              <h3>历史批次</h3>
            </div>
            <ul className='settings-list'>
              {batches.map((batch) => (
                <li key={batch.id} className='settings-item settings-item-vertical'>
                  <div>
                    <strong>{batch.name}</strong>
                    <p>{batch.sourceSummary}</p>
                    <span className='chip'>{batch.status}</span>
                    <span className='chip'>{batch.itemCount} items</span>
                  </div>
                  <div className='row-actions'>
                    <button type='button' className='ghost-button' onClick={() => void io.getKnowledgeImportBatch(batch.id).then(setSelectedBatch)}>查看</button>
                    <button type='button' className='ghost-button' onClick={() => void io.replayKnowledgeImportBatch(batch.id).then(setSelectedBatch).then(load)}>回放</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {selectedBatch && (
            <div className='panel space-top'>
              <div className='panel-header'>
                <h3>{selectedBatch.item.name}</h3>
                <div className='row-actions'>
                  {selectedBatch.item.status !== 'completed' && (
                    <button type='button' className='primary-button' onClick={() => void io.confirmKnowledgeImportBatch(selectedBatch.item.id).then(setSelectedBatch)}>确认导入</button>
                  )}
                </div>
              </div>
              {selectedStats && <p className='small-text'>总数 {selectedStats.total} · 待处理 {selectedStats.pending} · 已导入 {selectedStats.imported} · 重复 {selectedStats.duplicate}</p>}
              <ul className='settings-list'>
                {selectedBatch.items.map((item) => (
                  <li key={item.id} className='settings-item settings-item-vertical'>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                      <span className='chip'>{item.sourceType}</span>
                      <span className='chip'>{item.status}</span>
                      {item.mergedEntryId && <span className='chip'>entry:{item.mergedEntryId}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
