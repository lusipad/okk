import type { TeamEvent } from "../types/contracts.js";
import type { CoreApi, CreateCoreOptions, MemoryEntry as CoreMemoryEntry, MemoryStatus as CoreMemoryStatus, MemoryType as CoreMemoryType } from "@okk/core";

export type MemoryEntry = CoreMemoryEntry;
export type MemoryStatus = CoreMemoryStatus;
export type MemoryType = CoreMemoryType;
export interface AuthUser {
  id: string;
  username: string;
  role: "user" | "admin";
}

export interface RepoRecord {
  id: string;
  name: string;
  path: string;
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
  repoId: string;
  activityType: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface RepoContextRecord {
  repoId: string;
  repoName: string;
  snapshot: RepoContextSnapshot;
  recentActivities: RepoActivityRecord[];
}

export interface RepoContinueRecord {
  repoId: string;
  repoName: string;
  prompt: string;
  summary: string;
  snapshot: RepoContextSnapshot;
  recentActivities: RepoActivityRecord[];
}

export interface SessionRecord {
  id: string;
  title: string;
  repoId: string;
  summary: string;
  tags: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionReferenceRecord {
  messageId: string;
  snippet: string;
  createdAt: string;
}
export interface KnowledgeRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  status: "draft" | "published" | "stale" | "archived";
  updatedAt: string;
}

export interface AgentRecord {
  name: string;
  description: string;
  backend: string;
}

export interface SkillRecord {
  name: string;
  description: string;
  version: string;
}

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

export interface QaStreamChunk {
  content: string;
}

export interface QaRequest {
  sessionId: string;
  action: "ask" | "follow_up";
  backend: string;
  agentName: string;
  clientMessageId: string;
  content: string;
  skillIds?: string[];
  mcpServerIds?: string[];
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

export interface PartnerMemorySummaryRecord {
  id: string;
  title: string;
  summary: string;
  memoryType: MemoryType;
}

export interface PartnerSummaryRecord {
  identity: { id: string; name: string; summary: string | null; isActive: boolean } | null;
  memoryCount: number;
  recentMemories: PartnerMemorySummaryRecord[];
  activeRepoName: string | null;
}

export interface OkkCore {
  runtime: {
    listBackendHealth(): Promise<RuntimeBackendHealth[]>;
  };
  auth: {
    authenticate(username: string, password: string): Promise<AuthUser | null>;
    getUserById(userId: string): Promise<AuthUser | null>;
  };
  repos: {
    list(): Promise<RepoRecord[]>;
    create(input: Pick<RepoRecord, "name" | "path">): Promise<RepoRecord>;
    getContext(repoId: string): Promise<RepoContextRecord>;
    updateContext(repoId: string, input: Partial<RepoContextSnapshot>): Promise<RepoContextRecord>;
    continue(repoId: string): Promise<RepoContinueRecord>;
  };
  sessions: {
    list(input?: { archived?: boolean; q?: string; tag?: string }): Promise<SessionRecord[]>;
    create(input: Pick<SessionRecord, "title" | "repoId">): Promise<SessionRecord>;
    archive(sessionId: string): Promise<SessionRecord | null>;
    restore(sessionId: string): Promise<SessionRecord | null>;
    listReferences(sessionId: string, query?: string): Promise<SessionReferenceRecord[]>;
  };
  knowledge: {
    list(): Promise<KnowledgeRecord[]>;
    create(input: Omit<KnowledgeRecord, "id" | "updatedAt">): Promise<KnowledgeRecord>;
  };
  memory: {
    list(input?: { repoId?: string | null; memoryType?: MemoryType; status?: MemoryStatus }): Promise<MemoryEntry[]>;
    upsert(input: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">): Promise<MemoryEntry>;
    update(memoryId: string, input: Partial<Pick<MemoryEntry, "title" | "content" | "summary" | "confidence" | "status">>): Promise<MemoryEntry | null>;
    syncRepo(repoId: string): Promise<{ imported: number }>;
  };
  partner: {
    getSummary(): Promise<PartnerSummaryRecord>;
  };
  agents: {
    list(): Promise<AgentRecord[]>;
  };
  skills: {
    list(): Promise<SkillRecord[]>;
  };
  qa: {
    streamAnswer(request: QaRequest): AsyncIterable<QaStreamChunk>;
    abort(sessionId: string): Promise<boolean>;
  };
  team: {
    list(): Promise<Array<{ id: string; name: string }>>;
    publish(event: Omit<TeamEvent, "event_id" | "timestamp">): TeamEvent;
    subscribe(teamId: string, handler: (event: TeamEvent) => void): () => void;
    run(request: TeamRunRequest): Promise<TeamRunRecord>;
    getRun(runId: string): Promise<TeamRunRecord | null>;
    listRuns(sessionId: string): Promise<TeamRunRecord[]>;
  };
  installedSkills?: unknown;
  database?: unknown;
}

export interface LoadCoreOptions {
  logger: {
    warn(message: string, extra?: Record<string, unknown>): void;
    info(message: string, extra?: Record<string, unknown>): void;
    error?(message: string, extra?: Record<string, unknown>): void;
  };
  allowInMemoryFallback?: boolean;
  createCoreOptions?: Pick<
    CreateCoreOptions,
    "dbPath" | "workspaceRoot" | "claudeCommand" | "codexCommand" | "skillDirectories"
  >;
}

type _CoreApiIsCompatible = CoreApi extends OkkCore ? true : never;





