import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { KnowledgeSubscriptionsPage } from '../pages/KnowledgeSubscriptionsPage';

const {
  mockNavigate,
  mockListSessions,
  mockListRepos,
  mockListKnowledgeSubscriptions,
  mockCreateKnowledgeSubscription,
  mockUpdateKnowledgeSubscription,
  mockSyncKnowledgeSubscription,
  mockListKnowledgeSubscriptionUpdates,
  mockImportKnowledgeSubscriptionUpdate,
  mockCreateSession,
  mockIo,
  mockDispatch,
  chatState
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockListSessions: vi.fn(),
  mockListRepos: vi.fn(),
  mockListKnowledgeSubscriptions: vi.fn(),
  mockCreateKnowledgeSubscription: vi.fn(),
  mockUpdateKnowledgeSubscription: vi.fn(),
  mockSyncKnowledgeSubscription: vi.fn(),
  mockListKnowledgeSubscriptionUpdates: vi.fn(),
  mockImportKnowledgeSubscriptionUpdate: vi.fn(),
  mockCreateSession: vi.fn(),
  mockIo: {} as Record<string, unknown>,
  mockDispatch: vi.fn(),
  chatState: {
    sessions: [
      {
        id: 'session-1',
        title: '当前会话',
        repoId: 'repo-1',
        updatedAt: '2026-03-14T00:00:00.000Z'
      }
    ],
    currentSessionId: 'session-1',
    agents: [],
    selectedAgentId: null,
    selectedSkillIds: [],
    selectedMcpServerIds: [],
    connectionState: 'connected',
    messagesBySession: {},
    suggestionsBySession: {},
    teamViewBySession: {},
    runtimeStateBySession: {},
    lastEventIdBySession: {},
    seenEventIdsBySession: {}
  }
}));

Object.assign(mockIo, {
  listSessions: mockListSessions,
  listRepos: mockListRepos,
  listKnowledgeSubscriptions: mockListKnowledgeSubscriptions,
  createKnowledgeSubscription: mockCreateKnowledgeSubscription,
  updateKnowledgeSubscription: mockUpdateKnowledgeSubscription,
  syncKnowledgeSubscription: mockSyncKnowledgeSubscription,
  listKnowledgeSubscriptionUpdates: mockListKnowledgeSubscriptionUpdates,
  importKnowledgeSubscriptionUpdate: mockImportKnowledgeSubscriptionUpdate,
  createSession: mockCreateSession
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
  ShellLayout: ({ center }: { center: React.ReactNode }) => <div>{center}</div>
}));

vi.mock('../components/layout/LeftSidebar', () => ({
  LeftSidebar: () => <div>left-sidebar</div>
}));

vi.mock('../components/layout/RightSidebar', () => ({
  RightSidebar: () => <div>right-sidebar</div>
}));

const subscription = {
  id: 'subscription-1',
  userId: 'u-admin',
  source: {
    type: 'project' as const,
    id: 'repo-1',
    label: '来源项目',
    repoId: 'repo-1',
    tag: null,
    metadata: {}
  },
  targetRepoId: 'repo-2',
  status: 'active' as const,
  lastCursor: '2026-03-14T00:00:00.000Z',
  lastSyncedAt: '2026-03-14T00:00:00.000Z',
  lastSyncStatus: 'success' as const,
  lastSyncSummary: '同步 1 条更新',
  pendingUpdateCount: 1,
  createdAt: '2026-03-14T00:00:00.000Z',
  updatedAt: '2026-03-14T00:00:00.000Z'
};

