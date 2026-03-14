import type {
  AgentInfo,
  AgentTraceEvent,
  CollaborationAction,
  CollaborationDiagnostics,
  CollaborationRunStatus,
  CollaborationSourceType,
  KnowledgeEntry,
  KnowledgeShareRecord,
  KnowledgeShareReview,
  KnowledgeGovernanceRecord,
  KnowledgeGovernanceReview,
  KnowledgeImportBatch,
  KnowledgeImportItem,
  KnowledgeReference,
  KnowledgeSearchResult,
  KnowledgeSuggestion,
  KnowledgeStatus,
  KnowledgeVersion,
  IdentityProfile,
  LoginResult,
  MemoryShareRecord,
  MemoryShareReview,
  McpServerInfo,
  RepoContextRecord,
  RepoContinueRecord,
  MemoryEntry,
  MemoryStatus,
  MemoryType,
  PartnerSummaryRecord,
  MissionRecord,
  MissionSummaryRecord,
  MissionWorkstreamRecord,
  MissionCheckpointRecord,
  MissionHandoffRecord,
  SessionInfo,
  SessionReferenceRecord,
  SkillInfo,
  SkillWorkflowMetadata,
  SkillWorkflowRecord,
  SkillWorkflowRun,
  WorkflowKnowledgeDraft,
  WorkflowKnowledgePublishMode,
  TeamMemberEvent,
  ToolCall,
  TeamMemberSnapshot,
  TeamMessageItem,
  TeamTaskSnapshot,
  WorkspaceRecord,
  WorkspaceRepositoryStatus,
  WorkspaceSearchRecord
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
  | "session_resumed"
  | "session_resume_failed"
  | "session_abort_ignored"
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
  title?: string;
  content?: string;
  tags?: string[];
}

