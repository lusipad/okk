import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../../types/domain';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  streaming: boolean;
  emptyHint?: string;
}

function isNearBottom(element: HTMLElement): boolean {
  const threshold = 120;
  const remain = element.scrollHeight - element.scrollTop - element.clientHeight;
  return remain < threshold;
}

export function MessageList({
  messages,
  streaming,
  emptyHint = '从一个问题开始。'
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const previousCountRef = useRef(messages.length);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    if (!autoFollow) {
      return;
    }
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
    setUnreadCount(0);
  }, [messages, autoFollow]);

  useEffect(() => {
    const previous = previousCountRef.current;
    if (!autoFollow && messages.length > previous) {
      setUnreadCount((value) => value + (messages.length - previous));
    }
    previousCountRef.current = messages.length;
  }, [autoFollow, messages.length]);

  const handleScroll = (): void => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const nearBottom = isNearBottom(node);
    setAutoFollow(nearBottom);
    if (nearBottom) {
      setUnreadCount(0);
    }
  };

  const scrollToBottom = (): void => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
    setAutoFollow(true);
    setUnreadCount(0);
  };

  const liveText = `${streaming ? '助手正在流式回复。' : ''}${hasMessages ? `当前共 ${messages.length} 条消息。` : '暂无消息。'}`;

  return (
    <div className='message-list-wrap'>
      <p className='sr-only' role='status' aria-live='polite'>
        {liveText}
      </p>
      <div
        ref={containerRef}
        className='message-list'
        onScroll={handleScroll}
        aria-label='聊天消息列表'
        aria-live='polite'
        aria-relevant='additions text'
        aria-busy={streaming}
      >
        {!hasMessages && (
          <p className='message-empty-state' aria-label='会话空状态引导'>
            {emptyHint}
          </p>
        )}
        {hasMessages && (
          <>
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            {streaming && (
              <div className='message-streaming-banner' aria-hidden='true'>
                <span className='typing-indicator'>正在生成最新回复</span>
              </div>
            )}
          </>
        )}
      </div>
      {!autoFollow && hasMessages && (
        <button type='button' className='small-button message-jump-button' onClick={scrollToBottom}>
          新消息{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      )}
    </div>
  );
}
