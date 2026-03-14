import { useEffect, useState } from 'react';
import type { KnowledgeSuggestion } from '../../types/domain';

export interface SaveKnowledgeSuggestionDraft {
  suggestionId: string;
  title: string;
  content: string;
  tags: string[];
}

interface KnowledgeSuggestionCardProps {
  suggestion: KnowledgeSuggestion;
  onSave: (input: SaveKnowledgeSuggestionDraft) => void;
  onIgnore: (suggestionId: string) => void;
}

export function KnowledgeSuggestionCard({
  suggestion,
  onSave,
  onIgnore
}: KnowledgeSuggestionCardProps) {
  const [title, setTitle] = useState(suggestion.title);
  const [content, setContent] = useState(suggestion.content ?? suggestion.summary);
  const [tagsInput, setTagsInput] = useState(suggestion.tags.join(', '));

  useEffect(() => {
    setTitle(suggestion.title);
    setContent(suggestion.content ?? suggestion.summary);
    setTagsInput(suggestion.tags.join(', '));
  }, [suggestion.content, suggestion.summary, suggestion.tags, suggestion.title]);

  const tags = Array.from(
    new Set(
      tagsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

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
      {suggestion.status === 'pending' && (
        <div className='suggestion-editor'>
          <label className='settings-item settings-item-vertical'>
            <span>标题</span>
            <input
              data-testid={`suggestion-title-${suggestion.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className='settings-item settings-item-vertical'>
            <span>内容</span>
            <textarea
              data-testid={`suggestion-content-${suggestion.id}`}
              rows={8}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <label className='settings-item settings-item-vertical'>
            <span>标签</span>
            <input
              data-testid={`suggestion-tags-${suggestion.id}`}
              value={tagsInput}
              placeholder='多个标签用逗号分隔'
              onChange={(event) => setTagsInput(event.target.value)}
            />
          </label>
        </div>
      )}
      <div className='row-actions'>
        <button
          type='button'
          className='primary-button'
          disabled={suggestion.status === 'saved'}
          onClick={() =>
            onSave({
              suggestionId: suggestion.id,
              title: title.trim() || suggestion.title,
              content: content.trim() || suggestion.content || suggestion.summary,
              tags
            })
          }
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
