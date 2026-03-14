import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowsPage } from '../pages/WorkflowsPage';

const {
  mockNavigate,
  mockDispatch,
  mockIo,
  mockListSessions,
  mockListWorkflowTemplates,
  mockListWorkflows,
  mockListWorkflowRuns,
  mockCreateWorkflow,
  mockDeleteWorkflow,
  mockRunWorkflow,
  mockRetryWorkflowRun,
  mockGetWorkflowKnowledgeDraft,
  mockPublishWorkflowKnowledge,
  chatState
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockDispatch: vi.fn(),
  mockIo: {} as Record<string, unknown>,
  mockListSessions: vi.fn(),
  mockListWorkflowTemplates: vi.fn(),
  mockListWorkflows: vi.fn(),
  mockListWorkflowRuns: vi.fn(),
  mockCreateWorkflow: vi.fn(),
  mockDeleteWorkflow: vi.fn(),
  mockRunWorkflow: vi.fn(),
  mockRetryWorkflowRun: vi.fn(),
  mockGetWorkflowKnowledgeDraft: vi.fn(),
  mockPublishWorkflowKnowledge: vi.fn(),
  chatState: {
    sessions: [
      {
        id: 'session-1',
        title: '当前会话',
        updatedAt: '2026-03-11T00:00:00.000Z'
      }
    ],
    currentSessionId: 'session-1'
  }
}));

Object.assign(mockIo, {
  listSessions: mockListSessions,
  listWorkflowTemplates: mockListWorkflowTemplates,
  listWorkflows: mockListWorkflows,
  listWorkflowRuns: mockListWorkflowRuns,
  createWorkflow: mockCreateWorkflow,
  deleteWorkflow: mockDeleteWorkflow,
  runWorkflow: mockRunWorkflow,
  retryWorkflowRun: mockRetryWorkflowRun,
  getWorkflowKnowledgeDraft: mockGetWorkflowKnowledgeDraft,
  publishWorkflowKnowledge: mockPublishWorkflowKnowledge,
  createSession: vi.fn().mockResolvedValue({
    id: 'session-new',
    title: '新会话',
    updatedAt: '2026-03-11T00:00:00.000Z'
  })
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../io/io-context', () => ({
  useIO: () => mockIo
}));

vi.mock('../state/chat-store', () => ({
  useChatStore: () => ({
    state: {
      ...chatState,
      agents: [],
      selectedAgentId: null,
      selectedSkillIds: [],
      selectedMcpServerIds: [],
      connectionState: 'connected',
      messagesBySession: {},
      suggestionsBySession: {},
      knowledgeReferencesBySession: {},
      teamViewBySession: {},
      runtimeStateBySession: {},
      lastEventIdBySession: {},
      seenEventIdsBySession: {}
    },
    dispatch: mockDispatch
  })
}));

vi.mock('../components/layout/ShellLayout', () => ({
  ShellLayout: ({ center }: { center: React.ReactNode }) => <div>{center}</div>
}));

vi.mock('../components/layout/LeftSidebar', () => ({
  LeftSidebar: () => <div>left-sidebar</div>
}));

vi.mock('../components/layout/RightSidebar', () => ({
  RightSidebar: () => <div>right-sidebar</div>
}));

