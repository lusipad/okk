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
  beforeEach(() => {
    localStorage.removeItem('okk.right-sidebar.tab');
  });

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
    localStorage.setItem('okk.right-sidebar.tab', 'overview');
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



  it('当存在待处理知识建议时，默认进入知识视图', () => {
    render(
      <RightSidebar
        suggestions={[
          {
            id: 'suggestion-1',
            title: '提炼成知识',
            summary: '待处理建议',
            category: 'guide',
            tags: ['knowledge'],
            status: 'pending'
          }
        ]}
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

    expect(screen.getByText('知识建议')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '知识' })).toHaveClass('primary-button');
  });

  it('记住用户上次选择的右栏视图', () => {
    localStorage.setItem('okk.right-sidebar.tab', 'timeline');
    render(
      <RightSidebar
        suggestions={[]}
        teamView={{
          ...teamView,
          eventFeed: [
            {
              id: 'event-1',
              type: 'task',
              summary: 'task-1 处理消息已开始',
              createdAt: '2026-01-01T00:00:00.000Z'
            }
          ]
        }}
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

    expect(screen.getByRole('button', { name: '时间线' })).toHaveClass('primary-button');
    expect(screen.getByText('事件流')).toBeInTheDocument();
  });

  it('存在显式偏好时，不会被自动默认 tab 覆盖', () => {
    localStorage.setItem('okk.right-sidebar.tab', 'overview');
    render(
      <RightSidebar
        suggestions={[
          {
            id: 'suggestion-1',
            title: '提炼成知识',
            summary: '待处理建议',
            category: 'guide',
            tags: ['knowledge'],
            status: 'pending'
          }
        ]}
        teamView={{
          ...teamView,
          eventFeed: [
            {
              id: 'event-1',
              type: 'task',
              summary: 'task-1 处理消息已开始',
              createdAt: '2026-01-01T00:00:00.000Z'
            }
          ]
        }}
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

    expect(screen.getByRole('button', { name: '概览' })).toHaveClass('primary-button');
    expect(screen.getByRole('button', { name: '知识' })).not.toHaveClass('primary-button');
    expect(screen.getByRole('button', { name: '时间线' })).not.toHaveClass('primary-button');
  });

  it('localStorage 读取异常时回退到自动默认 tab', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    try {
      render(
        <RightSidebar
          suggestions={[
            {
              id: 'suggestion-1',
              title: '提炼成知识',
              summary: '待处理建议',
              category: 'guide',
              tags: ['knowledge'],
              status: 'pending'
            }
          ]}
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

      expect(screen.getByRole('button', { name: '知识' })).toHaveClass('primary-button');
      expect(screen.getByText('知识建议')).toBeInTheDocument();
    } finally {
      getItemSpy.mockRestore();
    }
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

  it('失败事件在时间线中展示诊断并支持重试动作', async () => {
    const user = userEvent.setup();
    const onRetryLastMessage = vi.fn();

    render(
      <RightSidebar
        suggestions={[]}
        teamView={{
          ...teamView,
          eventFeed: [
            {
              id: 'event-failed',
              type: 'team_end',
              summary: '团队运行失败',
              createdAt: '2026-01-01T00:02:00.000Z',
              runId: 'run-1',
              sourceType: 'team',
              status: 'failed',
              diagnostics: {
                code: 'qa_error',
                message: 'codex 命令不可用',
                detail: '请检查本机 codex 安装',
                retryable: true,
                severity: 'error'
              },
              actions: [{ kind: 'retry', label: '重试消息' }]
            }
          ]
        }}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onRefreshCapabilities={() => undefined}
        onRetryLastMessage={onRetryLastMessage}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: '时间线' }));
    expect(screen.getByText('codex 命令不可用')).toBeInTheDocument();
    expect(screen.getByText('请检查本机 codex 安装')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重试消息' }));
    expect(onRetryLastMessage).toHaveBeenCalledTimes(1);
  });

  it('后端不可用时展示恢复动作并支持刷新能力状态', async () => {
    const user = userEvent.setup();
    const onRefreshCapabilities = vi.fn();

    render(
      <RightSidebar
        suggestions={[]}
        teamView={teamView}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={[
          {
            backend: 'claude-code',
            command: 'claude',
            available: false,
            reason: 'command_not_found',
            sourceType: 'backend',
            runtimeStatus: 'unavailable',
            diagnostics: {
              code: 'backend_unavailable',
              message: 'claude 命令不可用',
              detail: '请确认 claude code 已安装',
              retryable: true,
              severity: 'error'
            },
            actions: [{ kind: 'refresh', label: '重试探测' }]
          }
        ]}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onRefreshCapabilities={onRefreshCapabilities}
        onRetryLastMessage={() => undefined}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    expect(screen.getByText('claude 命令不可用')).toBeInTheDocument();
    expect(screen.getByText('请确认 claude code 已安装')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重试探测' }));
    expect(onRefreshCapabilities).toHaveBeenCalledTimes(1);
  });

  it('能力证据事件支持跳转到对应配置页', async () => {
    const user = userEvent.setup();
    const onOpenRoute = vi.fn();

    render(
      <RightSidebar
        suggestions={[]}
        teamView={{
          ...teamView,
          eventFeed: [
            {
              id: 'event-skill-1',
              type: 'capability_status',
              summary: 'Skill doc 已加入当前请求',
              createdAt: '2026-01-01T00:03:00.000Z',
              runId: 'team-1:skill:doc',
              sourceType: 'skill',
              status: 'ready',
              actions: [{ kind: 'open_route', label: '打开 Skills', route: '/skills' }]
            }
          ]
        }}
        teamRun={teamRun}
        teamRuns={[teamRun]}
        runtimeBackends={runtimeBackends}
        teamRunPending={false}
        teamRunError={null}
        onStartTeamRun={() => undefined}
        onRefreshTeamRuns={() => undefined}
        onRefreshCapabilities={() => undefined}
        onRetryLastMessage={() => undefined}
        onOpenRoute={onOpenRoute}
        onSaveSuggestion={() => undefined}
        onIgnoreSuggestion={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: '时间线' }));
    expect(screen.getByText('Skill doc 已加入当前请求')).toBeInTheDocument();
    expect(screen.getByText('Run team-1:skill:doc')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开 Skills' }));
    expect(onOpenRoute).toHaveBeenCalledWith('/skills');
  });
});




