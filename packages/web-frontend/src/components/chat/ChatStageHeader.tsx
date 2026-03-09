interface ChatStageHeaderProps {
  title: string;
  agentName: string;
  messageCount: number;
  skillCount: number;
  mcpCount: number;
}

export function ChatStageHeader({
  title,
  agentName,
  messageCount,
  skillCount,
  mcpCount
}: ChatStageHeaderProps) {
  return (
    <header className='chat-stage-header' aria-label='聊天主舞台头部'>
      <div className='chat-stage-title'>
        <h2>{title}</h2>
      </div>
      <div className='chat-stage-meta'>
        <span className='chat-stage-agent'>{agentName}</span>
        <span className='chat-stage-stat'>消息 {messageCount}</span>
        <span className='chat-stage-stat'>Skills {skillCount}</span>
        <span className='chat-stage-stat'>MCP {mcpCount}</span>
      </div>
    </header>
  );
}
