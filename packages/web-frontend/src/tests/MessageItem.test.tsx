import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageItem } from '../components/chat/MessageItem';
import type { ChatMessage } from '../types/domain';

function createMessage(content: string): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content,
    status: 'done',
    createdAt: new Date().toISOString(),
    toolCalls: []
  };
}

describe('MessageItem', () => {
  it('长消息默认折叠并可展开', async () => {
    const user = userEvent.setup();
    const longText = 'A'.repeat(1300) + '\n\n```ts\nconst ok = true;\n```';
    render(<MessageItem message={createMessage(longText)} />);

    expect(screen.getByRole('button', { name: '展开全文' })).toBeInTheDocument();
    expect(screen.getByText('…（内容较长，已折叠）')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开全文' }));
    expect(screen.getByRole('button', { name: '收起全文' })).toBeInTheDocument();
    expect(screen.getByText('const ok = true;')).toBeInTheDocument();
  });
});
