import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NextStepSuggestions, deriveNextStepSuggestions } from '../components/chat/NextStepSuggestions';
import type { ChatMessage } from '../types/domain';

function message(partial: Partial<ChatMessage>): ChatMessage {
  return {
    id: partial.id ?? 'msg-1',
    role: partial.role ?? 'assistant',
    content: partial.content ?? '默认内容',
    createdAt: partial.createdAt ?? '2026-03-01T00:00:00.000Z',
    toolCalls: partial.toolCalls ?? [],
    status: partial.status
  };
}

describe('NextStepSuggestions', () => {
  it('错误类回答会生成修复导向建议', () => {
    const suggestions = deriveNextStepSuggestions({
      messages: [message({ content: '构建失败，报错提示 module not found。' })],
      isStreaming: false,
      skillCount: 0,
      mcpCount: 0
    });

    expect(suggestions.map((item) => item.id)).toContain('root-cause');
    expect(suggestions.map((item) => item.id)).toContain('add-tests');
  });

  it('点击建议后回传对应 prompt', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <NextStepSuggestions
        suggestions={[
          {
            id: 'next-step',
            label: '给出下一步',
            description: '明确最值得做的下一步',
            prompt: '请告诉我现在最值得做的下一步。'
          }
        ]}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByTestId('next-step-next-step'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: '请告诉我现在最值得做的下一步。'
      })
    );
  });

  it('流式执行中不展示建议', () => {
    const suggestions = deriveNextStepSuggestions({
      messages: [message({ content: '这里是一段正常回答。' })],
      isStreaming: true,
      skillCount: 1,
      mcpCount: 1
    });

    expect(suggestions).toHaveLength(0);
  });
});
