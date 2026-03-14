import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { WorkflowTemplate } from '../io/types';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import type {
  SkillWorkflowMetadata,
  SkillWorkflowNode,
  SkillWorkflowRecord,
  SkillWorkflowRun,
  SkillWorkflowRunStep,
  TeamPanelState,
  WorkflowKnowledgeDraft,
  WorkflowKnowledgePublishMode
} from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

const EMPTY_WORKFLOW_METADATA: SkillWorkflowMetadata = {
  templateId: null,
  knowledgePublishing: null
};

const DEFAULT_RUN_INPUT = '{\n  "topic": "当前仓库回归",\n  "severity": "high"\n}';
const KNOWLEDGE_NODE_TEMPLATE: SkillWorkflowNode = {
  id: 'knowledge-1',
  type: 'knowledge_ref',
  name: '引用知识',
  config: {
    outputKey: 'knowledgeContext',
    entryIds: ['knowledge-entry-id'],
    query: 'sqlite migration',
    limit: 3
  },
  next: []
};

interface WorkflowKnowledgeEditorState {
  title: string;
  summary: string;
  content: string;
  repoId: string;
  category: string;
  tagsInput: string;
  mode: WorkflowKnowledgePublishMode;
  source: WorkflowKnowledgeDraft['source'];
  saving: boolean;
  savedEntryId: string | null;
  savedEntryTitle: string | null;
}

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseNodesJson(input: string): { nodes: SkillWorkflowNode[]; error: string | null } {
  try {
    const parsed = JSON.parse(input) as SkillWorkflowNode[];
    if (!Array.isArray(parsed)) {
      return { nodes: [], error: '节点 JSON 必须是数组。' };
    }
    return { nodes: parsed, error: null };
  } catch (error) {
    return {
      nodes: [],
      error: error instanceof Error ? error.message : '节点 JSON 解析失败'
    };
  }
}

function parseTagsInput(input: string): string[] {
  return Array.from(new Set(input.split(',').map((item) => item.trim()).filter(Boolean)));
}

function createKnowledgeEditorState(draft: WorkflowKnowledgeDraft): WorkflowKnowledgeEditorState {
  return {
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    repoId: draft.repoId ?? '',
    category: draft.category,
    tagsInput: draft.tags.join(', '),
    mode: draft.mode,
    source: draft.source,
    saving: false,
    savedEntryId: null,
    savedEntryTitle: null
  };
}

function describeKnowledgeNode(node: SkillWorkflowNode): string {
  const outputKey = typeof node.config.outputKey === 'string' ? node.config.outputKey : 'knowledgeContext';
  const entryIds = Array.isArray(node.config.entryIds) ? node.config.entryIds.filter((item): item is string => typeof item === 'string') : [];
  const query = typeof node.config.query === 'string' ? node.config.query : '';
  const limit = typeof node.config.limit === 'number' ? node.config.limit : null;
  const parts = [`outputKey=${outputKey}`];
  if (entryIds.length > 0) {
    parts.push(`entryIds=${entryIds.join(', ')}`);
  }
  if (query) {
    parts.push(`query=${query}`);
  }
  if (limit !== null) {
    parts.push(`limit=${limit}`);
  }
  return parts.join(' · ');
}

function describeKnowledgePublishing(metadata: SkillWorkflowMetadata | null | undefined): string | null {
  const publishing = metadata?.knowledgePublishing;
  if (!publishing) {
    return null;
  }
  const parts = [`默认模式：${publishing.defaultMode === 'full' ? '完整结果' : '摘要结果'}`, `分类：${publishing.category}`];
  if (publishing.tags.length > 0) {
    parts.push(`标签：${publishing.tags.join(', ')}`);
  }
  return parts.join(' · ');
}

function renderStepOutput(step: SkillWorkflowRunStep): string {
  if (step.nodeType !== 'knowledge_ref') {
    return toPrettyJson(step.output);
  }

  const entries = Array.isArray(step.output.entries)
    ? step.output.entries.filter((item): item is { title?: unknown; category?: unknown } => Boolean(item && typeof item === 'object'))
    : [];
  const summary = typeof step.output.summary === 'string' ? step.output.summary : '';
  const header = entries.length > 0 ? `知识条目 ${entries.length} 条` : '知识条目 0 条';
  const lines = entries.map((entry) => {
    const title = typeof entry.title === 'string' ? entry.title : '未命名知识';
    const category = typeof entry.category === 'string' ? entry.category : 'general';
    return `- [${category}] ${title}`;
  });
  return [header, ...lines, summary ? `摘要：${summary}` : ''].filter(Boolean).join('\n');
}

