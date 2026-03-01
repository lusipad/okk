import { useEffect, useMemo, useRef, useState } from 'react';
import type { ToolCall } from '../../types/domain';
import { StatusBadge } from '../common/StatusBadge';

function toneByStatus(status: ToolCall['status']): 'info' | 'success' | 'danger' {
  if (status === 'success') {
    return 'success';
  }
  if (status === 'error') {
    return 'danger';
  }
  return 'info';
}

function defaultExpanded(call: ToolCall): boolean {
  return call.status === 'error' || call.kind === 'change';
}

function kindLabel(kind: ToolCall['kind']): string {
  if (kind === 'change') {
    return '变更';
  }
  if (kind === 'analysis') {
    return '分析';
  }
  return '读取';
}

function formatToolTime(value?: string): string | null {
  if (!value) {
    return null;
  }
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(time);
}

function durationText(toolCall: ToolCall): string | null {
  if (!toolCall.startedAt || !toolCall.finishedAt) {
    return null;
  }
  const start = new Date(toolCall.startedAt).getTime();
  const end = new Date(toolCall.finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null;
  }
  const totalMs = end - start;
  if (totalMs < 1000) {
    return `${totalMs} ms`;
  }
  return `${(totalMs / 1000).toFixed(1)} s`;
}

interface ToolCallCardProps {
  toolCall: ToolCall;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(() => defaultExpanded(toolCall));
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const resetTimerRef = useRef<number | null>(null);
  const statusLabel = useMemo(() => {
    if (toolCall.status === 'running') {
      return '执行中';
    }
    if (toolCall.status === 'error') {
      return '失败';
    }
    return '成功';
  }, [toolCall.status]);

  const statusHint = useMemo(() => {
    if (toolCall.status === 'running') {
      return '工具正在执行中。';
    }
    if (toolCall.status === 'error') {
      return '工具执行失败，请展开查看详情。';
    }
    return '工具执行完成。';
  }, [toolCall.status]);
  const startedAtLabel = useMemo(() => formatToolTime(toolCall.startedAt), [toolCall.startedAt]);
  const finishedAtLabel = useMemo(() => formatToolTime(toolCall.finishedAt), [toolCall.finishedAt]);
  const took = useMemo(() => durationText(toolCall), [toolCall]);

  useEffect(() => {
    setExpanded(defaultExpanded(toolCall));
    setCopyState('idle');
  }, [toolCall.id]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async (): Promise<void> => {
    const content = [
      `Tool: ${toolCall.name}`,
      `Summary: ${toolCall.summary}`,
      toolCall.input ? `Input: ${toolCall.input}` : '',
      toolCall.output ? `Output: ${toolCall.output}` : ''
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(content);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => setCopyState('idle'), 1200);
  };

  return (
    <article className={`tool-card tool-card-${toolCall.status}`}>
      <div className='tool-header'>
        <div className='tool-header-title'>
          <h5>{toolCall.name}</h5>
          <StatusBadge label={statusLabel} tone={toneByStatus(toolCall.status)} />
          <span className='chip'>{kindLabel(toolCall.kind)}</span>
        </div>
        <div className='row-actions'>
          <button type='button' className='ghost-button' onClick={() => void handleCopy()}>
            {copyState === 'success' ? '已复制' : copyState === 'error' ? '复制失败' : '复制'}
          </button>
          <button type='button' className='ghost-button' onClick={() => setExpanded((value) => !value)}>
            {expanded ? '收起' : '展开'}
          </button>
        </div>
      </div>
      <p>{toolCall.summary}</p>
      <div className='tool-meta'>
        <span>{statusHint}</span>
        {startedAtLabel && <span>开始 {startedAtLabel}</span>}
        {finishedAtLabel && <span>结束 {finishedAtLabel}</span>}
        {took && <span>耗时 {took}</span>}
      </div>
      {copyState === 'error' && (
        <p className='tool-copy-error' role='alert'>
          复制失败，请检查浏览器剪贴板权限。
        </p>
      )}
      {expanded && (
        <div className='tool-detail'>
          {toolCall.input && (
            <div>
              <strong>Input</strong>
              <pre>{toolCall.input}</pre>
            </div>
          )}
          {toolCall.output && (
            <div>
              <strong>Output</strong>
              <pre>{toolCall.output}</pre>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function shouldToolCardExpandByDefault(toolCall: ToolCall): boolean {
  return defaultExpanded(toolCall);
}
