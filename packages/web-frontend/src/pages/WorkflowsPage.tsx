import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { WorkflowTemplate } from '../io/types';
import { useIO } from '../io/io-context';
import { useChatStore } from '../state/chat-store';
import type { SkillWorkflowRecord, SkillWorkflowRun, TeamPanelState } from '../types/domain';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

const DEFAULT_RUN_INPUT = '{\n  "topic": "当前仓库回归",\n  "severity": "high"\n}';

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
  const [nodesJson, setNodesJson] = useState('[]');
  const [runInput, setRunInput] = useState(DEFAULT_RUN_INPUT);
  const [error, setError] = useState<string | null>(null);

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

  const selectedRun = useMemo(() => runs.find((item) => item.id === selectedRunId) ?? null, [runs, selectedRunId]);

  const applyTemplate = (template: WorkflowTemplate) => {
    setName(template.name);
    setDescription(template.description);
    setNodesJson(JSON.stringify(template.nodes, null, 2));
  };

  const createWorkflow = async (): Promise<void> => {
    const nodes = JSON.parse(nodesJson) as Array<Record<string, unknown>>;
    const item = await io.createWorkflow({ name: name.trim(), description: description.trim(), status: 'active', nodes });
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
              <p className='small-text'>模板库、工作流编排、失败恢复与历史回放。</p>
            </div>
          </header>
          {error && <p className='error-text'>{error}</p>}
          <div className='settings-card'>
            <h3>新建工作流</h3>
            <input value={name} placeholder='工作流名称' onChange={(event) => setName(event.target.value)} />
            <input value={description} placeholder='描述' onChange={(event) => setDescription(event.target.value)} />
            <textarea rows={10} value={nodesJson} onChange={(event) => setNodesJson(event.target.value)} />
            <div className='row-actions'>
              <button type='button' className='primary-button' onClick={() => void createWorkflow()}>保存工作流</button>
            </div>
            <div className='settings-list'>
              {templates.map((template) => (
                <button key={template.id} type='button' className='ghost-button' onClick={() => applyTemplate(template)}>
                  使用模板：{template.name}
                </button>
              ))}
            </div>
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
              <textarea rows={6} value={runInput} onChange={(event) => setRunInput(event.target.value)} />
              <ul className='settings-list'>
                {runs.map((run) => (
                  <li key={run.id} className='settings-item settings-item-vertical'>
                    <div>
                      <strong>{run.id}</strong>
                      <p>状态：{run.status}</p>
                      <p className='small-text'>步骤数：{run.steps.length}</p>
                    </div>
                    <div className='row-actions'>
                      <button type='button' className='ghost-button' onClick={() => setSelectedRunId(run.id)}>查看步骤</button>
                      <button type='button' className='ghost-button' onClick={() => void io.retryWorkflowRun(run.id).then(async (item) => { setSelectedRunId(item.id); setRuns(await io.listWorkflowRuns(selectedWorkflowId)); })}>重试</button>
                    </div>
                  </li>
                ))}
              </ul>
              {selectedRun && (
                <div className='settings-card space-top'>
                  <h4>运行步骤</h4>
                  <ul className='settings-list'>
                    {selectedRun.steps.map((step) => (
                      <li key={`${selectedRun.id}-${step.nodeId}`} className='settings-item settings-item-vertical'>
                        <strong>{step.nodeName}</strong>
                        <p>{step.nodeType} · {step.status}</p>
                        {step.error && <p className='error-text'>{step.error}</p>}
                      </li>
                    ))}
                  </ul>
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
