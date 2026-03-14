import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPage } from '../pages/ChatPage';

const {
  mockNavigate,
  mockDispatch,
  mockSaveKnowledgeSuggestion,
  mockIo,
  chatState
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockDispatch: vi.fn(),
  mockSaveKnowledgeSuggestion: vi.fn(),
  mockIo: {} as Record<string, unknown>,
  chatState: {
    sessions: [
      {
        id: 'session-1',
        title: '当前会话',
        updatedAt: '2026-03-11T00:00:00.000Z'
      }
    ],
    currentSessionId: 'session-1',
    agents: [],
    selectedAgentId: null,
    selectedSkillIds: [],
    selectedMcpServerIds: [],
    connectionState: 'connected',
    messagesBySession: {
      'session-1': [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '这里是回答',
          status: 'done',
          createdAt: '2026-03-11T00:00:00.000Z',
          toolCalls: []
        }
      ]
    },
    suggestionsBySession: {
      'session-1': [
        {
          id: 'suggestion-1',
          title: '提炼成知识',
          summary: '等待保存',
          content: '建议内容',
          category: 'guide',
          tags: ['knowledge'],
          status: 'pending'
        }
      ]
    },
    knowledgeReferencesBySession: {
      'session-1': [
        {
          id: 'knowledge-1',
          title: 'SQLite 约定',
          summary: '当前回答使用了 SQLite 约定',
          category: 'guide',
          updatedAt: '2026-03-11T00:00:00.000Z',
          injectionKind: 'related'
        }
      ]
    },
    teamViewBySession: {},
    runtimeStateBySession: {},
    lastEventIdBySession: {},
    seenEventIdsBySession: {}
  }
}));

Object.assign(mockIo, {
  listSessions: vi.fn().mockResolvedValue(chatState.sessions),
  listAgents: vi.fn().mockResolvedValue([]),
  listSkills: vi.fn().mockResolvedValue([]),
  listMcpServers: vi.fn().mockResolvedValue([]),
  listRuntimeBackends: vi.fn().mockResolvedValue([]),
  getActiveIdentity: vi.fn().mockResolvedValue(null),
  getPartnerSummary: vi.fn().mockResolvedValue(null),
  listMissionSummaries: vi.fn().mockResolvedValue([]),
  listTeamRuns: vi.fn().mockResolvedValue([]),
  listAgentTraces: vi.fn().mockResolvedValue([]),
  getRepoContext: vi.fn().mockResolvedValue({
    repoId: 'repo-1',
    repoName: 'okclaw',
    snapshot: {
      preferredSkillIds: [],
      preferredMcpServerIds: []
    },
    recentActivities: []
  }),
  saveKnowledgeSuggestion: mockSaveKnowledgeSuggestion,
  ignoreKnowledgeSuggestion: vi.fn().mockResolvedValue(undefined),
  subscribeSession: vi.fn().mockReturnValue(() => undefined),
  subscribeTeam: vi.fn().mockReturnValue(() => undefined),
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
    state: chatState,
    dispatch: mockDispatch
  })
}));

vi.mock('../components/layout/ShellLayout', () => ({
  ShellLayout: ({ center, right }: { center: React.ReactNode; right: React.ReactNode }) => (
    <div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  )
}));

vi.mock('../components/layout/LeftSidebar', () => ({
  LeftSidebar: () => <div>left-sidebar</div>
}));

vi.mock('../components/layout/RightSidebar', () => ({
  RightSidebar: ({ onSaveSuggestion }: { onSaveSuggestion: (input: { suggestionId: string; title: string; content: string; tags: string[] }) => void }) => (
    <button
      type='button'
      onClick={() =>
        onSaveSuggestion({
          suggestionId: 'suggestion-1',
          title: '修订标题',
          content: '修订内容',
          tags: ['sqlite']
        })
      }
    >
      保存建议
    </button>
  )
}));

vi.mock('../components/common/ConnectionBanner', () => ({
  ConnectionBanner: () => <div>connection-banner</div>
}));

vi.mock('../components/chat/MessageList', () => ({
  MessageList: () => <div>message-list</div>
}));

vi.mock('../components/chat/NextStepSuggestions', () => ({
  NextStepSuggestions: () => <div>next-step-suggestions</div>,
  deriveNextStepSuggestions: () => []
}));

vi.mock('../components/chat/Composer', () => ({
  Composer: () => <div>composer</div>
}));

vi.mock('../components/home/PartnerHomeView', () => ({
  PartnerHomeView: ({
    continueCandidate,
    onContinueWork
  }: {
    continueCandidate?: { title?: string | null };
    onContinueWork?: () => void;
  }) => (
    <div>
      <div>partner-home</div>
      {continueCandidate?.title ? <div>{continueCandidate.title}</div> : null}
      <button type='button' onClick={() => onContinueWork?.()}>
        继续工作
      </button>
    </div>
  )
}));

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatState.sessions = [
      {
        id: 'session-1',
        title: '当前会话',
        updatedAt: '2026-03-11T00:00:00.000Z'
      }
    ];
    chatState.currentSessionId = 'session-1';
    chatState.messagesBySession = {
      'session-1': [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '这里是回答',
          status: 'done',
          createdAt: '2026-03-11T00:00:00.000Z',
          toolCalls: []
        }
      ]
    };
    mockSaveKnowledgeSuggestion.mockResolvedValue({
      id: 'suggestion-1',
      title: '修订标题',
      summary: '等待保存',
      content: '修订内容',
      category: 'guide',
      tags: ['sqlite'],
      status: 'saved',
      knowledgeEntryId: 'knowledge-1'
    });
  });

  it('展示知识引用，并在保存建议后跳转到知识详情', async () => {
    const user = userEvent.setup();

    render(<ChatPage />);

    expect(await screen.findByText('本次对话使用的知识')).toBeInTheDocument();
    expect(screen.getByText('SQLite 约定')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存建议' }));

    await waitFor(() => {
      expect(mockSaveKnowledgeSuggestion).toHaveBeenCalledWith({
        sessionId: 'session-1',
        suggestionId: 'suggestion-1',
        title: '修订标题',
        content: '修订内容',
        tags: ['sqlite']
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/knowledge/knowledge-1');
  });

  it('首页继续工作在无当前仓库时会切回最近会话', async () => {
    const user = userEvent.setup();
    (chatState as {
      sessions: Array<{ id: string; title: string; updatedAt: string }>;
      currentSessionId: string | null;
      messagesBySession: Record<string, unknown[]>;
    }).sessions = [
      {
        id: 'session-1',
        title: '最近会话',
        updatedAt: '2026-03-11T00:00:00.000Z'
      },
      {
        id: 'session-2',
        title: '更早会话',
        updatedAt: '2026-03-10T00:00:00.000Z'
      }
    ];
    (chatState as { currentSessionId: string | null }).currentSessionId = null;
    (chatState as { messagesBySession: Record<string, unknown[]> }).messagesBySession = {};

    render(<ChatPage />);

    expect(await screen.findByText('partner-home')).toBeInTheDocument();
    expect(screen.getByText('最近会话')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '继续工作' }));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set_current_session',
      sessionId: 'session-1'
    });
  });
});
