import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { KnowledgeSharingPage } from '../pages/KnowledgeSharingPage';

const {
  mockNavigate,
  mockListSessions,
  mockListRepos,
  mockGetKnowledgeSharingOverview,
  mockListKnowledgeShares,
  mockListPublishedKnowledgeShares,
  mockReviewKnowledgeShare,
  mockCreateSession,
  mockIo,
  mockDispatch,
  chatState
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockListSessions: vi.fn(),
  mockListRepos: vi.fn(),
  mockGetKnowledgeSharingOverview: vi.fn(),
  mockListKnowledgeShares: vi.fn(),
  mockListPublishedKnowledgeShares: vi.fn(),
  mockReviewKnowledgeShare: vi.fn(),
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
  getKnowledgeSharingOverview: mockGetKnowledgeSharingOverview,
  listKnowledgeShares: mockListKnowledgeShares,
  listPublishedKnowledgeShares: mockListPublishedKnowledgeShares,
  reviewKnowledgeShare: mockReviewKnowledgeShare,
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

const share = {
  id: 'share-1',
  entryId: 'knowledge-1',
  visibility: 'team' as const,
  reviewStatus: 'pending_review' as const,
  requestedBy: 'u-author',
  reviewedBy: null,
  requestNote: '请帮忙审核',
  reviewNote: null,
  publishedAt: null,
  createdAt: '2026-03-14T00:00:00.000Z',
  updatedAt: '2026-03-14T00:00:00.000Z',
  entryTitle: '共享知识',
  entrySummary: '共享摘要',
  entryCategory: 'guide',
  entryStatus: 'published' as const,
  entryTags: ['guide', 'team'],
  repoId: 'repo-1',
  sourceAuthorId: 'u-author',
  sourceAuthorName: 'Author'
};

function renderPage(path: '/knowledge/sharing' | '/knowledge/team') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path='/knowledge/sharing' element={<KnowledgeSharingPage />} />
        <Route path='/knowledge/team' element={<KnowledgeSharingPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('KnowledgeSharingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSessions.mockResolvedValue(chatState.sessions);
    mockListRepos.mockResolvedValue([{ id: 'repo-1', name: 'okclaw', path: '/repo', createdAt: '2026-03-14T00:00:00.000Z' }]);
    mockGetKnowledgeSharingOverview.mockResolvedValue({
      summary: {
        total: 1,
        pendingReview: 1,
        approved: 0,
        published: 0,
        rejected: 0,
        changesRequested: 0
      }
    });
    mockListKnowledgeShares.mockResolvedValue([share]);
    mockListPublishedKnowledgeShares.mockResolvedValue([
      {
        ...share,
        reviewStatus: 'published',
        publishedAt: '2026-03-14T02:00:00.000Z'
      }
    ]);
    mockReviewKnowledgeShare.mockResolvedValue({ ...share, reviewStatus: 'approved', reviewedBy: 'u-reviewer' });
    mockCreateSession.mockResolvedValue({
      id: 'session-new',
      title: '新会话',
      updatedAt: '2026-03-14T00:00:00.000Z'
    });
  });

  it('支持审核待审共享请求', async () => {
    const user = userEvent.setup();
    renderPage('/knowledge/sharing');

    expect(await screen.findByText('知识共享审核')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '共享知识' })).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), '可以发布');
    await user.click(screen.getByRole('button', { name: '批准' }));

    await waitFor(() => {
      expect(mockReviewKnowledgeShare).toHaveBeenCalledWith('share-1', {
        action: 'approve',
        note: '可以发布'
      });
    });
  });

  it('支持团队知识浏览', async () => {
    renderPage('/knowledge/team');

    expect(await screen.findByText('团队知识库')).toBeInTheDocument();
    expect(mockListPublishedKnowledgeShares).toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 3, name: '共享知识' })).toBeInTheDocument();
    expect(screen.getByText(/作者 Author/)).toBeInTheDocument();
  });
});
