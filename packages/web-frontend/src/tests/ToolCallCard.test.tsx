import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolCallCard, shouldToolCardExpandByDefault } from '../components/chat/ToolCallCard';
import type { ToolCall } from '../types/domain';

const baseCall: ToolCall = {
  id: 'tool-1',
  name: 'Edit',
  status: 'success',
  kind: 'read',
  summary: 'Read file',
  input: '{"path":"src/a.ts"}',
  output: 'ok'
};

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
});

describe('ToolCallCard', () => {
  it('变更类工具默认展开', () => {
    const call: ToolCall = { ...baseCall, kind: 'change' };
    render(<ToolCallCard toolCall={call} />);
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('普通成功工具默认收起并可展开', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={baseCall} />);

    expect(screen.queryByText('Input')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '展开' }));
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('默认展开策略符合失败和变更规则', () => {
    expect(shouldToolCardExpandByDefault({ ...baseCall, status: 'error' })).toBe(true);
    expect(shouldToolCardExpandByDefault({ ...baseCall, kind: 'change' })).toBe(true);
    expect(shouldToolCardExpandByDefault(baseCall)).toBe(false);
  });
});
