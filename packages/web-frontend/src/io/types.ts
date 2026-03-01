import type {
  AgentInfo,
  KnowledgeSuggestion,
  LoginResult,
  McpServerInfo,
  SessionInfo,
  SkillInfo,
  TeamMemberEvent,
  ToolCall,
  TeamMemberSnapshot,
  TeamMessageItem,
  TeamTaskSnapshot
} from "../types/domain";

export type WsConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export type SessionEventType =
  | "message_started"
  | "message_chunk"
  | "message_done"
  | "message_aborted"
  | "message_error"
  | "tool_call"
  | "knowledge_suggestion"
  | "team_event"
  | "session_done"
  | "auth_expired";

export interface SessionEventEnvelope {
  type: SessionEventType;
  sessionId: string;
  event_id: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface AskQuestionInput {
  sessionId: string;
  content: string;
  agentId?: string;
  clientMessageId: string;
  skillIds?: string[];
  mcpServerIds?: string[];
}

export interface RetryQuestionInput {
  sessionId: string;
  content: string;
  agentId?: string;
  previousMessageId: string;
  clientMessageId: string;
  skillIds?: string[];
  mcpServerIds?: string[];
}

export interface SessionEventSubscriber {
  onEvent: (event: SessionEventEnvelope) => void;
  onConnectionState: (state: WsConnectionState) => void;
  onError?: (error: Error) => void;
}

export interface SubscribeSessionInput {
  sessionId: string;
  lastEventId?: number;
  subscriber: SessionEventSubscriber;
}

export interface SaveKnowledgeInput {
  sessionId: string;
  suggestionId: string;
}

export interface SkillFileInfo {
  path: string;
  kind: "file" | "directory";
  size: number;
}

export interface SkillRiskIssue {
  ruleId: string;
  severity: "low" | "medium" | "high";
  message: string;
  filePath: string;
  line: number;
  snippet: string;
}

export interface SkillRiskSummary {
  level: SkillInfo["riskLevel"];
  issueCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface SkillDetail extends SkillInfo {
  version: string;
  source: string;
  installedAt: string | null;
  rootPath: string;
  content: string;
  riskSummary: SkillRiskSummary;
}

export interface SkillRiskScanResult {
  summary: SkillRiskSummary;
  issues: SkillRiskIssue[];
}

export interface ImportSkillFolderInput {
  folderPath: string;
  targetName?: string;
  overwrite?: boolean;
}

export interface SkillMarketItem {
  id: string;
  name: string;
  description: string;
  version: string;
  source: string;
  tags: string[];
  author: string;
  homepage: string;
  sourceType: "folder" | "git";
  sourceLocation: string;
  sourceBranch: string | null;
  installed: boolean;
}

export interface InstallSkillFromMarketInput {
  skillId: string;
  targetName?: string;
  overwrite?: boolean;
}

export interface McpServerSetting extends McpServerInfo {
  command: string;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
  status: "running" | "stopped" | "error";
  createdAt: string;
  updatedAt: string;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastError: string | null;
}

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
}

export interface McpToolCallResult {
  content: string;
  raw: Record<string, unknown>;
}

export interface McpResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType: string | null;
}

export interface McpResourceReadContent {
  uri: string;
  mimeType: string | null;
  text: string;
}

