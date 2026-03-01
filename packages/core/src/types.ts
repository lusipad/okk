export type BackendName = "claude-code" | "codex" | (string & {});

export interface BackendCapabilities {
  supportsResume: boolean;
  supportsTools: boolean;
  supportsThinking: boolean;
}

export interface BackendRequest {
  backend: BackendName;
  prompt?: string;
  sessionId?: string;
  repoId?: string;
  workingDirectory?: string;
  additionalDirectories?: string[];
  systemPrompt?: string;
  clientMessageId?: string;
  priority?: number;
  resumeFromEventId?: number;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type BackendEventType =
  | "text_delta"
  | "thinking_delta"
  | "tool_call_start"
  | "tool_call_input_delta"
  | "tool_call_end"
  | "sub_agent_start"
  | "sub_agent_end"
  | "session_update"
  | "knowledge_suggestion"
  | "done"
  | "error";

export interface BackendEventPayloadMap {
  text_delta: { content: string };
  thinking_delta: { content: string };
  tool_call_start: { toolCallId: string; name: string };
  tool_call_input_delta: { toolCallId: string; content: string };
  tool_call_end: { toolCallId: string; output?: string; error?: string };
  sub_agent_start: { agentName: string; task?: string };
  sub_agent_end: { agentName: string; result?: string; success: boolean };
  session_update: { sessionId: string };
  knowledge_suggestion: {
    title: string;
    summary: string;
    tags: string[];
    qualityConfidence: number;
    relatedFiles?: string[];
  };
  done: { reason?: string; usage?: Partial<TokenUsage> };
  error: { code: string; message: string; retryable?: boolean; details?: unknown };
}

type BackendEventInputVariant<T extends BackendEventType> = {
  type: T;
  payload: BackendEventPayloadMap[T];
  timestamp?: string;
  sessionId?: string;
  event_id?: number;
};

export type BackendEventInput = {
  [T in BackendEventType]: BackendEventInputVariant<T>;
}[BackendEventType];

type BackendEventVariant<T extends BackendEventType> = {
  type: T;
  payload: BackendEventPayloadMap[T];
  timestamp: string;
  sessionId: string;
  event_id: number;
};

export type BackendEvent = {
  [T in BackendEventType]: BackendEventVariant<T>;
}[BackendEventType];

export type TeamEventType =
  | "team_start"
  | "team_member_add"
  | "team_member_update"
  | "team_task_update"
  | "team_message"
  | "team_end";

export interface TeamMemberPayload {
  member_id: string;
  agent_name: string;
  status: "pending" | "running" | "done" | "error";
  current_task?: string;
  backend: BackendName;
  started_at?: string;
  updated_at: string;
}

export interface TeamTaskPayload {
  task_id: string;
  title: string;
  status: "pending" | "running" | "done" | "error";
  depends_on: string[];
  owner_member_id?: string;
}

export interface TeamMessagePayload {
  message_id: string;
  member_id: string;
  content: string;
  created_at: string;
}

export interface TeamEventPayloadMap {
  team_start: { team_name: string; member_count: number };
  team_member_add: TeamMemberPayload;
  team_member_update: TeamMemberPayload;
  team_task_update: TeamTaskPayload;
  team_message: TeamMessagePayload;
  team_end: { status: "done" | "error"; summary?: string };
}

export type TeamEvent<T extends TeamEventType = TeamEventType> = {
  event_id: number;
  teamId: string;
  type: T;
  payload: TeamEventPayloadMap[T];
  timestamp: string;
};

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface Repository {
  id: string;
  name: string;
  path: string;
  description: string | null;
  defaultBackend: BackendName;
  status: "active" | "archived";
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  repoId: string;
  title: string;
  backend: BackendName;
  backendSessionId: string | null;
  mode: string;
  status: "active" | "done" | "aborted" | "error";
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  clientMessageId: string | null;
  createdAt: string;
}

export type KnowledgeStatus = "draft" | "published" | "stale" | "archived";

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  summary: string;
  repoId: string;
  category: string;
  sourceSessionId: string | null;
  qualityScore: number;
  viewCount: number;
  upvoteCount: number;
  version: number;
  status: KnowledgeStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeVersion {
  id: string;
  entryId: string;
  version: number;
  title: string;
  content: string;
  summary: string;
  category: string;
  metadata: Record<string, unknown>;
  changeSummary: string | null;
  editedBy: string;
  createdAt: string;
}

export interface KnowledgeTag {
  entryId: string;
  tag: string;
}

export interface AgentRun {
  id: string;
  sessionId: string;
  agentName: string;
  input: string;
  output: string;
  status: "running" | "done" | "error";
  toolCallCount: number;
  iterations: number;
  usageTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRun {
  id: string;
  sessionId: string;
  teamName: string;
  status: "running" | "done" | "error";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstalledSkill {
  name: string;
  description: string;
  source: string;
  version: string;
  installedAt: string;
}

export interface AgentDefinition {
  name: string;
  description: string;
  icon?: string;
  allowedTools: string[];
  maxIterations?: number;
  model?: string;
  temperature?: number;
  systemPrompt: string;
  filePath?: string;
}

export interface AgentRunnerRequest {
  backend: BackendName;
  agent: AgentDefinition;
  prompt: string;
  sessionId?: string;
  workingDirectory?: string;
  additionalDirectories?: string[];
  clientMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRunStats {
  toolCallHits: Record<string, number>;
  blockedToolCallCount: number;
}

export interface AgentResult {
  success: boolean;
  output: string;
  toolCallCount: number;
  iterations: number;
  usage: TokenUsage;
  stats: AgentRunStats;
  error?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  compatibility?: string[];
  content: string;
  workingDirectory: string;
  rootDirectory: string;
}

export interface RepositoryContext {
  workingDirectory: string;
  additionalDirectories: string[];
  claudeMd: string | null;
  knowledgeSummary: string;
  systemPromptAppendix: string;
}