describe('WorkflowsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSessions.mockResolvedValue(chatState.sessions);
    mockListWorkflowTemplates.mockResolvedValue([
      {
        id: 'template-knowledge',
        name: '知识输入模板',
        description: 'knowledge_ref -> prompt',
        metadata: {
          templateId: 'template-knowledge',
          knowledgePublishing: {
            enabled: true,
            defaultMode: 'summary',
            titlePrefix: '上下文整理',
            category: 'context',
            tags: ['context', 'workflow'],
            repoId: null,
            sourceStepIds: ['knowledge-1', 'prompt-1']
          }
        },
        nodes: [
          {
            id: 'knowledge-1',
            type: 'knowledge_ref',
            name: '引用知识',
            config: { outputKey: 'knowledgeContext', query: 'sqlite', limit: 2 },
            next: ['prompt-1']
          }
        ]
      }
    ]);
    mockListWorkflows.mockResolvedValue([
      {
        id: 'workflow-1',
        name: '知识工作流',
        description: '带知识节点',
        status: 'active',
        nodes: [
          {
            id: 'knowledge-1',
            type: 'knowledge_ref',
            name: '引用知识',
            config: { outputKey: 'knowledgeContext', entryIds: ['k-1'], limit: 2 },
            next: []
          }
        ],
        metadata: {
          templateId: 'template-knowledge',
          knowledgePublishing: {
            enabled: true,
            defaultMode: 'summary',
            titlePrefix: '知识沉淀',
            category: 'workflow',
            tags: ['workflow', 'knowledge'],
            repoId: null,
            sourceStepIds: ['knowledge-1']
          }
        },
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z'
      }
    ]);
    mockListWorkflowRuns.mockResolvedValue([
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        sessionId: null,
        status: 'completed',
        input: {},
        output: {},
        steps: [
          {
            nodeId: 'knowledge-1',
            nodeName: '引用知识',
            nodeType: 'knowledge_ref',
            status: 'completed',
            input: {},
            output: {
              entries: [
                { id: 'k-1', title: 'SQLite 指南', category: 'guide' },
                { id: 'k-2', title: '迁移规则', category: 'ops' }
              ],
              summary: 'SQLite 指南\n迁移规则'
            },
            startedAt: '2026-03-11T00:00:00.000Z',
            endedAt: '2026-03-11T00:00:01.000Z',
            error: null
          }
        ],
        metadata: {
          templateId: 'template-knowledge',
          knowledgePublishing: {
            enabled: true,
            defaultMode: 'summary',
            titlePrefix: '知识沉淀',
            category: 'workflow',
            tags: ['workflow', 'knowledge'],
            repoId: null,
            sourceStepIds: ['knowledge-1']
          },
          workflowName: '知识工作流',
          availablePublishModes: ['summary', 'full'],
          publishedKnowledgeEntryId: null,
          publishedAt: null
        },
        startedAt: '2026-03-11T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:01.000Z',
        endedAt: '2026-03-11T00:00:01.000Z'
      }
    ]);
    mockCreateWorkflow.mockResolvedValue({
      id: 'workflow-new',
      name: '新工作流',
      description: 'desc',
      status: 'active',
      nodes: [],
      metadata: {
        templateId: null,
        knowledgePublishing: null
      },
      createdAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z'
    });
    mockDeleteWorkflow.mockResolvedValue(undefined);
    mockRunWorkflow.mockResolvedValue({
      id: 'run-new',
      workflowId: 'workflow-1',
      sessionId: null,
      status: 'completed',
      input: {},
      output: {},
      steps: [],
      metadata: {
        templateId: 'template-knowledge',
        knowledgePublishing: {
          enabled: true,
          defaultMode: 'summary',
          titlePrefix: '知识沉淀',
          category: 'workflow',
          tags: ['workflow', 'knowledge'],
          repoId: null,
          sourceStepIds: ['knowledge-1']
        },
        workflowName: '知识工作流',
        availablePublishModes: ['summary', 'full'],
        publishedKnowledgeEntryId: null,
        publishedAt: null
      },
      startedAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
      endedAt: '2026-03-11T00:00:00.000Z'
    });
    mockRetryWorkflowRun.mockResolvedValue({
      id: 'run-retry',
      workflowId: 'workflow-1',
      sessionId: null,
      status: 'completed',
      input: {},
      output: {},
      steps: [],
      metadata: {
        templateId: 'template-knowledge',
        knowledgePublishing: {
          enabled: true,
          defaultMode: 'summary',
          titlePrefix: '知识沉淀',
          category: 'workflow',
          tags: ['workflow', 'knowledge'],
          repoId: null,
          sourceStepIds: ['knowledge-1']
        },
        workflowName: '知识工作流',
        availablePublishModes: ['summary', 'full'],
        publishedKnowledgeEntryId: null,
        publishedAt: null
      },
      startedAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
      endedAt: '2026-03-11T00:00:00.000Z'
    });
    mockGetWorkflowKnowledgeDraft.mockResolvedValue({
      title: '知识沉淀草稿',
      summary: '总结工作流结果',
      content: '# 知识沉淀草稿\n\n内容',
      repoId: 'repo-1',
      category: 'workflow',
      tags: ['workflow', 'knowledge'],
      mode: 'summary',
      source: {
        workflowId: 'workflow-1',
        workflowName: '知识工作流',
        runId: 'run-1',
        templateId: 'template-knowledge',
        sourceStepIds: ['knowledge-1'],
        mode: 'summary'
      }
    });
    mockPublishWorkflowKnowledge.mockResolvedValue({
      item: {
        id: 'knowledge-1',
        title: '知识沉淀草稿',
        content: '# 知识沉淀草稿\n\n内容',
        summary: '总结工作流结果',
        repoId: 'repo-1',
        category: 'workflow',
        sourceSessionId: null,
        qualityScore: 0,
        viewCount: 0,
        upvoteCount: 0,
        version: 1,
        status: 'draft',
        tags: ['workflow', 'knowledge'],
        metadata: {},
        createdBy: 'u-admin',
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z'
      },
      run: {
        id: 'run-1',
        workflowId: 'workflow-1',
        sessionId: null,
        status: 'completed',
        input: {},
        output: {},
        steps: [],
        metadata: {
          templateId: 'template-knowledge',
          knowledgePublishing: {
            enabled: true,
            defaultMode: 'summary',
            titlePrefix: '知识沉淀',
            category: 'workflow',
            tags: ['workflow', 'knowledge'],
            repoId: null,
            sourceStepIds: ['knowledge-1']
          },
          workflowName: '知识工作流',
          availablePublishModes: ['summary', 'full'],
          publishedKnowledgeEntryId: 'knowledge-1',
          publishedAt: '2026-03-11T00:00:00.000Z'
        },
        startedAt: '2026-03-11T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z',
        endedAt: '2026-03-11T00:00:00.000Z'
      },
      relation: {
        workflowId: 'workflow-1',
        runId: 'run-1',
        entryId: 'knowledge-1'
      }
    });
  });

  it('支持插入 knowledge_ref 节点模板并展示节点预览', async () => {
    const user = userEvent.setup();
    render(<WorkflowsPage />);

    await user.click(await screen.findByTestId('workflow-insert-knowledge-node'));

    await waitFor(() => {
      expect(screen.getByTestId('workflow-knowledge-node-preview')).toBeInTheDocument();
    });
    expect(screen.getByText('引用知识 1')).toBeInTheDocument();
    expect(screen.getByText(/outputKey=knowledgeContext/)).toBeInTheDocument();
  });

  it('在运行详情中可读展示 knowledge_ref 步骤输出', async () => {
    const user = userEvent.setup();
    render(<WorkflowsPage />);

    await user.click(await screen.findByRole('button', { name: '查看步骤' }));

    expect(await screen.findByTestId('workflow-step-output-knowledge-1')).toHaveTextContent('知识条目 2 条');
    expect(screen.getByTestId('workflow-step-output-knowledge-1')).toHaveTextContent('SQLite 指南');
    expect(screen.getByTestId('workflow-step-output-knowledge-1')).toHaveTextContent('迁移规则');
  });

  it('支持打开知识沉淀面板并发布知识', async () => {
    const user = userEvent.setup();
    render(<WorkflowsPage />);

    await user.click(await screen.findByRole('button', { name: '查看步骤' }));
    await user.click(screen.getByTestId('workflow-open-knowledge-publish'));

    expect(mockGetWorkflowKnowledgeDraft).toHaveBeenCalledWith('run-1', 'summary');
    expect(await screen.findByTestId('workflow-knowledge-publish-panel')).toBeInTheDocument();
    expect(screen.getByDisplayValue('知识沉淀草稿')).toBeInTheDocument();

    await user.clear(screen.getByDisplayValue('知识沉淀草稿'));
    await user.type(screen.getByPlaceholderText('知识标题'), '工作流沉淀知识');
    await user.click(screen.getByTestId('workflow-publish-knowledge-submit'));

    await waitFor(() => {
      expect(mockPublishWorkflowKnowledge).toHaveBeenCalledWith('run-1', {
        title: '工作流沉淀知识',
        summary: '总结工作流结果',
        content: '# 知识沉淀草稿\n\n内容',
        repoId: 'repo-1',
        category: 'workflow',
        tags: ['workflow', 'knowledge'],
        mode: 'summary'
      });
    });

    expect(await screen.findByTestId('workflow-knowledge-publish-success')).toHaveTextContent('知识沉淀草稿');
    await user.click(screen.getByRole('button', { name: '前往知识条目' }));
    expect(mockNavigate).toHaveBeenCalledWith('/knowledge/knowledge-1');
  });
});