const update = {
  id: 'update-1',
  subscriptionId: 'subscription-1',
  shareId: 'share-1',
  sourceEntryId: 'knowledge-1',
  title: '共享发布流程',
  summary: '共享发布摘要',
  category: 'guide',
  repoId: 'repo-1',
  tags: ['release'],
  sourceAuthorId: 'u-author',
  sourceAuthorName: 'Author',
  sourceUpdatedAt: '2026-03-14T00:00:00.000Z',
  consumeStatus: 'pending' as const,
  importedEntryId: null,
  consumedAt: null,
  createdAt: '2026-03-14T00:00:00.000Z',
  updatedAt: '2026-03-14T00:00:00.000Z'
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/knowledge/subscriptions']}>
      <Routes>
        <Route path='/knowledge/subscriptions' element={<KnowledgeSubscriptionsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('KnowledgeSubscriptionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSessions.mockResolvedValue(chatState.sessions);
    mockListRepos.mockResolvedValue([
      { id: 'repo-1', name: 'repo-one', path: '/repo-1', createdAt: '2026-03-14T00:00:00.000Z' },
      { id: 'repo-2', name: 'repo-two', path: '/repo-2', createdAt: '2026-03-14T00:00:00.000Z' }
    ]);
    mockListKnowledgeSubscriptions.mockResolvedValue([subscription]);
    mockListKnowledgeSubscriptionUpdates.mockResolvedValue({
      item: subscription,
      items: [update]
    });
    mockSyncKnowledgeSubscription.mockResolvedValue({
      item: subscription,
      items: [update]
    });
    mockCreateKnowledgeSubscription.mockResolvedValue({
      ...subscription,
      id: 'subscription-2',
      source: {
        type: 'topic',
        id: 'release',
        label: 'Release Topic',
        repoId: null,
        tag: 'release',
        metadata: {}
      }
    });
    mockUpdateKnowledgeSubscription.mockResolvedValue({
      ...subscription,
      source: {
        ...subscription.source,
        label: '新的来源名称'
      },
      status: 'paused'
    });
    mockImportKnowledgeSubscriptionUpdate.mockResolvedValue({
      item: {
        ...update,
        consumeStatus: 'imported',
        importedEntryId: 'knowledge-target',
        consumedAt: '2026-03-14T01:00:00.000Z'
      },
      entry: {
        id: 'knowledge-target',
        title: '共享发布流程',
        content: '导入内容',
        summary: '导入摘要',
        repoId: 'repo-2',
        category: 'guide',
        sourceSessionId: null,
        qualityScore: 0,
        viewCount: 0,
        upvoteCount: 0,
        version: 1,
        status: 'published',
        tags: ['release'],
        metadata: {},
        createdBy: 'u-admin',
        createdAt: '2026-03-14T01:00:00.000Z',
        updatedAt: '2026-03-14T01:00:00.000Z'
      },
      subscription: {
        ...subscription,
        pendingUpdateCount: 0
      }
    });
    mockCreateSession.mockResolvedValue({
      id: 'session-new',
      title: '新会话',
      updatedAt: '2026-03-14T00:00:00.000Z'
    });
  });

  it('支持同步并导入订阅更新', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: '知识订阅' })).toBeInTheDocument();
    expect(await screen.findByTestId('knowledge-subscription-subscription-1')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockListKnowledgeSubscriptionUpdates).toHaveBeenCalledWith('subscription-1');
    });
    expect(await screen.findByTestId('knowledge-subscription-import-update-1')).toBeInTheDocument();

    await user.click(screen.getByTestId('knowledge-subscription-sync-button'));
    await waitFor(() => {
      expect(mockSyncKnowledgeSubscription).toHaveBeenCalledWith('subscription-1');
    });

    await user.click(screen.getByTestId('knowledge-subscription-import-update-1'));
    await waitFor(() => {
      expect(mockImportKnowledgeSubscriptionUpdate).toHaveBeenCalledWith('update-1');
    });
    expect(await screen.findByText(/已处理更新/)).toBeInTheDocument();
  });

  it('支持创建和保存订阅', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId('knowledge-subscription-subscription-1');
    await user.selectOptions(screen.getByTestId('knowledge-subscription-source-type'), 'topic');
    await user.type(screen.getByTestId('knowledge-subscription-source-id'), 'release');
    await user.type(screen.getByTestId('knowledge-subscription-source-label'), 'Release Topic');
    await user.selectOptions(screen.getByTestId('knowledge-subscription-target-repo'), 'repo-2');
    await user.click(screen.getByTestId('knowledge-subscription-create-button'));

    await waitFor(() => {
      expect(mockCreateKnowledgeSubscription).toHaveBeenCalledWith({
        sourceType: 'topic',
        sourceId: 'release',
        sourceLabel: 'Release Topic',
        targetRepoId: 'repo-2'
      });
    });

    const detailLabel = screen.getByTestId('knowledge-subscription-detail-label');
    await user.clear(detailLabel);
    await user.type(detailLabel, '新的来源名称');
    await user.click(screen.getByTestId('knowledge-subscription-detail-enabled'));
    await user.click(screen.getByTestId('knowledge-subscription-save-button'));

    await waitFor(() => {
      expect(mockUpdateKnowledgeSubscription).toHaveBeenCalledWith('subscription-1', {
        sourceLabel: '新的来源名称',
        targetRepoId: 'repo-2',
        enabled: false
      });
    });
  });
});
