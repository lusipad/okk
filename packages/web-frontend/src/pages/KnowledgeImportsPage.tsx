import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import { HttpError } from '../io/http-client';
import type { KnowledgeImportPreviewInput, KnowledgeImportPreviewIssue, RepoRecord } from '../io/types';
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

const normalizeIssue = (value: unknown): KnowledgeImportPreviewIssue | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;
  if (typeof source.message !== 'string' || source.message.trim().length === 0) {
    return null;
  }

  return {
    code: typeof source.code === 'string' ? source.code : 'invalid_value',
    field: typeof source.field === 'string' ? source.field : undefined,
    fileName: typeof source.fileName === 'string' ? source.fileName : undefined,
    message: source.message
  };
};

const summarizeContent = (content: string, maxLength = 160): string =>
  content.length > maxLength ? `${content.slice(0, maxLength - 3)}...` : content;

const readFileContent = async (file: File): Promise<string> => {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`读取文件 ${file.name} 失败`));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  });
};

export function KnowledgeImportsPage() {
  const navigate = useNavigate();
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [repos, setRepos] = useState<RepoRecord[]>([]);
  const [batches, setBatches] = useState<KnowledgeImportBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<{ item: KnowledgeImportBatch; items: KnowledgeImportItem[] } | null>(null);
  const [name, setName] = useState('');
  const [standardImportName, setStandardImportName] = useState('');
  const [sourceTypes, setSourceTypes] = useState<string[]>(['memory', 'sessions', 'knowledge']);
  const [repoIds, setRepoIds] = useState<string[]>([]);
  const [targetRepoId, setTargetRepoId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewIssues, setPreviewIssues] = useState<KnowledgeImportPreviewIssue[]>([]);
  const [previewingFiles, setPreviewingFiles] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
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
      setTargetRepoId((current) => current || repoItems[0]?.id || '');
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
    setPreviewIssues([]);
    setFeedback(null);
    const detail = await io.previewKnowledgeImport(payload);
    setSelectedBatch(detail);
    setBatches(await io.listKnowledgeImportBatches());
    setFeedback(`已生成 ${detail.items.length} 条导入预览。`);
  };

  const previewStandardFiles = async (): Promise<void> => {
    if (selectedFiles.length === 0) {
      setPreviewIssues([
        {
          code: 'missing_file',
          message: '请先选择至少一个 Markdown 文件。'
        }
      ]);
      return;
    }

    setPreviewingFiles(true);
    setPreviewIssues([]);
    setError(null);
    setFeedback(null);
    try {
      const files = await Promise.all(
        selectedFiles.map(async (file) => ({
          name: file.name,
          content: await readFileContent(file)
        }))
      );
      const detail = await io.previewKnowledgeImport({
        name: standardImportName.trim() || undefined,
        targetRepoId: targetRepoId || undefined,
        files
      });
      setSelectedBatch(detail);
      setBatches(await io.listKnowledgeImportBatches());
      setFeedback(`已解析 ${detail.items.length} 个标准知识文件。`);
    } catch (incoming) {
      if (incoming instanceof HttpError) {
        const payload = incoming.payload as { errors?: unknown } | undefined;
        const issues = Array.isArray(payload?.errors)
          ? payload.errors.map(normalizeIssue).filter((item): item is KnowledgeImportPreviewIssue => item !== null)
          : [];
        if (issues.length > 0) {
          setPreviewIssues(issues);
          return;
        }
      }

      setError(incoming instanceof Error ? incoming.message : '标准文件预览失败');
    } finally {
      setPreviewingFiles(false);
    }
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
              <p className='small-text'>多来源预览、标准文件导入、证据保留、去重确认与历史回放。</p>
            </div>
          </header>
          {error && <p className='error-text'>{error}</p>}
          {feedback && <p className='small-text'>{feedback}</p>}

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

          <div className='settings-card space-top'>
            <h3>导入标准知识文件</h3>
            <input
              value={standardImportName}
              placeholder='导入批次名称（可选）'
              onChange={(event) => setStandardImportName(event.target.value)}
            />
            <label className='settings-item settings-item-vertical'>
              <span>目标仓库</span>
              <select value={targetRepoId} onChange={(event) => setTargetRepoId(event.target.value)}>
                <option value=''>自动选择默认仓库</option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.name}
                  </option>
                ))}
              </select>
            </label>
            <label className='settings-item settings-item-vertical'>
              <span>Markdown 文件</span>
              <input
                data-testid='knowledge-import-file-input'
                type='file'
                accept='.md,text/markdown'
                multiple
                onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              />
            </label>
            {selectedFiles.length > 0 && (
              <ul className='settings-list'>
                {selectedFiles.map((file) => (
                  <li key={`${file.name}-${file.size}`} className='settings-item'>
                    <span>{file.name}</span>
                    <span className='small-text'>{Math.max(1, Math.round(file.size / 1024))} KB</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type='button'
              className='primary-button'
              data-testid='knowledge-import-preview-button'
              onClick={() => void previewStandardFiles()}
              disabled={previewingFiles}
            >
              {previewingFiles ? '解析中…' : '预览标准文件'}
            </button>
            {previewIssues.length > 0 && (
              <div className='panel space-top'>
                <div className='panel-header'>
                  <h3>格式校验错误</h3>
                </div>
                <ul className='settings-list'>
                  {previewIssues.map((issue, index) => (
                    <li key={`${issue.code}-${issue.fileName ?? 'unknown'}-${index}`} className='settings-item settings-item-vertical'>
                      <strong>{issue.fileName ?? '未知文件'}</strong>
                      <p>{issue.message}</p>
                      <div className='chip-row'>
                        <span className='chip'>{issue.code}</span>
                        {issue.field && <span className='chip'>{issue.field}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                    <button
                      type='button'
                      className='primary-button'
                      onClick={() => void io.confirmKnowledgeImportBatch(selectedBatch.item.id).then(setSelectedBatch).then(() => setFeedback('导入已确认。'))}
                    >
                      确认导入
                    </button>
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
                      {typeof item.evidence?.formatVersion === 'number' && <span className='chip'>v{String(item.evidence.formatVersion)}</span>}
                      {typeof item.evidence?.category === 'string' && <span className='chip'>{String(item.evidence.category)}</span>}
                      {Array.isArray(item.evidence?.tags) &&
                        item.evidence.tags
                          .filter((tag): tag is string => typeof tag === 'string')
                          .map((tag) => (
                            <span key={`${item.id}-${tag}`} className='chip'>
                              #{tag}
                            </span>
                          ))}
                      {item.mergedEntryId && <span className='chip'>entry:{item.mergedEntryId}</span>}
                    </div>
                    <p className='small-text'>{summarizeContent(item.content)}</p>
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
