import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { KnowledgePage } from '../pages/KnowledgePage';

const {
  mockNavigate,
  mockListSessions,
  mockListRepos,
  mockListKnowledgeEntries,
  mockSearchKnowledgeEntries,
  mockGetKnowledgeEntry,
  mockGetKnowledgeVersions,
  mockGetKnowledgeShareByEntry,
  mockRequestKnowledgeShare,
  mockCreateKnowledgeEntry,
  mockUpdateKnowledgeEntry,
  mockDeleteKnowledgeEntry,
  mockExportKnowledgeEntry,
  mockExportKnowledgeEntries,
  mockCreateSession,
  mockIo,
  mockDispatch,
  chatState
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockListSessions: vi.fn(),
  mockListRepos: vi.fn(),
  mockListKnowledgeEntries: vi.fn(),
  mockSearchKnowledgeEntries: vi.fn(),
  mockGetKnowledgeEntry: vi.fn(),
  mockGetKnowledgeVersions: vi.fn(),
  mockGetKnowledgeShareByEntry: vi.fn(),
  mockRequestKnowledgeShare: vi.fn(),
  mockCreateKnowledgeEntry: vi.fn(),
  mockUpdateKnowledgeEntry: vi.fn(),
  mockDeleteKnowledgeEntry: vi.fn(),
  mockExportKnowledgeEntry: vi.fn(),
  mockExportKnowledgeEntries: vi.fn(),
  mockCreateSession: vi.fn(),
  mockIo: {} as Record<string, unknown>,
  mockDispatch: vi.fn(),
  chatState: {
    sessions: [
      {
        id: 'session-1',
        title: '当前会话',
        repoId: 'repo-1',
        updatedAt: '2026-03-11T00:00:00.000Z'
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
  listKnowledgeEntries: mockListKnowledgeEntries,
  searchKnowledgeEntries: mockSearchKnowledgeEntries,
  getKnowledgeEntry: mockGetKnowledgeEntry,
  getKnowledgeVersions: mockGetKnowledgeVersions,
  getKnowledgeShareByEntry: mockGetKnowledgeShareByEntry,
  requestKnowledgeShare: mockRequestKnowledgeShare,
  createKnowledgeEntry: mockCreateKnowledgeEntry,
  updateKnowledgeEntry: mockUpdateKnowledgeEntry,
  deleteKnowledgeEntry: mockDeleteKnowledgeEntry,
  exportKnowledgeEntry: mockExportKnowledgeEntry,
  exportKnowledgeEntries: mockExportKnowledgeEntries,
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

const entry = {
  id: 'knowledge-1',
  title: 'SQLite 指南',
  content: 'SQLite 内容',
  summary: 'SQLite 摘要',
  repoId: 'repo-1',
  category: 'guide',
  sourceSessionId: 'session-1',
  qualityScore: 0,
  viewCount: 2,
  upvoteCount: 0,
  version: 2,
  status: 'published' as const,
  tags: ['sqlite', 'guide'],
  metadata: {},
  createdBy: 'u-admin',
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-11T00:00:00.000Z'
};

function renderPage(path = '/knowledge/knowledge-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path='/knowledge' element={<KnowledgePage />} />
        <Route path='/knowledge/:entryId' element={<KnowledgePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('KnowledgePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSessions.mockResolvedValue(chatState.sessions);
    mockListRepos.mockResolvedValue([
      { id: 'repo-1', name: 'okclaw', path: '/repo', createdAt: '2026-03-10T00:00:00.000Z' }
    ]);
    mockListKnowledgeEntries.mockResolvedValue([entry]);
    mockSearchKnowledgeEntries.mockResolvedValue([
      {
        ...entry,
        snippet: '命中 SQLite 片段',
        highlightedTitle: '<mark>SQLite</mark> 指南',
        relevance: 0.1
      }
    ]);
    mockGetKnowledgeEntry.mockResolvedValue(entry);
    mockGetKnowledgeVersions.mockResolvedValue([
      {
        id: 'version-1',
        entryId: 'knowledge-1',
        version: 1,
        title: 'SQLite 指南',
        content: '早期内容',
        summary: '早期摘要',
        category: 'guide',
        metadata: {},
        changeSummary: 'initial',
        editedBy: 'u-admin',
        createdAt: '2026-03-10T00:00:00.000Z'
      },
      {
        id: 'version-2',
        entryId: 'knowledge-1',
        version: 2,
        title: 'SQLite 指南',
        content: 'SQLite 内容',
        summary: 'SQLite 摘要',
        category: 'guide',
        metadata: {},
        changeSummary: 'knowledge-page-save',
        editedBy: 'u-admin',
        createdAt: '2026-03-11T00:00:00.000Z'
      }
    ]);
    mockGetKnowledgeShareByEntry.mockResolvedValue({ item: null, reviews: [] });
    mockRequestKnowledgeShare.mockResolvedValue({
      id: 'share-1',
      entryId: 'knowledge-1',
      visibility: 'team',
      reviewStatus: 'pending_review',
      requestedBy: 'u-admin',
      reviewedBy: null,
      requestNote: '请审核',
      reviewNote: null,
      publishedAt: null,
      createdAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
      entryTitle: 'SQLite 指南',
      entrySummary: 'SQLite 摘要',
      entryCategory: 'guide',
      entryStatus: 'published',
      entryTags: ['sqlite', 'guide'],
      repoId: 'repo-1',
      sourceAuthorId: 'u-admin',
      sourceAuthorName: '管理员'
    });
    mockCreateKnowledgeEntry.mockResolvedValue(entry);
    mockUpdateKnowledgeEntry.mockResolvedValue(entry);
    mockDeleteKnowledgeEntry.mockResolvedValue(undefined);
    mockExportKnowledgeEntry.mockResolvedValue({
      fileName: 'SQLite-指南.md',
      formatVersion: 1,
      content: '# SQLite'
    });
    mockExportKnowledgeEntries.mockResolvedValue({
      formatVersion: 1,
      manifest: {
        kind: 'knowledge_export_manifest',
        formatVersion: 1,
        exportedAt: '2026-03-11T00:00:00.000Z',
        itemCount: 1,
        items: [
          {
            entryId: 'knowledge-1',
            title: 'SQLite 指南',
            fileName: 'SQLite-指南.md',
            category: 'guide',
            status: 'published',
            tags: ['sqlite', 'guide'],
            formatVersion: 1
          }
        ]
      },
      manifestFile: {
        fileName: 'knowledge-export-manifest.json',
        content: '{"itemCount":1}'
      },
      files: [
        {
          entryId: 'knowledge-1',
          title: 'SQLite 指南',
          fileName: 'SQLite-指南.md',
          formatVersion: 1,
          content: '# SQLite'
        }
      ]
    });
    mockCreateSession.mockResolvedValue({
      id: 'session-new',
      title: '新会话',
      updatedAt: '2026-03-11T00:00:00.000Z'
    });
  });

  it('支持深链接加载知识详情与版本历史', async () => {
    renderPage();

    expect(await screen.findByDisplayValue('SQLite 指南')).toBeInTheDocument();
    expect(mockGetKnowledgeEntry).toHaveBeenCalledWith('knowledge-1');
    expect(screen.getByTestId('knowledge-version-list')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('修改搜索词时触发知识搜索', async () => {
    const user = userEvent.setup();
    renderPage('/knowledge');

    const searchInput = await screen.findByTestId('knowledge-search-input');
    await user.type(searchInput, 'sqlite');

    await waitFor(() => {
      expect(mockSearchKnowledgeEntries).toHaveBeenCalled();
    });
  });

  it('支持保存知识详情修改', async () => {
    const user = userEvent.setup();
    mockUpdateKnowledgeEntry.mockResolvedValue({
      ...entry,
      title: 'SQLite 最佳实践',
      content: '更新后的内容'
    });

    renderPage();

    const titleInput = await screen.findByTestId('knowledge-title-input');
    await user.clear(titleInput);
    await user.type(titleInput, 'SQLite 最佳实践');

    const contentInput = screen.getByTestId('knowledge-content-input');
    await user.clear(contentInput);
    await user.type(contentInput, '更新后的内容');

    await user.click(screen.getByTestId('knowledge-save-button'));

    await waitFor(() => {
      expect(mockUpdateKnowledgeEntry).toHaveBeenCalledWith(
        'knowledge-1',
        expect.objectContaining({
          title: 'SQLite 最佳实践',
          content: '更新后的内容',
          changeSummary: 'knowledge-page-save'
        })
      );
    });
  });

  it('支持从知识详情发起共享请求', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('SQLite 指南');
    await user.type(screen.getByPlaceholderText('给审核人的补充说明'), '请审核');
    await user.click(screen.getByTestId('knowledge-share-button'));

    await waitFor(() => {
      expect(mockRequestKnowledgeShare).toHaveBeenCalledWith('knowledge-1', 'team', '请审核');
    });
  });

  it('提供知识订阅入口', async () => {
    const user = userEvent.setup();
    renderPage('/knowledge');

    await screen.findByTestId('knowledge-entry-knowledge-1');
    await user.click(screen.getByRole('button', { name: '订阅源' }));

    expect(mockNavigate).toHaveBeenCalledWith('/knowledge/subscriptions');
  });

  it('支持从知识详情导出 Markdown', async () => {
    const user = userEvent.setup();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = vi.fn(() => 'blob:knowledge-export');
    const revokeObjectURLMock = vi.fn();
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    renderPage();
    await screen.findByDisplayValue('SQLite 指南');
    await user.click(screen.getByTestId('knowledge-export-button'));

    await waitFor(() => {
      expect(mockExportKnowledgeEntry).toHaveBeenCalledWith('knowledge-1');
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    anchorClickSpy.mockRestore();
  });

  it('支持从列表批量导出选中的知识', async () => {
    const user = userEvent.setup();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = vi.fn(() => 'blob:knowledge-batch-export');
    const revokeObjectURLMock = vi.fn();
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    renderPage('/knowledge');
    await screen.findByTestId('knowledge-entry-knowledge-1');
    await user.click(screen.getByTestId('knowledge-select-knowledge-1'));
    await user.click(screen.getByTestId('knowledge-batch-export-button'));

    await waitFor(() => {
      expect(mockExportKnowledgeEntries).toHaveBeenCalledWith(['knowledge-1']);
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(anchorClickSpy).toHaveBeenCalledTimes(2);

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    anchorClickSpy.mockRestore();
  });
});
