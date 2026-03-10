import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PartnerHomeView } from '../components/home/PartnerHomeView';

describe('PartnerHomeView', () => {
  it('展示问候、最近会话和快捷操作', async () => {
    const user = userEvent.setup();
    const onSelectSession = vi.fn();
    const onContinueWork = vi.fn();
    const onApplyQuickAction = vi.fn();

    render(
      <PartnerHomeView
        partnerName='OKK Copilot'
        loading={false}
        recentSessions={[
          {
            id: 'session-1',
            title: '修复登录问题',
            summary: '继续排查鉴权失败',
            updatedAt: '2026-03-01T09:00:00.000Z'
          },
          {
            id: 'session-2',
            title: '收敛导航层级',
            summary: '整理侧栏主次分层',
            updatedAt: '2026-03-01T08:00:00.000Z'
          }
        ]}
        continueCandidate={{
          source: 'repo',
          title: 'okk',
          repoName: 'okk',
          summary: '继续修复登录流程'
        }}
        summaryCard={{
          loading: false,
          item: {
            identity: {
              id: 'identity-1',
              name: 'OKK Copilot',
              summary: '熟悉你的仓库偏好与协作方式',
              isActive: true
            },
            memoryCount: 2,
            recentMemories: [
              {
                id: 'memory-1',
                title: '测试优先',
                summary: '提交前先跑测试',
                memoryType: 'process'
              }
            ],
            activeRepoName: 'okk'
          }
        }}
        activeMissions={[
          {
            id: 'mission-1',
            title: '统一 Figma 页面拆分',
            goal: '统一页面结构',
            status: 'active',
            phase: 'execute',
            repoId: 'repo-1',
            sessionId: 'session-1',
            ownerPartnerId: 'identity-1',
            partnerCount: 3,
            workstreamTotal: 5,
            workstreamCompleted: 3,
            blockedCount: 1,
            openCheckpointCount: 2,
            updatedAt: '2026-03-01T09:10:00.000Z'
          }
        ]}
        quickActions={[
          {
            id: 'next-step',
            label: '梳理下一步',
            description: '快速梳理当前最重要的任务',
            prompt: '请帮我梳理下一步'
          }
        ]}
        onSelectSession={onSelectSession}
        onContinueWork={onContinueWork}
        onApplyQuickAction={onApplyQuickAction}
      />
    );

    expect(screen.getByText('欢迎回来，OKK Copilot')).toBeInTheDocument();
    expect(screen.getByText('修复登录问题')).toBeInTheDocument();
    expect(screen.getByTestId('partner-home-summary-card')).toBeInTheDocument();
    expect(screen.getByText('测试优先')).toBeInTheDocument();
    expect(screen.getByTestId('partner-home-continue-card')).toBeInTheDocument();
    expect(screen.getByText('梳理下一步')).toBeInTheDocument();
    expect(screen.getByText('统一 Figma 页面拆分')).toBeInTheDocument();

    await user.click(screen.getByTestId('partner-home-session-session-1'));
    await user.click(screen.getByTestId('partner-home-continue-button'));
    await user.click(screen.getByTestId('partner-home-action-next-step'));

    expect(onSelectSession).toHaveBeenCalledWith('session-1');
    expect(onContinueWork).toHaveBeenCalledTimes(1);
    expect(onApplyQuickAction).toHaveBeenCalledWith('请帮我梳理下一步');
  });

  it('无 repo 时展示最近会话 continue fallback', async () => {
    const user = userEvent.setup();
    const onContinueWork = vi.fn();

    render(
      <PartnerHomeView
        partnerName='OKK Copilot'
        loading={false}
        recentSessions={[
          {
            id: 'session-2',
            title: '最近会话',
            summary: '回到这条会话继续工作',
            updatedAt: '2026-03-01T08:00:00.000Z'
          }
        ]}
        continueCandidate={{
          source: 'session',
          title: '最近会话',
          summary: '回到这条会话继续工作',
          sessionId: 'session-2'
        }}
        quickActions={[]}
        onSelectSession={() => undefined}
        onContinueWork={onContinueWork}
        onApplyQuickAction={() => undefined}
      />
    );

    expect(screen.getByTestId('partner-home-continue-card')).toBeInTheDocument();
    await user.click(screen.getByTestId('partner-home-continue-button'));
    expect(onContinueWork).toHaveBeenCalledTimes(1);
  });

  it('加载态下展示结构化首页文案', () => {
    render(
      <PartnerHomeView
        partnerName='OKK Copilot'
        loading
        recentSessions={[]}
        summaryCard={{
          loading: false,
          error: '加载首页摘要失败，已切换到降级显示。'
        }}
        quickActions={[
          {
            id: 'capabilities',
            label: '检查能力配置',
            description: '查看当前可用能力',
            prompt: '检查能力'
          }
        ]}
        onSelectSession={() => undefined}
        onApplyQuickAction={() => undefined}
      />
    );

    expect(screen.getByText('正在整理最近会话、项目上下文与可用能力…')).toBeInTheDocument();
    expect(screen.getByText('还没有可回看的最近会话，发出第一条消息后这里会展示你的协作历史。')).toBeInTheDocument();
    expect(screen.getByText('加载首页摘要失败，已切换到降级显示。')).toBeInTheDocument();
  });
});