export function WorkflowsPage() {
  const navigate = useNavigate();
  const io = useIO();
  const { state, dispatch } = useChatStore();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [workflows, setWorkflows] = useState<SkillWorkflowRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [runs, setRuns] = useState<SkillWorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workflowMetadata, setWorkflowMetadata] = useState<SkillWorkflowMetadata>(EMPTY_WORKFLOW_METADATA);
  const [nodesJson, setNodesJson] = useState('[]');
  const [runInput, setRunInput] = useState(DEFAULT_RUN_INPUT);
  const [error, setError] = useState<string | null>(null);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeEditor, setKnowledgeEditor] = useState<WorkflowKnowledgeEditorState | null>(null);
  const parsedNodes = useMemo(() => parseNodesJson(nodesJson), [nodesJson]);
  const selectedWorkflow = useMemo(
    () => workflows.find((item) => item.id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflows]
  );
  const knowledgeNodes = useMemo(
    () => parsedNodes.nodes.filter((node) => node.type === 'knowledge_ref'),
    [parsedNodes.nodes]
  );
  const selectedRun = useMemo(() => runs.find((item) => item.id === selectedRunId) ?? null, [runs, selectedRunId]);

  const createSession = async (): Promise<void> => {
    const session = await io.createSession();
    dispatch({ type: 'upsert_session', session });
    dispatch({ type: 'set_current_session', sessionId: session.id });
    navigate('/');
  };

  const load = async (): Promise<void> => {
    try {
      const [sessions, templateItems, workflowItems] = await Promise.all([io.listSessions(), io.listWorkflowTemplates(), io.listWorkflows()]);
      dispatch({ type: 'set_sessions', sessions });
      setTemplates(templateItems);
      setWorkflows(workflowItems);
      setSelectedWorkflowId((current) => current ?? workflowItems[0]?.id ?? null);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '加载工作流失败');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedWorkflowId) {
      setRuns([]);
      return;
    }
    void io.listWorkflowRuns(selectedWorkflowId).then(setRuns).catch(() => undefined);
  }, [io, selectedWorkflowId]);

  useEffect(() => {
    setKnowledgeEditor(null);
    setKnowledgeError(null);
    setKnowledgeLoading(false);
  }, [selectedRunId]);

  const applyTemplate = (template: WorkflowTemplate) => {
    setName(template.name);
    setDescription(template.description);
    setWorkflowMetadata(template.metadata ?? EMPTY_WORKFLOW_METADATA);
    setNodesJson(JSON.stringify(template.nodes, null, 2));
  };

  const insertKnowledgeNodeTemplate = () => {
    const baseNodes = parsedNodes.error ? [] : parsedNodes.nodes;
    const nextId = `knowledge-${baseNodes.filter((node) => node.type === 'knowledge_ref').length + 1}`;
    const nextNode = {
      ...KNOWLEDGE_NODE_TEMPLATE,
      id: nextId,
      name: `引用知识 ${baseNodes.filter((node) => node.type === 'knowledge_ref').length + 1}`
    };
    setNodesJson(JSON.stringify([...baseNodes, nextNode], null, 2));
  };

  const createWorkflow = async (): Promise<void> => {
    if (parsedNodes.error) {
      setError(parsedNodes.error);
      return;
    }
    const nodes = parsedNodes.nodes.map((node) => ({
      ...node,
      config: { ...node.config },
      next: [...node.next]
    })) as Array<Record<string, unknown>>;
    const item = await io.createWorkflow({
      name: name.trim(),
      description: description.trim(),
      status: 'active',
      nodes,
      metadata: workflowMetadata
    });
    await load();
    setSelectedWorkflowId(item.id);
  };

  const runWorkflow = async (): Promise<void> => {
    if (!selectedWorkflowId) {
      return;
    }
    const item = await io.runWorkflow(selectedWorkflowId, { input: JSON.parse(runInput) as Record<string, unknown> });
    setSelectedRunId(item.id);
    setRuns(await io.listWorkflowRuns(selectedWorkflowId));
  };

  const updateRunInState = (nextRun: SkillWorkflowRun): void => {
    setRuns((current) => {
      const exists = current.some((item) => item.id === nextRun.id);
      if (!exists) {
        return [nextRun, ...current];
      }
      return current.map((item) => (item.id === nextRun.id ? nextRun : item));
    });
    setSelectedRunId(nextRun.id);
  };

  const openKnowledgeEditor = async (run: SkillWorkflowRun, mode?: WorkflowKnowledgePublishMode): Promise<void> => {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const draft = await io.getWorkflowKnowledgeDraft(run.id, mode ?? run.metadata.knowledgePublishing?.defaultMode ?? 'summary');
      setKnowledgeEditor(createKnowledgeEditorState(draft));
    } catch (incoming) {
      setKnowledgeError(incoming instanceof Error ? incoming.message : '加载知识草稿失败');
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const switchKnowledgeMode = async (mode: WorkflowKnowledgePublishMode): Promise<void> => {
    if (!selectedRun) {
      return;
    }
    await openKnowledgeEditor(selectedRun, mode);
  };

  const publishKnowledge = async (): Promise<void> => {
    if (!selectedRun || !knowledgeEditor) {
      return;
    }
    setKnowledgeEditor((current) => (current ? { ...current, saving: true } : current));
    setKnowledgeError(null);
    try {
      const result = await io.publishWorkflowKnowledge(selectedRun.id, {
        title: knowledgeEditor.title.trim(),
        summary: knowledgeEditor.summary.trim(),
        content: knowledgeEditor.content,
        repoId: knowledgeEditor.repoId.trim() || null,
        category: knowledgeEditor.category.trim(),
        tags: parseTagsInput(knowledgeEditor.tagsInput),
        mode: knowledgeEditor.mode
      });
      if (result.run) {
        updateRunInState(result.run);
      }
      setKnowledgeEditor((current) =>
        current
          ? {
              ...current,
              saving: false,
              savedEntryId: result.item.id,
              savedEntryTitle: result.item.title
            }
          : current
      );
    } catch (incoming) {
      setKnowledgeEditor((current) => (current ? { ...current, saving: false } : current));
      setKnowledgeError(incoming instanceof Error ? incoming.message : '发布知识失败');
    }
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
              <h2>Skill Workflows</h2>
              <p className='small-text'>模板库、工作流编排、失败恢复与知识沉淀。</p>
            </div>
          </header>
          {error && <p className='error-text'>{error}</p>}
          <div className='settings-card'>
            <h3>新建工作流</h3>
            <input value={name} placeholder='工作流名称' onChange={(event) => setName(event.target.value)} />
            <input value={description} placeholder='描述' onChange={(event) => setDescription(event.target.value)} />
            <textarea rows={10} value={nodesJson} onChange={(event) => setNodesJson(event.target.value)} />
            <div className='row-actions'>
              <button type='button' className='ghost-button' data-testid='workflow-insert-knowledge-node' onClick={insertKnowledgeNodeTemplate}>
                插入知识节点模板
              </button>
              <button type='button' className='primary-button' onClick={() => void createWorkflow()}>保存工作流</button>
            </div>
            {parsedNodes.error ? <p className='error-text'>{parsedNodes.error}</p> : null}
            <div className='settings-list'>
              {templates.map((template) => (
                <div key={template.id} className='settings-item settings-item-vertical'>
                  <button type='button' className='ghost-button' onClick={() => applyTemplate(template)}>
                    使用模板：{template.name}
                  </button>
                  <p className='small-text'>{template.description}</p>
                  {describeKnowledgePublishing(template.metadata) && <p className='small-text'>{describeKnowledgePublishing(template.metadata)}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className='settings-card space-top workflow-editor-assist'>
            <h3>knowledge_ref 节点说明</h3>
            <p className='small-text'>保持现有 JSON 编辑模式不变。`config` 推荐字段：`outputKey`、`entryIds`、`query`、`repoId`、`category`、`tags`、`status`、`limit`。</p>
            {workflowMetadata.templateId && <p className='small-text'>当前模板：{workflowMetadata.templateId}</p>}
            {describeKnowledgePublishing(workflowMetadata) && <p className='small-text'>{describeKnowledgePublishing(workflowMetadata)}</p>}
            {knowledgeNodes.length === 0 ? (
              <p className='small-text'>当前 JSON 里还没有知识节点，点击“插入知识节点模板”可快速生成示例。</p>
            ) : (
              <ul className='settings-list' data-testid='workflow-knowledge-node-preview'>
                {knowledgeNodes.map((node) => (
                  <li key={node.id} className='settings-item settings-item-vertical'>
                    <strong>{node.name}</strong>
                    <p className='small-text'>{describeKnowledgeNode(node)}</p>
                    <pre className='workflow-json-preview'>{toPrettyJson(node.config)}</pre>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className='panel space-top'>
            <div className='panel-header'>
              <h3>工作流列表</h3>
            </div>
            <ul className='settings-list'>
              {workflows.map((workflow) => (
                <li key={workflow.id} className='settings-item settings-item-vertical'>
                  <div>
                    <strong>{workflow.name}</strong>
                    <p>{workflow.description}</p>
                    <span className='chip'>{workflow.status}</span>
                    {workflow.nodes.some((node) => node.type === 'knowledge_ref') && <span className='chip'>knowledge_ref</span>}
                    {workflow.metadata.knowledgePublishing && <span className='chip'>knowledge</span>}
                    {describeKnowledgePublishing(workflow.metadata) && <p className='small-text'>{describeKnowledgePublishing(workflow.metadata)}</p>}
                  </div>
                  <div className='row-actions'>
                    <button type='button' className='ghost-button' onClick={() => setSelectedWorkflowId(workflow.id)}>查看运行</button>
                    <button type='button' className='danger-button' onClick={() => void io.deleteWorkflow(workflow.id).then(load)}>删除</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {selectedWorkflowId && (
            <div className='panel space-top'>
              <div className='panel-header'>
                <h3>执行观察</h3>
                <button type='button' className='primary-button' onClick={() => void runWorkflow()}>运行工作流</button>
              </div>
              {selectedWorkflow && selectedWorkflow.nodes.some((node) => node.type === 'knowledge_ref') && (
                <p className='small-text'>
                  当前工作流包含 {selectedWorkflow.nodes.filter((node) => node.type === 'knowledge_ref').length} 个知识节点，运行后会在步骤输出中记录命中的知识条目和汇总摘要。
                </p>
              )}
              {selectedWorkflow && describeKnowledgePublishing(selectedWorkflow.metadata) && <p className='small-text'>{describeKnowledgePublishing(selectedWorkflow.metadata)}</p>}
              <textarea rows={6} value={runInput} onChange={(event) => setRunInput(event.target.value)} />
              <ul className='settings-list'>
                {runs.map((run) => (
                  <li key={run.id} className='settings-item settings-item-vertical'>
                    <div>
                      <strong>{run.id}</strong>
                      <p>状态：{run.status}</p>
                      <p className='small-text'>步骤数：{run.steps.length}</p>
                      {run.metadata.knowledgePublishing && <p className='small-text'>保存偏好：{run.metadata.knowledgePublishing.defaultMode === 'full' ? '完整结果' : '摘要结果'}</p>}
                      {run.metadata.publishedKnowledgeEntryId && <p className='small-text'>已沉淀知识：{run.metadata.publishedKnowledgeEntryId}</p>}
                    </div>
                    <div className='row-actions'>
                      <button type='button' className='ghost-button' onClick={() => setSelectedRunId(run.id)}>查看步骤</button>
                      {run.status === 'completed' && (
                        <button
                          type='button'
                          className='ghost-button'
                          data-testid={`workflow-open-knowledge-publish-${run.id}`}
                          onClick={() => {
                            setSelectedRunId(run.id);
                            void openKnowledgeEditor(run);
                          }}
                        >
                          保存为知识
                        </button>
                      )}
                      <button
                        type='button'
                        className='ghost-button'
                        onClick={() =>
                          void io.retryWorkflowRun(run.id).then(async (item) => {
                            setSelectedRunId(item.id);
                            setRuns(await io.listWorkflowRuns(selectedWorkflowId));
                          })
                        }
                      >
                        重试
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {selectedRun && (
                <div className='settings-card space-top'>
                  <div className='panel-header'>
                    <h4>运行步骤</h4>
                    <div className='row-actions'>
                      {selectedRun.status === 'completed' && (
                        <button
                          type='button'
                          className='primary-button'
                          data-testid='workflow-open-knowledge-publish'
                          onClick={() => void openKnowledgeEditor(selectedRun, knowledgeEditor?.mode)}
                        >
                          保存为知识
                        </button>
                      )}
                      {selectedRun.metadata.publishedKnowledgeEntryId && (
                        <button type='button' className='ghost-button' onClick={() => navigate(`/knowledge/${selectedRun.metadata.publishedKnowledgeEntryId}`)}>
                          查看已沉淀知识
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className='settings-list'>
                    {selectedRun.steps.map((step) => (
                      <li key={`${selectedRun.id}-${step.nodeId}`} className='settings-item settings-item-vertical'>
                        <strong>{step.nodeName}</strong>
                        <p>{step.nodeType} · {step.status}</p>
                        <pre className='workflow-step-output' data-testid={`workflow-step-output-${step.nodeId}`}>{renderStepOutput(step)}</pre>
                        {step.error && <p className='error-text'>{step.error}</p>}
                      </li>
                    ))}
                  </ul>

                  {(knowledgeLoading || knowledgeEditor || knowledgeError) && (
                    <div className='settings-card space-top' data-testid='workflow-knowledge-publish-panel'>
                      <h4>保存为知识</h4>
                      {knowledgeLoading && <p className='small-text'>正在生成默认知识草稿...</p>}
                      {knowledgeError && <p className='error-text'>{knowledgeError}</p>}
                      {knowledgeEditor && (
                        <>
                          <p className='small-text'>
                            来源：{knowledgeEditor.source.workflowName} · run {knowledgeEditor.source.runId}
                          </p>
                          <p className='small-text'>
                            template={knowledgeEditor.source.templateId ?? 'manual'} · steps={knowledgeEditor.source.sourceStepIds.join(', ') || 'none'}
                          </p>
                          <div className='row-actions'>
                            <button
                              type='button'
                              className={knowledgeEditor.mode === 'summary' ? 'primary-button' : 'ghost-button'}
                              onClick={() => void switchKnowledgeMode('summary')}
                            >
                              摘要结果
                            </button>
                            <button
                              type='button'
                              className={knowledgeEditor.mode === 'full' ? 'primary-button' : 'ghost-button'}
                              onClick={() => void switchKnowledgeMode('full')}
                            >
                              完整结果
                            </button>
                          </div>
                          <input
                            value={knowledgeEditor.title}
                            placeholder='知识标题'
                            onChange={(event) => setKnowledgeEditor((current) => (current ? { ...current, title: event.target.value } : current))}
                          />
                          <textarea
                            rows={3}
                            value={knowledgeEditor.summary}
                            placeholder='知识摘要'
                            onChange={(event) => setKnowledgeEditor((current) => (current ? { ...current, summary: event.target.value } : current))}
                          />
                          <textarea
                            rows={12}
                            value={knowledgeEditor.content}
                            placeholder='知识正文'
                            onChange={(event) => setKnowledgeEditor((current) => (current ? { ...current, content: event.target.value } : current))}
                          />
                          <input
                            value={knowledgeEditor.category}
                            placeholder='分类'
                            onChange={(event) => setKnowledgeEditor((current) => (current ? { ...current, category: event.target.value } : current))}
                          />
                          <input
                            value={knowledgeEditor.repoId}
                            placeholder='repo id'
                            onChange={(event) => setKnowledgeEditor((current) => (current ? { ...current, repoId: event.target.value } : current))}
                          />
                          <input
                            value={knowledgeEditor.tagsInput}
                            placeholder='标签，逗号分隔'
                            onChange={(event) => setKnowledgeEditor((current) => (current ? { ...current, tagsInput: event.target.value } : current))}
                          />
                          <div className='row-actions'>
                            <button
                              type='button'
                              className='primary-button'
                              data-testid='workflow-publish-knowledge-submit'
                              disabled={knowledgeEditor.saving}
                              onClick={() => void publishKnowledge()}
                            >
                              {knowledgeEditor.saving ? '发布中...' : '发布知识'}
                            </button>
                            {knowledgeEditor.savedEntryId && (
                              <button type='button' className='ghost-button' onClick={() => navigate(`/knowledge/${knowledgeEditor.savedEntryId}`)}>
                                前往知识条目
                              </button>
                            )}
                          </div>
                          {knowledgeEditor.savedEntryId && (
                            <p className='small-text' data-testid='workflow-knowledge-publish-success'>
                              已保存为知识：{knowledgeEditor.savedEntryTitle ?? knowledgeEditor.savedEntryId}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      }
      right={<RightSidebar suggestions={[]} teamView={EMPTY_TEAM_VIEW} onSaveSuggestion={() => undefined} onIgnoreSuggestion={() => undefined} />}
    />
  );
}
