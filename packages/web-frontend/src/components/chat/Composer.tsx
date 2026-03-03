import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentInfo } from '../../types/domain';

interface SkillOption {
  id: string;
  name: string;
}

interface McpOption {
  id: string;
  name: string;
}

interface ComposerProps {
  agents: AgentInfo[];
  selectedAgentId: string | null;
  skills: SkillOption[];
  mcpServers: McpOption[];
  selectedSkillIds: string[];
  selectedMcpServerIds: string[];
  streaming: boolean;
  canRetry: boolean;
  onChangeAgent: (agentId: string | null) => void;
  onChangeSkillIds: (skillIds: string[]) => void;
  onChangeMcpServerIds: (serverIds: string[]) => void;
  onSend: (content: string) => Promise<void>;
  onStop: () => Promise<void>;
  onRetry: () => Promise<void>;
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export function Composer({
  agents,
  selectedAgentId,
  skills,
  mcpServers,
  selectedSkillIds,
  selectedMcpServerIds,
  streaming,
  canRetry,
  onChangeAgent,
  onChangeSkillIds,
  onChangeMcpServerIds,
  onSend,
  onStop,
  onRetry
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const busy = sending || retrying || stopping;
  const canSend = value.trim().length > 0 && !busy && !streaming;

  const counterText = useMemo(() => `${value.length} 字`, [value.length]);
  const skillSummary = useMemo(() => `${selectedSkillIds.length}/${skills.length}`, [selectedSkillIds.length, skills.length]);
  const mcpSummary = useMemo(
    () => `${selectedMcpServerIds.length}/${mcpServers.length}`,
    [selectedMcpServerIds.length, mcpServers.length]
  );
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );
  const selectedAgentBackend = useMemo(() => {
    if (!selectedAgent?.backend) {
      return '未标注 backend';
    }
    return selectedAgent.backend;
  }, [selectedAgent?.backend]);
  const selectedSkills = useMemo(
    () =>
      skills
        .filter((item) => selectedSkillIds.includes(item.id))
        .map((item) => ({ id: item.id, name: item.name })),
    [selectedSkillIds, skills]
  );
  const selectedMcpServers = useMemo(
    () =>
      mcpServers
        .filter((item) => selectedMcpServerIds.includes(item.id))
        .map((item) => ({ id: item.id, name: item.name })),
    [mcpServers, selectedMcpServerIds]
  );
  const activationSummary = useMemo(() => {
    if (selectedSkills.length === 0 && selectedMcpServers.length === 0) {
      return '未启用 Skills/MCP，将仅使用 Agent 默认能力。';
    }
    return `已启用 ${selectedSkills.length} 个 Skill、${selectedMcpServers.length} 个 MCP。`;
  }, [selectedMcpServers.length, selectedSkills.length]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), 220);
    textarea.style.height = `${nextHeight}px`;
  }, [value]);

  const toggleSelection = (current: string[], id: string): string[] => {
    if (current.includes(id)) {
      return current.filter((item) => item !== id);
    }
    return [...current, id];
  };

  const submit = async (): Promise<void> => {
    const content = value.trim();
    if (!content || busy || streaming) {
      return;
    }

    setSending(true);
    setFeedback(null);
    setFeedbackIsError(false);
    try {
      await onSend(content);
      setValue('');
    } catch (incoming) {
      setFeedback(toMessage(incoming, '发送失败，请稍后重试。'));
      setFeedbackIsError(true);
    } finally {
      setSending(false);
    }
  };

  const retry = async (): Promise<void> => {
    if (!canRetry || busy || streaming) {
      return;
    }

    setRetrying(true);
    setFeedback(null);
    setFeedbackIsError(false);
    try {
      await onRetry();
    } catch (incoming) {
      setFeedback(toMessage(incoming, '重试失败，请检查连接。'));
      setFeedbackIsError(true);
    } finally {
      setRetrying(false);
    }
  };

  const stop = async (): Promise<void> => {
    if (!streaming || busy) {
      return;
    }

    setStopping(true);
    setFeedback(null);
    setFeedbackIsError(false);
    try {
      await onStop();
    } catch (incoming) {
      setFeedback(toMessage(incoming, '停止失败，请稍后重试。'));
      setFeedbackIsError(true);
    } finally {
      setStopping(false);
    }
  };

  return (
    <section className='composer' aria-label='消息输入区'>
      {advancedOpen && (
        <div className='composer-toolbar'>
          <div className='composer-toolbar-block'>
            <span className='composer-agent-backend' aria-live='polite'>
              Backend: {selectedAgentBackend}
            </span>
          </div>
          <div className='composer-toolbar-block'>
            <details className='composer-selector'>
              <summary data-testid='composer-skill-summary'>Skills {skillSummary}</summary>
              <div className='composer-selector-menu'>
                {skills.length === 0 ? (
                  <p className='small-text'>暂无已安装 Skill</p>
                ) : (
                  skills.map((skill) => (
                    <label key={skill.id} className='composer-check'>
                      <input
                        data-testid={`composer-skill-toggle-${skill.id}`}
                        type='checkbox'
                        checked={selectedSkillIds.includes(skill.id)}
                        onChange={() => onChangeSkillIds(toggleSelection(selectedSkillIds, skill.id))}
                      />
                      <span>{skill.name}</span>
                    </label>
                  ))
                )}
              </div>
            </details>
            <details className='composer-selector'>
              <summary data-testid='composer-mcp-summary'>MCP {mcpSummary}</summary>
              <div className='composer-selector-menu'>
                {mcpServers.length === 0 ? (
                  <p className='small-text'>暂无已启用 MCP</p>
                ) : (
                  mcpServers.map((server) => (
                    <label key={server.id} className='composer-check'>
                      <input
                        data-testid={`composer-mcp-toggle-${server.id}`}
                        type='checkbox'
                        checked={selectedMcpServerIds.includes(server.id)}
                        onChange={() => onChangeMcpServerIds(toggleSelection(selectedMcpServerIds, server.id))}
                      />
                      <span>{server.name}</span>
                    </label>
                  ))
                )}
              </div>
            </details>
          </div>
          <div className='composer-activation-row'>
            {selectedSkills.map((item) => (
              <span key={`skill-${item.id}`} className='chip chip-active composer-activation-chip' aria-label={`已启用 Skill ${item.name}`}>
                <span className='composer-activation-kind'>Skill</span>
                <span className='composer-activation-name'>{item.name}</span>
              </span>
            ))}
            {selectedMcpServers.map((item) => (
              <span key={`mcp-${item.id}`} className='chip chip-active composer-activation-chip' aria-label={`已启用 MCP ${item.name}`}>
                <span className='composer-activation-kind'>MCP</span>
                <span className='composer-activation-name'>{item.name}</span>
              </span>
            ))}
            {selectedSkills.length === 0 && selectedMcpServers.length === 0 ? (
              <span className='small-text'>{activationSummary}</span>
            ) : null}
          </div>
        </div>
      )}
      <div className={`composer-input-shell ${streaming ? 'is-streaming' : ''}`}>
        <label htmlFor='composer-input' className='sr-only'>
          输入你的问题
        </label>
        <textarea
          ref={textareaRef}
          data-testid='composer-input'
          id='composer-input'
          value={value}
          placeholder='Ask anything'
          rows={4}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && streaming) {
              event.preventDefault();
              event.stopPropagation();
              void stop();
              return;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className='composer-input-footer'>
          <div className='composer-meta'>
            <label className='composer-topline-agent' htmlFor='agent-select'>
              <span className='sr-only'>选择模型</span>
              <select
                id='agent-select'
                value={selectedAgentId ?? ''}
                onChange={(event) => onChangeAgent(event.target.value || null)}
              >
                {agents.length === 0 ? (
                  <option value=''>暂无可用 Agent</option>
                ) : (
                  agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.backend ? `${agent.name} (${agent.backend})` : agent.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type='button'
              className={`ghost-button small-button ${advancedOpen ? 'topbar-focus-toggle is-active' : ''}`}
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              工具
            </button>
            {canRetry && (
              <button
                type='button'
                className='ghost-button small-button'
                disabled={!canRetry || busy || streaming}
                onClick={() => void retry()}
              >
                {retrying ? '重试中...' : '重试'}
              </button>
            )}
            {value.length > 0 && <span className='small-text'>{counterText}</span>}
          </div>
          <div className='row-actions composer-actions'>
            {streaming ? (
              <button type='button' className='danger-button' disabled={stopping || busy} onClick={() => void stop()}>
                {stopping ? '停止中...' : '停止'}
              </button>
            ) : null}
            <button
              data-testid='composer-send'
              type='button'
              className='primary-button'
              disabled={!canSend}
              onClick={() => void submit()}
            >
              {sending ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      </div>
      {feedback && (
        <p className={`composer-feedback ${feedbackIsError ? 'error' : ''}`} role='status' aria-live='polite'>
          {feedback}
        </p>
      )}
    </section>
  );
}

