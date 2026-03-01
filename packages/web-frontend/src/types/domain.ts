export type MessageRole = "user" | "assistant" | "system";

export type StreamStatus = "idle" | "streaming" | "done" | "aborted" | "error";

export type ToolCallStatus = "running" | "success" | "error";

export type ToolCallKind = "read" | "analysis" | "change";

export interface ToolCall {
  id: string;
  name: string;
  status: ToolCallStatus;
  kind: ToolCallKind;
  summary: string;
  input?: string;
  output?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status?: StreamStatus;
  createdAt: string;
  toolCalls: ToolCall[];
  error?: string;
}

export interface KnowledgeSuggestion {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  status: "pending" | "saved" | "ignored";
}

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  backend?: string;
}

export type TeamMemberStatus = "pending" | "running" | "done" | "error";

export interface TeamMemberSnapshot {
  memberId: string;
  agentName: string;
  backend: string;
  status: TeamMemberStatus;
  currentTask?: string;
  startedAt?: string;
  updatedAt: string;
}

export interface TeamTaskSnapshot {
  taskId: string;
  title: string;
  status: TeamMemberStatus;
  dependsOn: string[];
  ownerMemberId?: string;
}

export interface TeamMessageItem {
  id: string;
  memberId: string;
  content: string;
  createdAt: string;
}

export interface TeamMemberEvent {
  id: string;
  type: string;
  createdAt: string;
  summary: string;
}

export interface TeamPanelState {
  teamName: string | null;
  status: "idle" | "running" | "done" | "error";
  members: TeamMemberSnapshot[];
  tasks: TeamTaskSnapshot[];
  messages: TeamMessageItem[];
  eventFeed: TeamMemberEvent[];
}

export interface SessionInfo {
  id: string;
  title: string;
  updatedAt: string;
}

export interface McpServerInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  installed: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

export interface LoginResult {
  token: string;
  user: UserProfile;
}
