import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatStageHeader } from '../components/chat/ChatStageHeader';

describe('ChatStageHeader', () => {
  it('展示消息数与启用能力计数', () => {
    render(
      <ChatStageHeader
        title='New chat'
        agentName='code-reviewer'
        messageCount={0}
        skillCount={2}
        mcpCount={1}
      />
    );

    expect(screen.getByText('New chat')).toBeInTheDocument();
    expect(screen.getByText('code-reviewer')).toBeInTheDocument();
    expect(screen.getByText('消息 0')).toBeInTheDocument();
    expect(screen.getByText('Skills 2')).toBeInTheDocument();
    expect(screen.getByText('MCP 1')).toBeInTheDocument();
  });

  it('属性变化时更新元信息', () => {
    const { rerender } = render(
      <ChatStageHeader
        title='对话 A'
        agentName='OKK Copilot'
        messageCount={1}
        skillCount={0}
        mcpCount={0}
      />
    );

    rerender(
      <ChatStageHeader
        title='对话 A'
        agentName='OKK Copilot'
        messageCount={4}
        skillCount={3}
        mcpCount={2}
      />
    );

    expect(screen.getByText('消息 4')).toBeInTheDocument();
    expect(screen.getByText('Skills 3')).toBeInTheDocument();
    expect(screen.getByText('MCP 2')).toBeInTheDocument();
  });
});
