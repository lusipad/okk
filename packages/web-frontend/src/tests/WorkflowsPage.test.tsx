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
      startedAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
      endedAt: '2026-03-11T00:00:00.000Z'
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
});
