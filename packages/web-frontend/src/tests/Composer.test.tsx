import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from '../components/chat/Composer';
import type { AgentInfo } from '../types/domain';

const agents: AgentInfo[] = [
  {
    id: 'agent-1',
    name: '主Agent',
    description: '默认测试 Agent',
    backend: 'codex'
  }
];

function createProps(overrides: Partial<ComponentProps<typeof Composer>> = {}): ComponentProps<typeof Composer> {
  return {
    agents,
    selectedAgentId: 'agent-1',
    skills: [],
    mcpServers: [],
    selectedSkillIds: [],
    selectedMcpServerIds: [],
    streaming: false,
    canRetry: false,
    onChangeAgent: vi.fn(),
    onChangeSkillIds: vi.fn(),
    onChangeMcpServerIds: vi.fn(),
    onSend: vi.fn().mockResolvedValue(undefined),
    onStop: vi.fn().mockResolvedValue(undefined),
    onRetry: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('Composer', () => {
  it('输入内容后可发送消息', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer {...createProps({ onSend })} />);

    const textarea = screen.getByTestId('composer-input');
    const sendButton = screen.getByTestId('composer-send');
    expect(sendButton).toBeDisabled();

    await user.type(textarea, '请帮我分析这个 PR');
    expect(sendButton).toBeEnabled();
    await user.click(sendButton);

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('请帮我分析这个 PR');
    });
  });

  it('按 Enter 发送，Shift+Enter 仅换行', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer {...createProps({ onSend })} />);

    const textarea = screen.getByTestId('composer-input');
    await user.type(textarea, '第一行');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, '第二行');

    expect(onSend).toHaveBeenCalledTimes(0);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith('第一行\n第二行');
    });
  });

  it('流式中按 Esc 会触发停止', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn().mockResolvedValue(undefined);
    render(<Composer {...createProps({ streaming: true, onStop })} />);

    const textarea = screen.getByTestId('composer-input');
    await user.click(textarea);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(onStop).toHaveBeenCalledTimes(1);
    });
  });

});