export interface CreateMcpServerInput {
  id?: string;
  name: string;
  description?: string;
  command: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface UpdateMcpServerInput {
  name?: string;
  description?: string;
  command?: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface IOProvider {
  login(username: string, password: string): Promise<LoginResult>;
  listSessions(): Promise<SessionInfo[]>;
  createSession(title?: string): Promise<SessionInfo>;
  listRuntimeBackends(): Promise<RuntimeBackendHealth[]>;
  askQuestion(input: AskQuestionInput): Promise<void>;
  retryQuestion(input: RetryQuestionInput): Promise<void>;
  abortSession(sessionId: string): Promise<void>;
  subscribeSession(input: SubscribeSessionInput): () => void;
  subscribeTeam(input: SubscribeTeamInput): () => void;
  runTeam(input: TeamRunRequest): Promise<TeamRunRecord>;
  getTeamRun(runId: string): Promise<TeamRunRecord | null>;
  listTeamRuns(sessionId: string): Promise<TeamRunRecord[]>;
  listAgents(): Promise<AgentInfo[]>;
  saveKnowledgeSuggestion(input: SaveKnowledgeInput): Promise<KnowledgeSuggestion>;
  ignoreKnowledgeSuggestion(input: SaveKnowledgeInput): Promise<void>;
  listMcpServers(): Promise<McpServerSetting[]>;
  createMcpServer(input: CreateMcpServerInput): Promise<McpServerSetting>;
  updateMcpServer(serverId: string, input: UpdateMcpServerInput): Promise<McpServerSetting>;
  deleteMcpServer(serverId: string): Promise<void>;
  setMcpServerEnabled(serverId: string, enabled: boolean): Promise<McpServerSetting>;
  startMcpServer(serverId: string): Promise<McpServerSetting>;
  stopMcpServer(serverId: string): Promise<McpServerSetting>;
  listMcpTools(serverId: string): Promise<McpToolInfo[]>;
  callMcpTool(serverId: string, name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
  listMcpResources(serverId: string): Promise<McpResourceInfo[]>;
  readMcpResource(serverId: string, uri: string): Promise<McpResourceReadContent[]>;
  listSkills(): Promise<SkillInfo[]>;
  readSkill(skillId: string): Promise<SkillDetail>;
  listSkillFiles(skillId: string): Promise<SkillFileInfo[]>;
  scanSkillRisk(skillId: string): Promise<SkillRiskScanResult>;
  deleteSkill(skillId: string): Promise<void>;
  importSkillFolder(input: ImportSkillFolderInput): Promise<SkillInfo>;
  installSkill(skillId: string): Promise<SkillInfo>;
  listSkillMarket(query?: string): Promise<SkillMarketItem[]>;
  installSkillFromMarket(input: InstallSkillFromMarketInput): Promise<SkillInfo>;
}

export interface MessageStartedPayload {
  messageId: string;
}

export interface MessageChunkPayload {
  messageId: string;
  chunk: string;
}

export interface MessageDonePayload {
  messageId: string;
}

export interface MessageAbortedPayload {
  messageId: string;
}

export interface MessageErrorPayload {
  messageId: string;
  error: string;
}

export interface ToolCallPayload {
  messageId: string;
  toolCall: ToolCall;
}

export interface KnowledgeSuggestionPayload {
  suggestion: KnowledgeSuggestion;
}

export interface TeamEventPayload {
  event: TeamMemberEvent;
}

export type TeamEventType =
  | "team_start"
  | "team_member_add"
  | "team_member_update"
  | "team_task_update"
  | "team_message"
  | "team_end"
  | "auth_expired";

export interface TeamWsEvent {
  type: TeamEventType;
  teamId: string;
  event_id: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface TeamSubscriber {
  onEvent: (event: TeamWsEvent) => void;
  onConnectionState?: (state: WsConnectionState) => void;
  onError?: (error: Error) => void;
}

export interface SubscribeTeamInput {
  teamId: string;
  subscriber: TeamSubscriber;
}

export interface TeamViewPayload {
  teamName: string | null;
  status: "idle" | "running" | "done" | "error";
  members: TeamMemberSnapshot[];
  tasks: TeamTaskSnapshot[];
  messages: TeamMessageItem[];
  eventFeed: TeamMemberEvent[];
}

export interface RuntimeBackendHealth {
  backend: string;
  command: string;
  available: boolean;
  reason?: string;
}

export interface TeamRunMemberInput {
  memberId?: string;
  agentName: string;
  backend?: string;
  prompt: string;
  taskTitle: string;
  dependsOn?: string[];
}

export interface TeamRunRequest {
  teamId?: string;
  sessionId: string;
  teamName: string;
  members: TeamRunMemberInput[];
}

export interface TeamRunMemberResult {
  memberId: string;
  agentName: string;
  backend: string;
  status: "done" | "error";
  startedAt: string;
  updatedAt: string;
  output?: string;
  error?: string;
}

export interface TeamRunRecord {
  id: string;
  teamId: string;
  sessionId: string;
  teamName: string;
  status: "running" | "done" | "error";
  memberCount: number;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  summary?: string;
  members: TeamRunMemberResult[];
}
