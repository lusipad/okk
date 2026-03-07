import { useMemo, useState } from 'react';
import type { ChatMessage } from '../../types/domain';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolCallCard } from './ToolCallCard';

interface MessageItemProps {
  message: ChatMessage;
}

const LONG_MESSAGE_THRESHOLD = 1200;

function roleInitial(role: ChatMessage['role']): string {
  if (role === 'assistant') {
    return 'AI';
  }
  if (role === 'user') {
    return '你';
  }
  return 'SYS';
}

function roleLabel(role: ChatMessage['role']): string {
  if (role === 'assistant') {
    return '助手';
  }
  if (role === 'user') {
    return '你';
  }
  return '系统';
}

function formatClock(createdAt: string): string {
  const value = new Date(createdAt);
  if (Number.isNaN(value.getTime())) {
    return '--:--';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(value);
}

function formatExactTime(createdAt: string): string {
  const value = new Date(createdAt);
  if (Number.isNaN(value.getTime())) {
    return createdAt;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(value);
}

export function MessageItem({ message }: MessageItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = message.content.trim().length > 0;
  const hasToolCalls = message.toolCalls.length > 0;
  const hintText = message.status === 'error' ? '回复中断，可点击重试。' : null;
  const isLongMessage = message.content.length > LONG_MESSAGE_THRESHOLD;
  const visibleContent = useMemo(() => {
    if (!isLongMessage || expanded) {
      return message.content;
    }
    return `${message.content.slice(0, LONG_MESSAGE_THRESHOLD)}\n\n…（内容较长，已折叠）`;
  }, [expanded, isLongMessage, message.content]);

  return (
    <article className={`message-item role-${message.role}`} data-status={message.status ?? 'idle'}>
      <div className='message-shell'>
        <div className='message-avatar' aria-hidden='true'>
          {roleInitial(message.role)}
        </div>
        <div className={`message-main message-main-${message.status ?? 'idle'}`}>
          <div className='message-meta'>
            <span className='message-role'>{roleLabel(message.role)}</span>
            <time dateTime={message.createdAt} title={formatExactTime(message.createdAt)}>
              {formatClock(message.createdAt)}
            </time>
            {message.status === 'streaming' && <span className='small-text'>生成中</span>}
            {message.status === 'error' && <span className='small-text error-text'>失败</span>}
            {message.status === 'aborted' && <span className='small-text'>已中止</span>}
          </div>
          {hintText ? <p className='message-hint'>{hintText}</p> : null}
          <div className='message-content' data-testid='message-content'>
            {hasContent ? (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ ...props }) => <a {...props} target='_blank' rel='noreferrer' />,
                    pre: ({ children }) => <pre className='message-code-block'>{children}</pre>,
                    code: ({ className, children, ...props }) => (
                      <code {...props} className={className ? `${className} message-code-inline` : 'message-code-inline'}>
                        {children}
                      </code>
                    )
                  }}
                >
                  {visibleContent}
                </ReactMarkdown>
                {isLongMessage && (
                  <button type='button' className='ghost-button small-button' onClick={() => setExpanded((value) => !value)}>
                    {expanded ? '收起全文' : '展开全文'}
                  </button>
                )}
              </>
            ) : message.status === 'streaming' ? (
              <span className='typing-indicator'>正在流式输出</span>
            ) : hasToolCalls ? (
              <span className='small-text'>本轮回复以工具调用结果为主。</span>
            ) : (
              ''
            )}
          </div>
          {message.error && (
            <p className='message-error' role='alert'>
              {message.error}
            </p>
          )}
          {hasToolCalls && (
            <div className='tool-list'>
              {message.toolCalls.map((call) => (
                <ToolCallCard key={call.id} toolCall={call} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
