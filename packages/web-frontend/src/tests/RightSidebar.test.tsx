import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { RightSidebar } from '../components/layout/RightSidebar';
import type { KnowledgeSuggestion, TeamPanelState } from '../types/domain';
import type { RuntimeBackendHealth, TeamRunRecord } from '../io/types';

const teamView: TeamPanelState = {
  teamName: 'Q&A Team',
  status: 'running',
  members: [
    {
      memberId: 'codex:reviewer',
      agentName: 'code-reviewer',
      backend: 'codex',
      status: 'running',
      currentTask: '处理消息',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  tasks: [
    {
      taskId: 'task-1',
      title: '处理消息',
      status: 'running',
      dependsOn: []
    }
  ],
  messages: [
    {
      id: 'msg-1',
      memberId: 'codex:reviewer',
      content: '开始处理请求',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  eventFeed: []
};

function expectKpi(summaryRegion: HTMLElement, label: string, value: number): void {
  const card = within(summaryRegion).getByText(label).closest('article');
  expect(card).not.toBeNull();
  expect(within(card as HTMLElement).getByText(String(value))).toBeInTheDocument();
}

const runtimeBackends: RuntimeBackendHealth[] = [
  {
    backend: 'codex',
    command: 'codex',
    available: true
  },
  {
    backend: 'claude-code',
    command: 'claude',
    available: false,
    reason: 'command_not_found'
  }
];

const teamRun: TeamRunRecord = {
  id: 'run-1',
  teamId: 'team-session-1',
  sessionId: 'session-1',
  teamName: '协作执行',
  status: 'running',
  memberCount: 2,
  startedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:01:00.000Z',
  summary: '1/2 成员完成',
  members: []
};

describe('RightSidebar', () => {
  it('渲染 Team 成员、任务和消息', () => {
    render(
      <RightSidebar
        suggestions={[]}
        teamView={teamView}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    expect(screen.getByText('Q&A Team')).toBeInTheDocument();
    expect(screen.getByText('code-reviewer')).toBeInTheDocument();
    expect(screen.getAllByText('处理消息').length).toBeGreaterThan(0);
    expect(screen.getByText('开始处理请求')).toBeInTheDocument();
  });

  it('Team 摘要区保持四个 KPI 卡片，并且建议数仅统计 pending', () => {
    const suggestions: KnowledgeSuggestion[] = [
      {
        id: 's1',
        title: '待保存建议',
        summary: 'pending',
        category: '测试',
        tags: [],
        status: 'pending'
      },
      {
        id: 's2',
        title: '已保存建议',
        summary: 'saved',
        category: '测试',
        tags: [],
        status: 'saved'
      },
      {
        id: 's3',
        title: '已忽略建议',
        summary: 'ignored',
        category: '测试',
        tags: [],
        status: 'ignored'
      }
    ];

    render(
      <RightSidebar
        suggestions={suggestions}
        teamView={teamView}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    const summaryRegion = screen.getByRole('region', { name: 'Team 摘要' });
    expect(within(summaryRegion).getAllByRole('article')).toHaveLength(4);

    expectKpi(summaryRegion, '成员', teamView.members.length);
    expectKpi(summaryRegion, '任务', teamView.tasks.length);
    expectKpi(summaryRegion, '事件', teamView.eventFeed.length);
    expectKpi(summaryRegion, '建议', 1);
  });

  it('支持切换到任务图视图并展示任务依赖节点', async () => {
    const user = userEvent.setup();
    render(
      <RightSidebar
        suggestions={[]}
        teamView={teamView}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: '任务图' }));
    expect(screen.getByText('任务依赖图')).toBeInTheDocument();
    expect(screen.getByText('节点: task-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关键路径' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '批量定位' })).toBeDisabled();
    expect(screen.getByText(/缩放/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'DAG 缩略图' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳转关联事件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置布局' })).toBeInTheDocument();
  });

  it('支持导出团队报告', async () => {
    const user = userEvent.setup();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = vi.fn(() => 'blob:team-report');
    const revokeObjectURLMock = vi.fn();
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <RightSidebar
        suggestions={[]}
        teamView={teamView}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: '导出报告' }));
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    anchorClickSpy.mockRestore();
  });

  it('支持任务图多选并批量定位到时间线', async () => {
    const user = userEvent.setup();
    const richTeamView: TeamPanelState = {
      ...teamView,
      tasks: [
        { taskId: 'task-1', title: '处理消息', status: 'running', dependsOn: [] },
        { taskId: 'task-2', title: '汇总结果', status: 'pending', dependsOn: ['task-1'] }
      ],
      eventFeed: [
        {
          id: 'event-1',
          type: 'task',
          summary: 'task-1 处理消息已开始',
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'event-2',
          type: 'task',
          summary: 'task-2 汇总结果等待执行',
          createdAt: '2026-01-01T00:01:00.000Z'
        }
      ]
    };

    render(
      <RightSidebar
        suggestions={[]}
        teamView={richTeamView}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: '任务图' }));
    const batchButton = screen.getByRole('button', { name: '批量定位' });
    expect(batchButton).toBeDisabled();

    const graphNodeButtons = screen.getAllByTitle('点击定位时间线；按 Shift/Ctrl 可多选节点');
    expect(graphNodeButtons).toHaveLength(2);
    await user.keyboard('{Control>}');
    await user.click(graphNodeButtons[0]);
    await user.click(graphNodeButtons[1]);
    await user.keyboard('{/Control}');

    expect(batchButton).toBeEnabled();
    await user.click(batchButton);

    expect(screen.getByText('事件流')).toBeInTheDocument();
    expect(screen.getByText('task-1 处理消息已开始')).toBeInTheDocument();
    expect(screen.getByText('task-2 汇总结果等待执行')).toBeInTheDocument();
    expect(document.querySelectorAll('.team-event-focus').length).toBeGreaterThan(0);
  });

  it('支持重置布局并清空已选节点', async () => {
    const user = userEvent.setup();
    const richTeamView: TeamPanelState = {
      ...teamView,
      tasks: [
        { taskId: 'task-1', title: '处理消息', status: 'running', dependsOn: [] },
        { taskId: 'task-2', title: '汇总结果', status: 'pending', dependsOn: ['task-1'] }
      ]
    };

    render(
      <RightSidebar
        suggestions={[]}
        teamView={richTeamView}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: '任务图' }));
    const batchButton = screen.getByRole('button', { name: '批量定位' });
    const graphNodeButtons = screen.getAllByTitle('点击定位时间线；按 Shift/Ctrl 可多选节点');
    await user.keyboard('{Control>}');
    await user.click(graphNodeButtons[0]);
    await user.click(graphNodeButtons[1]);
    await user.keyboard('{/Control}');
    expect(batchButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '重置布局' }));
    expect(batchButton).toBeDisabled();
  });

  it('支持在时间线中筛选事件', async () => {
    const user = userEvent.setup();
    const richTeamView: TeamPanelState = {
      ...teamView,
      eventFeed: [
        {
          id: 'event-1',
          type: 'task',
          summary: 'task-1 处理消息已开始',
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'event-2',
          type: 'knowledge',
          summary: '知识建议已生成',
          createdAt: '2026-01-01T00:01:00.000Z'
        }
      ]
    };

    render(
      <RightSidebar
        suggestions={[]}
        teamView={richTeamView}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: '时间线' }));
    await user.type(screen.getByPlaceholderText('筛选事件类型或摘要'), 'knowledge');
    expect(screen.queryByText('task-1 处理消息已开始')).not.toBeInTheDocument();
    expect(screen.getByText('知识建议已生成')).toBeInTheDocument();
  });
});
