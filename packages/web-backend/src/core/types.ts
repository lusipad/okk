import type { TeamEvent } from "../types/contracts.js";
import type { CoreApi, CreateCoreOptions } from "@okclaw/core";

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

export interface SessionRecord {
  id: string;
  title: string;
  repoId: string;
  createdAt: string;
  updatedAt: string;
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

export interface RuntimeBackendHealth {
  backend: string;
  command: string;
  available: boolean;
  reason?: string;
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

export interface OkclawCore {
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
  };
  sessions: {
    list(): Promise<SessionRecord[]>;
    create(input: Pick<SessionRecord, "title" | "repoId">): Promise<SessionRecord>;
  };
  knowledge: {
    list(): Promise<KnowledgeRecord[]>;
    create(input: Omit<KnowledgeRecord, "id" | "updatedAt">): Promise<KnowledgeRecord>;
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

type _CoreApiIsCompatible = CoreApi extends OkclawCore ? true : never;
