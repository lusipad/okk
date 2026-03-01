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
});
