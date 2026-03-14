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
  content?: string;
  knowledgeEntryId?: string | null;
}

export interface KnowledgeReference {
  id: string;
  title: string;
  summary: string;
  category: string;
  updatedAt: string;
  injectionKind: "background" | "related";
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

export interface KnowledgeSearchResult extends KnowledgeEntry {
  snippet: string;
  highlightedTitle: string;
  relevance: number;
}

export type KnowledgeShareVisibility = "workspace" | "team";
export type KnowledgeShareReviewStatus =
  | "pending_review"
  | "approved"
  | "published"
  | "rejected"
  | "changes_requested";

export interface KnowledgeShareRecord {
  id: string;
  entryId: string;
  visibility: KnowledgeShareVisibility;
  reviewStatus: KnowledgeShareReviewStatus;
  requestedBy: string;
  reviewedBy: string | null;
  requestNote: string | null;
  reviewNote: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  entryTitle: string;
  entrySummary: string;
  entryCategory: string;
  entryStatus: KnowledgeStatus;
  entryTags: string[];
  repoId: string;
  sourceAuthorId: string;
  sourceAuthorName: string | null;
}

export interface KnowledgeShareReview {
  id: string;
  shareId: string;
  action: 'submit' | 'approve' | 'publish' | 'reject' | 'request_changes' | 'rollback';
  note: string | null;
  createdBy: string;
  createdAt: string;
}

export type CollaborationSourceType = 'team' | 'agent' | 'skill' | 'mcp' | 'backend' | 'tool';

export type CollaborationRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'aborted' | 'ready' | 'unavailable';

export type CollaborationActionKind = 'retry' | 'refresh' | 'copy_diagnostic' | 'open_route';

export interface CollaborationAction {
  kind: CollaborationActionKind;
  label: string;
  route?: string;
}

export interface CollaborationDiagnostics {
  code?: string;
  message: string;
  detail?: string;
  retryable?: boolean;
  severity?: 'info' | 'warning' | 'error';
}

export type SessionExecutionPhase =
  | 'idle'
  | 'sending'
  | 'streaming'
  | 'recovering'
  | 'done'
  | 'aborted'
  | 'error';

export interface SessionRuntimeState {
  phase: SessionExecutionPhase;
  message?: string;
  diagnostics?: CollaborationDiagnostics;
  retryable?: boolean;
  updatedAt?: string;
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
  runId?: string;
  sourceType?: CollaborationSourceType;
  status?: CollaborationRunStatus;
  diagnostics?: CollaborationDiagnostics;
  actions?: CollaborationAction[];
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
  repoId?: string;
  summary?: string;
  tags?: string[];
  archivedAt?: string | null;
  updatedAt: string;
}

export interface SessionReferenceRecord {
  messageId: string;
  snippet: string;
  createdAt: string;
}

export interface RepoContextSnapshot {
  preferredAgentId?: string | null;
  preferredAgentName?: string | null;
  preferredBackend?: string | null;
  preferredMode?: string | null;
  preferredSkillIds: string[];
  preferredMcpServerIds: string[];
  lastSessionId?: string | null;
  lastActivitySummary?: string | null;
  continuePrompt?: string | null;
  lastUpdatedAt?: string | null;
}

export interface RepoActivityRecord {
  id: string;
  repoId?: string;
  activityType: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface RepoContextRecord {
  repoId?: string;
  repoName: string;
  snapshot: RepoContextSnapshot;
  recentActivities: RepoActivityRecord[];
}

export interface RepoContinueRecord {
  repoId?: string;
  repoName: string;
  prompt: string;
  summary: string;
  snapshot: RepoContextSnapshot;
  recentActivities: RepoActivityRecord[];
}

export interface ContinueWorkCandidate {
  source: 'repo' | 'session';
  title: string;
  summary: string;
  repoName?: string | null;
  sessionId?: string | null;
  loading?: boolean;
  error?: string | null;
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
  enabled?: boolean;
  status?: "installed" | "disabled" | "error";
  dependencyErrors?: string[];
  compatibility?: string[];
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

export type MemoryType = "preference" | "project" | "relationship" | "process" | "event";
export type MemoryStatus = "active" | "stale" | "archived";

export interface MemoryEntry {
  id: string;
  userId: string;
  repoId?: string | null;
  memoryType: MemoryType;
  title: string;
  content: string;
  summary: string;
  confidence: number;
  status: MemoryStatus;
  sourceKind: "conversation" | "claude-md" | "knowledge" | "manual";
  sourceRef?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityProfile {
  id: string;
  name: string;
  systemPrompt: string;
  profileJson: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerMemorySummary {
  id: string;
  title: string;
  summary: string;
  memoryType: MemoryType;
}

export interface PartnerSummaryRecord {
  identity: { id: string; name: string; summary: string | null; isActive: boolean } | null;
  memoryCount: number;
  recentMemories: PartnerMemorySummary[];
  activeRepoName: string | null;
}

export type MissionStatus = "draft" | "active" | "blocked" | "awaiting_user" | "completed" | "failed";
export type MissionPhase = "align" | "plan" | "execute" | "review" | "merge" | "done";
export type MissionWorkstreamStatus =
  | "queued"
  | "running"
  | "blocked"
  | "awaiting_review"
  | "awaiting_user"
  | "completed"
  | "failed";

export interface MissionRecord {
  id: string;
  sessionId: string | null;
  workspaceId: string | null;
  repoId: string | null;
  title: string;
  goal: string;
  summary: string;
  status: MissionStatus;
  phase: MissionPhase;
  ownerPartnerId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MissionSummaryRecord {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  phase: MissionPhase;
  repoId: string | null;
  sessionId: string | null;
  ownerPartnerId: string | null;
  partnerCount: number;
  workstreamTotal: number;
  workstreamCompleted: number;
  blockedCount: number;
  openCheckpointCount: number;
  updatedAt: string;
}

export interface MissionWorkstreamRecord {
  id: string;
  missionId: string;
  teamRunId: string | null;
  title: string;
  description: string | null;
  assigneePartnerId: string;
  status: MissionWorkstreamStatus;
  orderIndex: number;
  dependsOnWorkstreamIds: string[];
  outputSummary: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionCheckpointRecord {
  id: string;
  missionId: string;
  workstreamId: string | null;
  type: "direction" | "review" | "approval" | "conflict" | "identity";
  title: string;
  summary: string;
  status: "open" | "resolved" | "dismissed";
  requiresUserAction: boolean;
  createdByPartnerId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionHandoffRecord {
  id: string;
  missionId: string;
  fromWorkstreamId: string;
  toPartnerId: string;
  reason: string;
  payloadSummary: string | null;
  status: "pending" | "accepted" | "completed" | "rejected";
  createdAt: string;
  updatedAt: string;
}


export interface AgentTraceEvent {
  id: string;
  sessionId: string;
  traceType: string;
  sourceType: string;
  parentTraceId: string | null;
  spanId: string;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  summary: string;
  payload: Record<string, unknown>;
  fileChanges: Array<{ path: string; changeType: 'created' | 'modified' | 'deleted'; diff: string }>;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  description: string | null;
  activeRepoId: string | null;
  repoIds: string[];
  recentRepoIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceRepositoryStatus {
  repoId: string;
  name: string;
  path: string;
  exists: boolean;
  isActive: boolean;
}

export interface WorkspaceSearchRecord {
  kind: 'repo' | 'session' | 'knowledge';
  id: string;
  repoId: string | null;
  title: string;
  summary: string;
  updatedAt: string;
}

export interface KnowledgeGovernanceRecord {
  id: string;
  entryId: string;
  sourceType: string;
  sourceLabel: string;
  healthScore: number;
  status: 'healthy' | 'pending_review' | 'stale' | 'conflict' | 'merged' | 'rolled_back';
  staleReason: string | null;
  conflictEntryIds: string[];
  queueReason: string | null;
  queuePriority: number;
  evidence: Record<string, unknown>;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rollbackVersion: number | null;
  mergedIntoEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGovernanceReview {
  id: string;
  governanceId: string;
  action: 'refresh' | 'approve' | 'mark_stale' | 'merge' | 'rollback';
  note: string | null;
  actorId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface KnowledgeImportBatch {
  id: string;
  name: string;
  sourceTypes: string[];
  sourceSummary: string;
  status: 'draft' | 'confirmed' | 'completed' | 'failed';
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeImportItem {
  id: string;
  batchId: string;
  title: string;
  summary: string;
  content: string;
  repoId: string | null;
  sourceType: string;
  sourceRef: string | null;
  dedupeKey: string;
  evidence: Record<string, unknown>;
  status: 'pending' | 'imported' | 'duplicate' | 'skipped';
  mergedEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillWorkflowNode {
  id: string;
  type: 'prompt' | 'skill' | 'agent' | 'condition' | 'knowledge_ref';
  name: string;
  config: Record<string, unknown>;
  next: string[];
}

export interface SkillWorkflowRecord {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active';
  nodes: SkillWorkflowNode[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillWorkflowRunStep {
  nodeId: string;
  nodeName: string;
  nodeType: 'prompt' | 'skill' | 'agent' | 'condition' | 'knowledge_ref';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt: string;
  endedAt: string | null;
  error: string | null;
}

export interface SkillWorkflowRun {
  id: string;
  workflowId: string;
  sessionId: string | null;
  status: 'running' | 'completed' | 'failed';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  steps: SkillWorkflowRunStep[];
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
}

export interface MemoryShareRecord {
  id: string;
  memoryId: string;
  knowledgeEntryId: string | null;
  visibility: 'private' | 'workspace' | 'team';
  reviewStatus: 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
  requestedBy: string;
  reviewedBy: string | null;
  approvalNote: string | null;
  rejectionReason: string | null;
  recommendationScore: number;
  memoryTitle: string;
  memorySummary: string;
  repoId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface MemoryShareReview {
  id: string;
  shareId: string;
  action: 'submit' | 'approve' | 'reject' | 'publish' | 'rollback';
  note: string | null;
  createdBy: string;
  createdAt: string;
}
export interface LoginResult {
  token: string;
  user: UserProfile;
}




