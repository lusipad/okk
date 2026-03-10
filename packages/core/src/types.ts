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
  | "capability_status"
  | "team_end";

export type CollaborationSourceType = "team" | "agent" | "skill" | "mcp" | "backend" | "tool";

export type CollaborationRunStatus = "queued" | "running" | "completed" | "failed" | "aborted" | "ready" | "unavailable";

export type CollaborationActionKind = "retry" | "refresh" | "copy_diagnostic" | "open_route";

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
  severity?: "info" | "warning" | "error";
}

export interface CollaborationPayloadMeta {
  run_id?: string;
  source_type?: CollaborationSourceType;
  runtime_status?: CollaborationRunStatus;
  diagnostics?: CollaborationDiagnostics;
  actions?: CollaborationAction[];
}

export interface TeamMemberPayload extends CollaborationPayloadMeta {
  member_id: string;
  agent_name: string;
  status: "pending" | "running" | "done" | "error";
  current_task?: string;
  backend: BackendName;
  started_at?: string;
  updated_at: string;
}

export interface TeamTaskPayload extends CollaborationPayloadMeta {
  task_id: string;
  title: string;
  status: "pending" | "running" | "done" | "error";
  depends_on: string[];
  owner_member_id?: string;
}

export interface TeamMessagePayload extends CollaborationPayloadMeta {
  message_id: string;
  member_id: string;
  content: string;
  created_at: string;
}

export interface CapabilityStatusPayload extends CollaborationPayloadMeta {
  capability_id: string;
  capability_name: string;
  summary: string;
  configured?: boolean;
}

export interface TeamEventPayloadMap {
  team_start: CollaborationPayloadMeta & { team_name: string; member_count: number };
  team_member_add: TeamMemberPayload;
  team_member_update: TeamMemberPayload;
  team_task_update: TeamTaskPayload;
  team_message: TeamMessagePayload;
  capability_status: CapabilityStatusPayload;
  team_end: CollaborationPayloadMeta & { status: "done" | "error"; summary?: string };
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
  summary: string;
  tags: string[];
  backend: BackendName;
  backendSessionId: string | null;
  mode: string;
  status: "active" | "done" | "aborted" | "error";
  archivedAt: string | null;
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

export type MemoryType = "preference" | "project" | "relationship" | "process" | "event";
export type MemoryStatus = "active" | "stale" | "archived";

export interface MemoryEntry {
  id: string;
  userId: string;
  repoId: string | null;
  memoryType: MemoryType;
  title: string;
  content: string;
  summary: string;
  confidence: number;
  status: MemoryStatus;
  sourceKind: "conversation" | "claude-md" | "knowledge" | "manual";
  sourceRef: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryAccessLog {
  id: string;
  memoryId: string;
  sessionId: string | null;
  accessKind: "injected" | "viewed" | "edited" | "confirmed";
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

export type MissionStatus = "draft" | "active" | "blocked" | "awaiting_user" | "completed" | "failed";
export type MissionPhase = "align" | "plan" | "execute" | "review" | "merge" | "done";

export interface Mission {
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

export type MissionWorkstreamStatus =
  | "queued"
  | "running"
  | "blocked"
  | "awaiting_review"
  | "awaiting_user"
  | "completed"
  | "failed";

export interface MissionWorkstream {
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

export type MissionCheckpointType = "direction" | "review" | "approval" | "conflict" | "identity";
export type MissionCheckpointStatus = "open" | "resolved" | "dismissed";

export interface MissionCheckpoint {
  id: string;
  missionId: string;
  workstreamId: string | null;
  type: MissionCheckpointType;
  title: string;
  summary: string;
  status: MissionCheckpointStatus;
  requiresUserAction: boolean;
  createdByPartnerId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MissionHandoffStatus = "pending" | "accepted" | "completed" | "rejected";

export interface MissionHandoff {
  id: string;
  missionId: string;
  fromWorkstreamId: string;
  toPartnerId: string;
  reason: string;
  payloadSummary: string | null;
  status: MissionHandoffStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MissionSummary {
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

export type SkillLifecycleStatus = "installed" | "disabled" | "error";

export interface InstalledSkill {
  name: string;
  description: string;
  source: string;
  sourceType: "local" | "market" | "imported";
  version: string;
  enabled: boolean;
  status: SkillLifecycleStatus;
  dependencyErrors: string[];
  installedAt: string;
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

export type AgentTraceStatus = "running" | "completed" | "failed" | "aborted";

export interface AgentTraceFileChange {
  path: string;
  changeType: "created" | "modified" | "deleted";
  diff: string;
}

export interface AgentTraceEvent {
  id: string;
  sessionId: string;
  traceType: string;
  sourceType: string;
  parentTraceId: string | null;
  spanId: string;
  status: AgentTraceStatus;
  summary: string;
  payload: Record<string, unknown>;
  fileChanges: AgentTraceFileChange[];
  createdAt: string;
}

export type KnowledgeGovernanceStatus =
  | "healthy"
  | "pending_review"
  | "stale"
  | "conflict"
  | "merged"
  | "rolled_back";

export interface KnowledgeGovernanceRecord {
  id: string;
  entryId: string;
  sourceType: string;
  sourceLabel: string;
  healthScore: number;
  status: KnowledgeGovernanceStatus;
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
  action: "refresh" | "approve" | "mark_stale" | "merge" | "rollback";
  note: string | null;
  actorId: string;
  payload: Record<string, unknown>;
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

export interface WorkspaceRepositoryBinding {
  workspaceId: string;
  repoId: string;
  position: number;
  addedAt: string;
}

export interface WorkspaceSearchRecord {
  kind: "repo" | "session" | "knowledge";
  id: string;
  repoId: string | null;
  title: string;
  summary: string;
  updatedAt: string;
}

export type KnowledgeImportStatus = "draft" | "confirmed" | "completed" | "failed";
export type KnowledgeImportItemStatus = "pending" | "imported" | "duplicate" | "skipped";

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
  status: KnowledgeImportItemStatus;
  mergedEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeImportBatch {
  id: string;
  name: string;
  sourceTypes: string[];
  sourceSummary: string;
  status: KnowledgeImportStatus;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export type SkillWorkflowStatus = "draft" | "active";
export type SkillWorkflowNodeType = "prompt" | "skill" | "agent" | "condition";
export type SkillWorkflowRunStatus = "running" | "completed" | "failed";
export type SkillWorkflowStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface SkillWorkflowNode {
  id: string;
  type: SkillWorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
  next: string[];
}

export interface SkillWorkflowRecord {
  id: string;
  name: string;
  description: string;
  status: SkillWorkflowStatus;
  nodes: SkillWorkflowNode[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillWorkflowRunStep {
  nodeId: string;
  nodeName: string;
  nodeType: SkillWorkflowNodeType;
  status: SkillWorkflowStepStatus;
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
  status: SkillWorkflowRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  steps: SkillWorkflowRunStep[];
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
}

export type MemoryShareVisibility = "private" | "workspace" | "team";
export type MemoryShareReviewStatus = "draft" | "pending" | "approved" | "rejected" | "published";

export interface MemoryShareRecord {
  id: string;
  memoryId: string;
  knowledgeEntryId: string | null;
  visibility: MemoryShareVisibility;
  reviewStatus: MemoryShareReviewStatus;
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
  action: "submit" | "approve" | "reject" | "publish" | "rollback";
  note: string | null;
  createdBy: string;
  createdAt: string;
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
  dependencyErrors?: string[];
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

