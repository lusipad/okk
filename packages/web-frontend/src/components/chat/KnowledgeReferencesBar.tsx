import type { KnowledgeReference } from '../../types/domain';

interface KnowledgeReferencesBarProps {
  references: KnowledgeReference[];
}

export function KnowledgeReferencesBar({ references }: KnowledgeReferencesBarProps) {
  if (references.length === 0) {
    return null;
  }

  return (
    <section className='knowledge-references-bar' aria-label='本次对话使用的知识'>
      <div className='panel-header panel-header-tight'>
        <h3>本次对话使用的知识</h3>
        <span className='small-text'>{references.length} 条</span>
      </div>
      <div className='knowledge-reference-list'>
        {references.map((reference) => (
          <article key={`${reference.injectionKind}-${reference.id}`} className='knowledge-reference-card'>
            <div className='panel-header panel-header-tight'>
              <strong>{reference.title}</strong>
              <span className='chip'>{reference.injectionKind === 'background' ? 'background' : 'related'}</span>
            </div>
            <p>{reference.summary}</p>
            <div className='chip-row'>
              <span className='chip'>{reference.category}</span>
              <span className='chip'>{new Date(reference.updatedAt).toLocaleDateString('zh-CN')}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
