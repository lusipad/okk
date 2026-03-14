import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HttpError } from '../io/http-client';
import { KnowledgeImportsPage } from '../pages/KnowledgeImportsPage';

const {
  mockNavigate,
  mockListSessions,
  mockListRepos,
  mockListKnowledgeImportBatches,
  mockGetKnowledgeImportBatch,
  mockPreviewKnowledgeImport,
  mockConfirmKnowledgeImportBatch,
  mockReplayKnowledgeImportBatch,
  mockCreateSession,
  mockIo,
  mockDispatch,
  chatState
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockListSessions: vi.fn(),
  mockListRepos: vi.fn(),
  mockListKnowledgeImportBatches: vi.fn(),
  mockGetKnowledgeImportBatch: vi.fn(),
  mockPreviewKnowledgeImport: vi.fn(),
  mockConfirmKnowledgeImportBatch: vi.fn(),
  mockReplayKnowledgeImportBatch: vi.fn(),
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
  listKnowledgeImportBatches: mockListKnowledgeImportBatches,
  getKnowledgeImportBatch: mockGetKnowledgeImportBatch,
  previewKnowledgeImport: mockPreviewKnowledgeImport,
  confirmKnowledgeImportBatch: mockConfirmKnowledgeImportBatch,
  replayKnowledgeImportBatch: mockReplayKnowledgeImportBatch,
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

function renderPage() {
  return render(
    <MemoryRouter>
      <KnowledgeImportsPage />
    </MemoryRouter>
  );
}

describe('KnowledgeImportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSessions.mockResolvedValue(chatState.sessions);
    mockListRepos.mockResolvedValue([
      { id: 'repo-1', name: 'okclaw', path: '/repo-a', createdAt: '2026-03-10T00:00:00.000Z' },
      { id: 'repo-2', name: 'second', path: '/repo-b', createdAt: '2026-03-10T00:00:00.000Z' }
    ]);
    mockListKnowledgeImportBatches.mockResolvedValue([]);
    mockGetKnowledgeImportBatch.mockResolvedValue(null);
    mockPreviewKnowledgeImport.mockResolvedValue({
      item: {
        id: 'batch-1',
        name: '标准文件导入',
        sourceTypes: ['standard_file'],
        sourceSummary: '标准知识文件 1 个',
        status: 'draft',
        itemCount: 1,
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z'
      },
      items: [
        {
          id: 'item-1',
          batchId: 'batch-1',
          title: 'SQLite 指南',
          summary: '标准知识摘要',
          content: '# SQLite\n\n先跑测试。',
          repoId: 'repo-1',
          sourceType: 'standard_file',
          sourceRef: 'sqlite.md',
          dedupeKey: 'repo-1:sqlite',
          evidence: {
            formatVersion: 1,
            category: 'guide',
            tags: ['sqlite', 'guide']
          },
          status: 'pending',
          mergedEntryId: null,
          createdAt: '2026-03-11T00:00:00.000Z',
          updatedAt: '2026-03-11T00:00:00.000Z'
        }
      ]
    });
    mockConfirmKnowledgeImportBatch.mockResolvedValue({ item: null, items: [], results: [] });
    mockReplayKnowledgeImportBatch.mockResolvedValue({ item: null, items: [] });
    mockCreateSession.mockResolvedValue({
      id: 'session-new',
      title: '新会话',
      updatedAt: '2026-03-11T00:00:00.000Z'
    });
  });

  it('支持上传标准知识文件并生成预览', async () => {
    const user = userEvent.setup();
    renderPage();

    const fileInput = await screen.findByTestId('knowledge-import-file-input');
    const file = new File(
      [
        `---
okk_format: "knowledge_entry"
format_version: 1
title: "SQLite 指南"
summary: "标准知识摘要"
category: "guide"
status: "published"
tags:
  - "sqlite"
source_refs: []
---

# SQLite

先跑测试。
`
      ],
      'sqlite.md',
      { type: 'text/markdown' }
    );

    await user.upload(fileInput, file);
    await user.click(screen.getByTestId('knowledge-import-preview-button'));

    await waitFor(() => {
      expect(mockPreviewKnowledgeImport).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRepoId: 'repo-1',
          files: [
            expect.objectContaining({
              name: 'sqlite.md'
            })
          ]
        })
      );
    });

    expect(await screen.findByText('SQLite 指南')).toBeInTheDocument();
    expect(screen.getByText('已解析 1 个标准知识文件。')).toBeInTheDocument();
  });

  it('标准文件解析失败时展示结构化错误', async () => {
    const user = userEvent.setup();
    mockPreviewKnowledgeImport.mockRejectedValue(
      new HttpError(400, 'HTTP 400: Bad Request - 标准知识文件校验失败', {
        errors: [
          {
            code: 'unsupported_version',
            fileName: 'bad.md',
            field: 'format_version',
            message: '不支持的 format_version: 99'
          }
        ]
      })
    );

    renderPage();
    const fileInput = await screen.findByTestId('knowledge-import-file-input');
    const file = new File(['bad'], 'bad.md', { type: 'text/markdown' });
    await user.upload(fileInput, file);
    await user.click(screen.getByTestId('knowledge-import-preview-button'));

    expect(await screen.findByText('格式校验错误')).toBeInTheDocument();
    expect(screen.getAllByText('bad.md').length).toBeGreaterThan(0);
    expect(screen.getByText('不支持的 format_version: 99')).toBeInTheDocument();
  });
});
