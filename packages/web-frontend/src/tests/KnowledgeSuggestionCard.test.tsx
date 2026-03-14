import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnowledgeSuggestionCard } from '../components/cards/KnowledgeSuggestionCard';

describe('KnowledgeSuggestionCard', () => {
  it('支持保存前编辑标题、内容和标签', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <KnowledgeSuggestionCard
        suggestion={{
          id: 'suggestion-1',
          title: '原始标题',
          summary: '原始摘要',
          content: '原始内容',
          category: 'guide',
          tags: ['one', 'two'],
          status: 'pending'
        }}
        onSave={onSave}
        onIgnore={() => undefined}
      />
    );

    await user.clear(screen.getByTestId('suggestion-title-suggestion-1'));
    await user.type(screen.getByTestId('suggestion-title-suggestion-1'), '修订标题');
    await user.clear(screen.getByTestId('suggestion-content-suggestion-1'));
    await user.type(screen.getByTestId('suggestion-content-suggestion-1'), '修订内容');
    await user.clear(screen.getByTestId('suggestion-tags-suggestion-1'));
    await user.type(screen.getByTestId('suggestion-tags-suggestion-1'), 'alpha, beta');

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onSave).toHaveBeenCalledWith({
      suggestionId: 'suggestion-1',
      title: '修订标题',
      content: '修订内容',
      tags: ['alpha', 'beta']
    });
  });
});
