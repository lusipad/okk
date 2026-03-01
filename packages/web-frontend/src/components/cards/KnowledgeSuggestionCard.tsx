import type { KnowledgeSuggestion } from '../../types/domain';

interface KnowledgeSuggestionCardProps {
  suggestion: KnowledgeSuggestion;
  onSave: (suggestionId: string) => void;
  onIgnore: (suggestionId: string) => void;
}

export function KnowledgeSuggestionCard({
  suggestion,
  onSave,
  onIgnore
}: KnowledgeSuggestionCardProps) {
  return (
    <article className='suggestion-card'>
      <h4>{suggestion.title}</h4>
      <p>{suggestion.summary}</p>
      <div className='chip-row'>
        <span className='chip'>{suggestion.category}</span>
        {suggestion.tags.map((tag) => (
          <span key={tag} className='chip'>
            #{tag}
          </span>
        ))}
      </div>
      <div className='row-actions'>
        <button
          type='button'
          className='primary-button'
          disabled={suggestion.status === 'saved'}
          onClick={() => onSave(suggestion.id)}
        >
          {suggestion.status === 'saved' ? '已保存' : '保存'}
        </button>
        <button
          type='button'
          className='ghost-button'
          disabled={suggestion.status === 'ignored'}
          onClick={() => onIgnore(suggestion.id)}
        >
          {suggestion.status === 'ignored' ? '已忽略' : '忽略'}
        </button>
      </div>
    </article>
  );
}
