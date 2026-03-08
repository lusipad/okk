import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { LeftSidebar } from '../components/layout/LeftSidebar';

describe('LeftSidebar', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('按时间分组展示会话', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'));
    render(
      <MemoryRouter initialEntries={['/']}>
        <LeftSidebar
          sessions={[
            { id: 'session-1', title: '今天会话', updatedAt: '2026-03-01T09:00:00.000Z' },
            { id: 'session-2', title: '昨天会话', updatedAt: '2026-02-28T09:00:00.000Z' },
            { id: 'session-3', title: '更早会话', updatedAt: '2026-02-20T09:00:00.000Z' }
          ]}
          currentSessionId='session-1'
          onSelectSession={() => undefined}
          onCreateSession={() => undefined}
        />
      </MemoryRouter>
    );

    const groupLabels = screen.getAllByText(/今天|昨天|更早/);
    expect(groupLabels.some((item) => item.className.includes('session-group-label') && item.textContent === '今天')).toBe(true);
    expect(groupLabels.some((item) => item.className.includes('session-group-label') && item.textContent === '昨天')).toBe(true);
    expect(groupLabels.some((item) => item.className.includes('session-group-label') && item.textContent === '更早')).toBe(true);
  });

  it('支持按标题筛选会话', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <LeftSidebar
          sessions={[
            { id: 'session-1', title: '重构右侧任务图', updatedAt: '2026-02-01T00:00:00.000Z' },
            { id: 'session-2', title: '修复登录与空白页', updatedAt: '2026-02-02T00:00:00.000Z' }
          ]}
          currentSessionId='session-1'
          onSelectSession={() => undefined}
          onCreateSession={() => undefined}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('重构右侧任务图')).toBeInTheDocument();
    expect(screen.getByText('修复登录与空白页')).toBeInTheDocument();

    await user.type(screen.getByTestId('session-search-input'), '登录');
    expect(screen.queryByText('重构右侧任务图')).not.toBeInTheDocument();
    expect(screen.getByText('修复登录与空白页')).toBeInTheDocument();
  });

  it('展示分层信息架构并支持 Search 入口', async () => {
    const user = userEvent.setup();
    const commandListener = vi.fn();
    window.addEventListener('okk:command-palette', commandListener as EventListener);

    render(
      <MemoryRouter initialEntries={['/']}>
        <LeftSidebar
          sessions={[{ id: 'session-1', title: '重构右侧任务图', updatedAt: '2026-02-01T00:00:00.000Z' }]}
          currentSessionId='session-1'
          onSelectSession={() => undefined}
          onCreateSession={() => undefined}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    expect(screen.getByText('Search', { selector: '.sidebar-section-label' })).toBeInTheDocument();
    expect(screen.getByText('Primary links', { selector: '.sidebar-section-label' })).toBeInTheDocument();
    expect(screen.getAllByText('Chats').length).toBeGreaterThan(0);
    expect(screen.getByTestId('nav-workspaces')).toBeInTheDocument();
    expect(screen.getByTestId('nav-governance')).toBeInTheDocument();
    expect(screen.getByTestId('nav-workflows')).toBeInTheDocument();
    expect(screen.getByTestId('nav-memory-sharing')).toBeInTheDocument();

    await user.click(screen.getByTestId('sidebar-search-trigger'));
    expect(commandListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('okk:command-palette', commandListener as EventListener);
  });

  it('筛选无结果时显示空态提示', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <LeftSidebar
          sessions={[{ id: 'session-1', title: '重构右侧任务图', updatedAt: '2026-02-01T00:00:00.000Z' }]}
          currentSessionId='session-1'
          onSelectSession={() => undefined}
          onCreateSession={() => undefined}
        />
      </MemoryRouter>
    );

    await user.type(screen.getByTestId('session-search-input'), '不存在');
    expect(screen.getByText('没有匹配“不存在”的会话。')).toBeInTheDocument();
  });

  it('展示项目上下文并支持继续上次工作与记住偏好', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onSave = vi.fn();

    render(
      <MemoryRouter initialEntries={['/']}>
        <LeftSidebar
          sessions={[{ id: 'session-1', title: '重构右侧任务图', repoId: 'repo-1', updatedAt: '2026-02-01T00:00:00.000Z' }]}
          currentSessionId='session-1'
          projectContext={{
            repoName: 'okk',
            preferredAgentName: 'code-reviewer',
            lastActivitySummary: '继续修复登录流程'
          }}
          onSelectSession={() => undefined}
          onCreateSession={() => undefined}
          onContinueProjectContext={onContinue}
          onSaveProjectContext={onSave}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('sidebar-project-context')).toBeInTheDocument();
    expect(screen.getByText('当前仓库：okk')).toBeInTheDocument();
    expect(screen.getByText('偏好 Agent：code-reviewer')).toBeInTheDocument();
    expect(screen.getByText('最近活动：继续修复登录流程')).toBeInTheDocument();

    await user.click(screen.getByTestId('sidebar-project-continue'));
    await user.click(screen.getByTestId('sidebar-project-save'));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

it('支持归档视图切换与引用动作', async () => {
  const user = userEvent.setup();
  const onArchive = vi.fn();
  const onRestore = vi.fn();
  const onReference = vi.fn();

  render(
    <MemoryRouter initialEntries={['/']}>
      <LeftSidebar
        sessions={[
          { id: 'session-1', title: '活跃会话', summary: '处理登录问题', tags: ['login'], updatedAt: '2026-02-01T00:00:00.000Z' },
          { id: 'session-2', title: '已归档会话', summary: '旧排查记录', tags: ['archive'], archivedAt: '2026-02-02T00:00:00.000Z', updatedAt: '2026-02-02T00:00:00.000Z' }
        ]}
        currentSessionId='session-1'
        onSelectSession={() => undefined}
        onCreateSession={() => undefined}
        onArchiveSession={onArchive}
        onRestoreSession={onRestore}
        onReferenceSession={onReference}
      />
    </MemoryRouter>
  );

  expect(screen.getByText('活跃会话')).toBeInTheDocument();
  await user.click(screen.getByTestId('session-archive-session-1'));
  await user.click(screen.getByTestId('session-reference-session-1'));
  expect(onArchive).toHaveBeenCalledWith('session-1');
  expect(onReference).toHaveBeenCalledWith('session-1');

  await user.click(screen.getByTestId('sidebar-archived-toggle'));
  expect(screen.getByText('已归档会话')).toBeInTheDocument();
  await user.click(screen.getByTestId('session-restore-session-2'));
  expect(onRestore).toHaveBeenCalledWith('session-2');
});
