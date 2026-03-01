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
});
