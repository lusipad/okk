import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../components/chat/MessageList';

describe('MessageList', () => {
  it('空消息时不再渲染旧 empty hint', () => {
    render(<MessageList messages={[]} streaming={false} />);

    expect(screen.queryByLabelText('会话空状态引导')).not.toBeInTheDocument();
    expect(screen.getByLabelText('聊天消息列表')).toBeInTheDocument();
  });
});