export interface ListKnowledgeEntriesInput {
  repoId?: string;
  category?: string;
  status?: KnowledgeStatus;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchKnowledgeEntriesInput extends ListKnowledgeEntriesInput {
  keyword?: string;
}

export interface CreateKnowledgeEntryInput {
  title: string;
  content: string;
  summary?: string;
  repoId?: string;
  category?: string;
  sourceSessionId?: string | null;
  qualityScore?: number;
  status?: KnowledgeStatus;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateKnowledgeEntryInput {
  title?: string;
  content?: string;
  summary?: string;
  category?: string;
  sourceSessionId?: string | null;
  qualityScore?: number;
  status?: KnowledgeStatus;
  metadata?: Record<string, unknown>;
  tags?: string[];
  changeSummary?: string | null;
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

export interface SkillDiagnosisResult {
  compatibility: string[];
  dependencyErrors: string[];
  status: "installed" | "disabled" | "error";
  riskSummary: SkillRiskSummary;
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

export interface RepoRecord {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface WorkspaceStatusPayload {
  item: WorkspaceRecord;
  repositories: WorkspaceRepositoryStatus[];
}

export interface GovernanceDetailPayload {
  item: KnowledgeGovernanceRecord;
  entry?: Record<string, unknown> | null;
  versions: Array<Record<string, unknown>>;
  conflicts: Array<Record<string, unknown>>;
  reviews: KnowledgeGovernanceReview[];
}

export interface KnowledgeImportPreviewInput {
  name?: string;
  sourceTypes?: string[];
  repoIds?: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: Array<Record<string, unknown>>;
  metadata: SkillWorkflowMetadata;
}

export interface PublishWorkflowKnowledgeInput {
  title?: string;
  summary?: string;
  content?: string;
  repoId?: string | null;
  category?: string;
  tags?: string[];
  mode?: WorkflowKnowledgePublishMode;
}

export interface PublishWorkflowKnowledgeResult {
  item: KnowledgeEntry;
  run?: SkillWorkflowRun | null;
  relation?: {
    workflowId: string;
    runId: string;
    entryId: string;
  };
}

export interface MemorySharingOverview {
  summary: {
    total: number;
    pending: number;
    approved: number;
    published: number;
    rejected: number;
  };
  recommendations: Array<{
    memoryId: string;
    title: string;
    summary: string;
    confidence: number;
    repoId: string | null;
  }>;
}

export interface KnowledgeSharingOverview {
  summary: {
    total: number;
    pendingReview: number;
    approved: number;
    published: number;
    rejected: number;
    changesRequested: number;
  };
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
  listRepos(): Promise<RepoRecord[]>;
  listSessions(input?: { archived?: boolean; q?: string; tag?: string }): Promise<SessionInfo[]>;
  createSession(title?: string): Promise<SessionInfo>;
  archiveSession(sessionId: string): Promise<SessionInfo>;
  restoreSession(sessionId: string): Promise<SessionInfo>;
  listSessionReferences(sessionId: string, query?: string): Promise<SessionReferenceRecord[]>;
  getRepoContext(repoId: string): Promise<RepoContextRecord>;
  updateRepoContext(repoId: string, input: Partial<RepoContextRecord['snapshot']>): Promise<RepoContextRecord>;
  continueRepoContext(repoId: string): Promise<RepoContinueRecord>;
  getPartnerSummary(): Promise<PartnerSummaryRecord>;
  listMissions(input?: { status?: MissionRecord["status"]; repoId?: string; sessionId?: string }): Promise<MissionRecord[]>;
  listMissionSummaries(input?: { status?: MissionRecord["status"]; repoId?: string; sessionId?: string }): Promise<MissionSummaryRecord[]>;
  createMission(input: { title: string; goal: string; repoId?: string | null; sessionId?: string | null; workspaceId?: string | null; ownerPartnerId?: string | null }): Promise<MissionRecord>;
  getMission(missionId: string): Promise<MissionRecord | null>;
  listMissionWorkstreams(missionId: string): Promise<MissionWorkstreamRecord[]>;
  listMissionCheckpoints(missionId: string): Promise<MissionCheckpointRecord[]>;
  resolveMissionCheckpoint(missionId: string, checkpointId: string): Promise<MissionCheckpointRecord>;
  listMissionHandoffs(missionId: string): Promise<MissionHandoffRecord[]>;
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
  listKnowledgeEntries(input?: ListKnowledgeEntriesInput): Promise<KnowledgeEntry[]>;
  searchKnowledgeEntries(input?: SearchKnowledgeEntriesInput): Promise<KnowledgeSearchResult[]>;
  getKnowledgeEntry(entryId: string): Promise<KnowledgeEntry | null>;
  listKnowledgeShares(input?: { status?: string; repoId?: string; category?: string; tags?: string[]; query?: string; authorId?: string }): Promise<KnowledgeShareRecord[]>;
  getKnowledgeSharingOverview(): Promise<KnowledgeSharingOverview>;
  listPublishedKnowledgeShares(input?: { repoId?: string; category?: string; tags?: string[]; query?: string; authorId?: string }): Promise<KnowledgeShareRecord[]>;
  getKnowledgeShareByEntry(entryId: string): Promise<{ item: KnowledgeShareRecord | null; reviews: KnowledgeShareReview[] }>;
  requestKnowledgeShare(entryId: string, visibility: 'workspace' | 'team', note?: string): Promise<KnowledgeShareRecord>;
  reviewKnowledgeShare(shareId: string, input: { action: string; note?: string }): Promise<KnowledgeShareRecord>;
  getKnowledgeShare(shareId: string): Promise<{ item: KnowledgeShareRecord; reviews: KnowledgeShareReview[] }>;
  createKnowledgeEntry(input: CreateKnowledgeEntryInput): Promise<KnowledgeEntry>;
  updateKnowledgeEntry(entryId: string, input: UpdateKnowledgeEntryInput): Promise<KnowledgeEntry>;
  deleteKnowledgeEntry(entryId: string): Promise<void>;
  getKnowledgeVersions(entryId: string): Promise<KnowledgeVersion[]>;
  updateKnowledgeStatus(entryId: string, status: KnowledgeStatus): Promise<KnowledgeEntry>;
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
  diagnoseSkill(skillId: string): Promise<SkillDiagnosisResult>;
  setSkillEnabled(skillId: string, enabled: boolean): Promise<SkillInfo>;
  deleteSkill(skillId: string): Promise<void>;
  importSkillFolder(input: ImportSkillFolderInput): Promise<SkillInfo>;
  installSkill(skillId: string): Promise<SkillInfo>;
  listSkillMarket(query?: string): Promise<SkillMarketItem[]>;
  installSkillFromMarket(input: InstallSkillFromMarketInput): Promise<SkillInfo>;
  listMemoryEntries(input?: { repoId?: string; memoryType?: MemoryType; status?: MemoryStatus }): Promise<MemoryEntry[]>;
  createMemoryEntry(input: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt" | "userId">): Promise<MemoryEntry>;
  updateMemoryEntry(memoryId: string, input: Partial<Pick<MemoryEntry, "title" | "content" | "summary" | "confidence" | "status">>): Promise<MemoryEntry>;
  syncMemoryRepo(repoId: string): Promise<{ imported: number }>;
  listIdentityProfiles(): Promise<IdentityProfile[]>;
  getActiveIdentity(): Promise<IdentityProfile | null>;
  upsertIdentity(input: Omit<IdentityProfile, "id" | "createdAt" | "updatedAt">): Promise<IdentityProfile>;
  activateIdentity(identityId: string): Promise<IdentityProfile>;
  listAgentTraces(sessionId: string): Promise<AgentTraceEvent[]>;
  getAgentTrace(sessionId: string, traceId: string): Promise<AgentTraceEvent>;
  getAgentTraceDiff(sessionId: string, traceId: string, filePath: string): Promise<{ path: string; changeType: string; diff: string } | null>;
  listWorkspaces(): Promise<WorkspaceRecord[]>;
  createWorkspace(input: { name: string; description?: string | null; repoIds?: string[]; activeRepoId?: string | null }): Promise<WorkspaceRecord>;
  updateWorkspace(workspaceId: string, input: Partial<{ name: string; description: string | null; repoIds: string[]; activeRepoId: string | null }>): Promise<WorkspaceRecord>;
  deleteWorkspace(workspaceId: string): Promise<void>;
  activateWorkspaceRepo(workspaceId: string, repoId: string): Promise<WorkspaceRecord>;
  getWorkspaceStatus(workspaceId: string): Promise<WorkspaceStatusPayload>;
  searchWorkspace(workspaceId: string, query?: string): Promise<WorkspaceSearchRecord[]>;
  listGovernanceRecords(status?: string): Promise<KnowledgeGovernanceRecord[]>;
  refreshGovernance(): Promise<KnowledgeGovernanceRecord[]>;
  getGovernanceDetail(governanceId: string): Promise<GovernanceDetailPayload>;
  reviewGovernance(governanceId: string, input: { action: string; targetEntryId?: string; version?: number; note?: string }): Promise<KnowledgeGovernanceRecord>;
  listKnowledgeImportBatches(): Promise<KnowledgeImportBatch[]>;
  previewKnowledgeImport(input: KnowledgeImportPreviewInput): Promise<{ item: KnowledgeImportBatch; items: KnowledgeImportItem[] }>;
  getKnowledgeImportBatch(batchId: string): Promise<{ item: KnowledgeImportBatch; items: KnowledgeImportItem[] }>;
  confirmKnowledgeImportBatch(batchId: string): Promise<{ item: KnowledgeImportBatch; items: KnowledgeImportItem[]; results: Array<Record<string, unknown>> }>;
  replayKnowledgeImportBatch(batchId: string): Promise<{ item: KnowledgeImportBatch; items: KnowledgeImportItem[] }>;
  listWorkflowTemplates(): Promise<WorkflowTemplate[]>;
  listWorkflows(): Promise<SkillWorkflowRecord[]>;
  createWorkflow(input: { name: string; description?: string; status?: 'draft' | 'active'; nodes: Array<Record<string, unknown>>; metadata?: SkillWorkflowMetadata }): Promise<SkillWorkflowRecord>;
  updateWorkflow(workflowId: string, input: Partial<{ name: string; description: string; status: 'draft' | 'active'; nodes: Array<Record<string, unknown>>; metadata: SkillWorkflowMetadata }>): Promise<SkillWorkflowRecord>;
  deleteWorkflow(workflowId: string): Promise<void>;
  runWorkflow(workflowId: string, input?: { sessionId?: string; input?: Record<string, unknown> }): Promise<SkillWorkflowRun>;
  retryWorkflowRun(runId: string): Promise<SkillWorkflowRun>;
  listWorkflowRuns(workflowId: string): Promise<SkillWorkflowRun[]>;
  getWorkflowRun(runId: string): Promise<SkillWorkflowRun | null>;
  getWorkflowKnowledgeDraft(runId: string, mode?: WorkflowKnowledgePublishMode): Promise<WorkflowKnowledgeDraft>;
  publishWorkflowKnowledge(runId: string, input: PublishWorkflowKnowledgeInput): Promise<PublishWorkflowKnowledgeResult>;
  listMemoryShares(): Promise<MemoryShareRecord[]>;
  getMemorySharingOverview(): Promise<MemorySharingOverview>;
  requestMemoryShare(memoryId: string, visibility: 'private' | 'workspace' | 'team'): Promise<MemoryShareRecord>;
  reviewMemoryShare(shareId: string, input: { action: string; note?: string }): Promise<MemoryShareRecord>;
  getMemoryShare(shareId: string): Promise<{ item: MemoryShareRecord; reviews: MemoryShareReview[] }>;
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
  knowledgeReferences?: KnowledgeReference[];
}

export interface MessageAbortedPayload {
  messageId: string;
}

export interface MessageErrorPayload {
  messageId: string;
  error: string;
  diagnostics?: CollaborationDiagnostics;
}

export interface SessionResumedPayload {
  replayCount: number;
  lastEventId: number;
}

export interface SessionResumeFailedPayload {
  lastEventId: number;
  latestEventId: number;
  error: string;
  diagnostics?: CollaborationDiagnostics;
}

export interface SessionAbortIgnoredPayload {
  message: string;
  diagnostics?: CollaborationDiagnostics;
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
  | "capability_status"
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
  sourceType?: CollaborationSourceType;
  runtimeStatus?: CollaborationRunStatus;
  diagnostics?: CollaborationDiagnostics;
  actions?: CollaborationAction[];
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
  sourceType?: CollaborationSourceType;
  runtimeStatus?: CollaborationRunStatus;
  diagnostics?: CollaborationDiagnostics;
  actions?: CollaborationAction[];
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
  sourceType?: CollaborationSourceType;
  runtimeStatus?: CollaborationRunStatus;
  diagnostics?: CollaborationDiagnostics;
  actions?: CollaborationAction[];
}







