import type {
  AgentInfo,
  AgentTraceEvent,
  CollaborationAction,
  CollaborationDiagnostics,
  CollaborationRunStatus,
  CollaborationSourceType,
  KnowledgeSuggestion,
  LoginResult,
  RepoContextRecord,
  RepoContinueRecord,
  MemoryEntry,
  MemoryStatus,
  IdentityProfile,
  MemoryType,
  SessionInfo,
  SessionReferenceRecord,
  SkillInfo
} from '../types/domain';
import { HttpClient } from './http-client';
import { SessionWsClient, TeamWsClient } from './ws-client';
import type {
  AskQuestionInput,
  CreateMcpServerInput,
  IOProvider,
  ImportSkillFolderInput,
  InstallSkillFromMarketInput,
  McpResourceInfo,
  McpResourceReadContent,
  McpServerSetting,
  McpToolCallResult,
  McpToolInfo,
  RuntimeBackendHealth,
  RetryQuestionInput,
  SaveKnowledgeInput,
  SkillDetail,
  SkillDiagnosisResult,
  SkillFileInfo,
  SkillMarketItem,
  SkillRiskIssue,
  SkillRiskScanResult,
  SkillRiskSummary,
  TeamRunRecord,
  TeamRunRequest,
  SubscribeTeamInput,
  SubscribeSessionInput,
  UpdateMcpServerInput
} from './types';

interface HttpWsIOProviderOptions {
  baseUrl: string;
  wsBaseUrl: string;
  getToken: () => string | null;
  onAuthExpired: () => void;
}

interface ListPayload<T> {
  items: T[];
}

interface BackendAgentRecord {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  backend?: unknown;
}

interface BackendSkillRecord {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  version?: unknown;
  source?: unknown;
  riskLevel?: unknown;
  riskSummary?: unknown;
  installed?: unknown;
  installedAt?: unknown;
}

interface BackendSkillMarketRecord {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  version?: unknown;
  source?: unknown;
  tags?: unknown;
  author?: unknown;
  homepage?: unknown;
  sourceType?: unknown;
  sourceLocation?: unknown;
  sourceBranch?: unknown;
  installed?: unknown;
}

interface BackendSkillDetailPayload {
  item?: unknown;
  risk?: unknown;
}

interface BackendSkillFileRecord {
  path?: unknown;
  kind?: unknown;
  size?: unknown;
}

interface BackendSkillRiskIssueRecord {
  ruleId?: unknown;
  severity?: unknown;
  message?: unknown;
  filePath?: unknown;
  line?: unknown;
  snippet?: unknown;
}

interface BackendSkillRiskPayload {
  summary?: unknown;
  issues?: unknown;
}

interface BackendMcpRecord {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  command?: unknown;
  args?: unknown;
  cwd?: unknown;
  env?: unknown;
  enabled?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastStartedAt?: unknown;
  lastStoppedAt?: unknown;
  lastError?: unknown;
}

interface BackendMcpToolRecord {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
}

interface BackendMcpResourceRecord {
  uri?: unknown;
  name?: unknown;
  description?: unknown;
  mimeType?: unknown;
}

interface BackendMcpToolCallPayload {
  content?: unknown;
  raw?: unknown;
}

interface BackendMcpResourceReadPayload {
  contents?: unknown;
}

interface BackendRuntimeHealthRecord {
  backend?: unknown;
  command?: unknown;
  available?: unknown;
  reason?: unknown;
}

interface BackendTeamRunMemberRecord {
  memberId?: unknown;
  agentName?: unknown;
  backend?: unknown;
  status?: unknown;
  startedAt?: unknown;
  updatedAt?: unknown;
  output?: unknown;
  error?: unknown;
}

interface BackendTeamRunRecord {
  id?: unknown;
  teamId?: unknown;
  sessionId?: unknown;
  teamName?: unknown;
  status?: unknown;
  memberCount?: unknown;
  startedAt?: unknown;
  updatedAt?: unknown;
  endedAt?: unknown;
  summary?: unknown;
  members?: unknown;
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function asString(input: unknown, fallback: string): string {
  return typeof input === 'string' && input.trim().length > 0 ? input : fallback;
}

function asNullableString(input: unknown): string | null {
  return typeof input === 'string' && input.trim().length > 0 ? input : null;
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function asEnvMap(input: unknown): Record<string, string> {
  if (!isObject(input)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || !key.trim()) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

function unwrapItems<T>(payload: T[] | ListPayload<T>): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isObject(payload) && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
}

function createClientMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asBoolean(input: unknown): boolean | undefined {
  return typeof input === 'boolean' ? input : undefined;
}

function asSeverity(input: unknown): CollaborationDiagnostics['severity'] | undefined {
  return input === 'info' || input === 'warning' || input === 'error' ? input : undefined;
}

function asActionKind(input: unknown): CollaborationAction['kind'] | null {
  return input === 'retry' || input === 'refresh' || input === 'copy_diagnostic' || input === 'open_route' ? input : null;
}

function asSourceType(input: unknown): CollaborationSourceType | undefined {
  return input === 'team' || input === 'agent' || input === 'skill' || input === 'mcp' || input === 'backend' || input === 'tool'
    ? input
    : undefined;
}

function asRunStatus(input: unknown): CollaborationRunStatus | undefined {
  return input === 'queued' ||
    input === 'running' ||
    input === 'completed' ||
    input === 'failed' ||
    input === 'aborted' ||
    input === 'ready' ||
    input === 'unavailable'
    ? input
    : undefined;
}

function mapCollaborationDiagnostics(input: unknown): CollaborationDiagnostics | undefined {
  if (!isObject(input)) {
    return undefined;
  }

  const message = asNullableString(input.message) ?? asNullableString(input.reason) ?? asNullableString(input.detail);
  if (!message) {
    return undefined;
  }

  return {
    ...(asNullableString(input.code) ? { code: asNullableString(input.code) ?? undefined } : {}),
    message,
    ...(asNullableString(input.detail) ? { detail: asNullableString(input.detail) ?? undefined } : {}),
    ...(asBoolean(input.retryable) !== undefined ? { retryable: asBoolean(input.retryable) } : {}),
    ...(asSeverity(input.severity) ? { severity: asSeverity(input.severity) } : {})
  };
}

function mapCollaborationActions(input: unknown): CollaborationAction[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const items = input
    .map((item): CollaborationAction | null => {
      if (!isObject(item)) {
        return null;
      }

      const kind = asActionKind(item.kind);
      if (!kind) {
        return null;
      }

      const label =
        asNullableString(item.label) ??
        (kind === 'retry'
          ? '重试消息'
          : kind === 'refresh'
            ? '刷新状态'
            : kind === 'open_route'
              ? '打开配置'
              : '复制诊断');
      const route = asNullableString(item.route) ?? undefined;

      return route ? { kind, label, route } : { kind, label };
    })
    .filter((item): item is CollaborationAction => item !== null);

  return items.length > 0 ? items : undefined;
}

function toRiskLevel(input: unknown): SkillInfo['riskLevel'] {
  return input === 'high' || input === 'medium' || input === 'low' ? input : 'low';
}

function toRiskSummary(input: unknown, fallbackLevel: SkillInfo['riskLevel']): SkillRiskSummary {
  if (!isObject(input)) {
    return {
      level: fallbackLevel,
      issueCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0
    };
  }

  const level = toRiskLevel(input.level);
  return {
    level,
    issueCount: typeof input.issueCount === 'number' ? input.issueCount : 0,
    highCount: typeof input.highCount === 'number' ? input.highCount : 0,
    mediumCount: typeof input.mediumCount === 'number' ? input.mediumCount : 0,
    lowCount: typeof input.lowCount === 'number' ? input.lowCount : 0
  };
}

function mapSkillInfo(record: unknown, index: number): SkillInfo {
  const source = isObject(record) ? record : {};
  const riskLevel = toRiskLevel(source.riskLevel);

  return {
    id: asString(source.id, `skill-${index + 1}`),
    name: asString(source.name, `Skill ${index + 1}`),
    description: asString(source.description, ''),
    riskLevel,
    installed: Boolean(source.installed)
  };
}

function mapSkillMarketItem(record: unknown, index: number): SkillMarketItem {
  const source = isObject(record) ? record : {};
  const sourceType = source.sourceType === 'git' ? 'git' : 'folder';

  return {
    id: asString(source.id, `market-skill-${index + 1}`),
    name: asString(source.name, `Market Skill ${index + 1}`),
    description: asString(source.description, ''),
    version: asString(source.version, '0.0.1'),
    source: asString(source.source, 'market'),
    tags: asStringArray(source.tags),
    author: asString(source.author, ''),
    homepage: asString(source.homepage, ''),
    sourceType,
    sourceLocation: asString(source.sourceLocation, ''),
    sourceBranch: asNullableString(source.sourceBranch),
    installed: Boolean(source.installed)
  };
}

function mapMcpServer(record: unknown, index: number): McpServerSetting {
  const source = isObject(record) ? record : {};
  const statusRaw = source.status;
  const status: McpServerSetting['status'] =
    statusRaw === 'running' || statusRaw === 'error' || statusRaw === 'stopped'
      ? statusRaw
      : Boolean(source.enabled)
        ? 'running'
        : 'stopped';

  return {
    id: asString(source.id, `mcp-${index + 1}`),
    name: asString(source.name, `MCP Server ${index + 1}`),
    description: asString(source.description, ''),
    command: asString(source.command, 'mcp-server'),
    args: asStringArray(source.args),
    cwd: asNullableString(source.cwd),
    env: asEnvMap(source.env),
    enabled: Boolean(source.enabled),
    status,
    createdAt: asString(source.createdAt, ''),
    updatedAt: asString(source.updatedAt, ''),
    lastStartedAt: asNullableString(source.lastStartedAt),
    lastStoppedAt: asNullableString(source.lastStoppedAt),
    lastError: asNullableString(source.lastError)
  };
}

function mapSkillRiskIssue(record: unknown): SkillRiskIssue | null {
  const source = isObject(record) ? record : {};
  const severityRaw = source.severity;
  const severity: SkillRiskIssue['severity'] =
    severityRaw === 'high' || severityRaw === 'medium' || severityRaw === 'low' ? severityRaw : 'low';

  if (!source.ruleId || !source.filePath) {
    return null;
  }

  return {
    ruleId: asString(source.ruleId, 'unknown-rule'),
    severity,
    message: asString(source.message, ''),
    filePath: asString(source.filePath, ''),
    line: typeof source.line === 'number' ? source.line : 0,
    snippet: asString(source.snippet, '')
  };
}

function mapRuntimeBackend(record: unknown, index: number): RuntimeBackendHealth {
  const source = isObject(record) ? record : {};
  const available = Boolean(source.available);
  const reason = asNullableString(source.reason) ?? undefined;
  const diagnostics = mapCollaborationDiagnostics(source.diagnostics) ??
    (!available && reason
      ? {
          message: reason,
          detail: asNullableString(source.command) ? `命令 ${asNullableString(source.command)}` : undefined,
          retryable: true,
          severity: 'error'
        }
      : undefined);
  return {
    backend: asString(source.backend, `backend-${index + 1}`),
    command: asString(source.command, ''),
    available,
    reason,
    sourceType: asSourceType(source.sourceType) ?? 'backend',
    runtimeStatus: asRunStatus(source.runtimeStatus) ?? (available ? 'ready' : 'unavailable'),
    diagnostics,
    actions: mapCollaborationActions(source.actions)
  };
}

function mapTeamRunRecord(record: unknown): TeamRunRecord {
  const source = isObject(record) ? record : {};
  const members = Array.isArray(source.members) ? source.members : [];
  const statusRaw = source.status;
  const status: TeamRunRecord['status'] =
    statusRaw === 'running' || statusRaw === 'done' || statusRaw === 'error' ? statusRaw : 'running';
  const summary = asNullableString(source.summary) ?? undefined;
  const diagnostics = mapCollaborationDiagnostics(source.diagnostics) ??
    (status === 'error' && summary
      ? {
          message: summary,
          retryable: true,
          severity: 'error'
        }
      : undefined);

  return {
    id: asString(source.id, createClientMessageId('team-run')),
    teamId: asString(source.teamId, asString(source.id, 'team')),
    sessionId: asString(source.sessionId, ''),
    teamName: asString(source.teamName, '团队执行'),
    status,
    memberCount: typeof source.memberCount === 'number' ? source.memberCount : members.length,
    startedAt: asString(source.startedAt, ''),
    updatedAt: asString(source.updatedAt, ''),
    endedAt: asNullableString(source.endedAt) ?? undefined,
    summary,
    sourceType: asSourceType(source.sourceType) ?? 'team',
    runtimeStatus: asRunStatus(source.runtimeStatus) ?? (status === 'running' ? 'running' : status === 'done' ? 'completed' : 'failed'),
    diagnostics,
    actions: mapCollaborationActions(source.actions),
    members: members.map((item, index) => {
      const member = isObject(item) ? item : {};
      const memberStatusRaw = member.status;
      const memberStatus: 'done' | 'error' = memberStatusRaw === 'done' ? 'done' : 'error';
      const memberDiagnostics = mapCollaborationDiagnostics(member.diagnostics) ??
        (asNullableString(member.error)
          ? {
              message: asNullableString(member.error) ?? '成员执行失败',
              retryable: true,
              severity: 'error'
            }
          : undefined);

      return {
        memberId: asString(member.memberId, `member-${index + 1}`),
        agentName: asString(member.agentName, `agent-${index + 1}`),
        backend: asString(member.backend, 'codex'),
        status: memberStatus,
        startedAt: asString(member.startedAt, ''),
        updatedAt: asString(member.updatedAt, ''),
        output: asNullableString(member.output) ?? undefined,
        error: asNullableString(member.error) ?? undefined,
        sourceType: asSourceType(member.sourceType) ?? 'agent',
        runtimeStatus: asRunStatus(member.runtimeStatus) ?? (memberStatus === 'done' ? 'completed' : 'failed'),
        diagnostics: memberDiagnostics,
        actions: mapCollaborationActions(member.actions)
      };
    })
  };
}

export class HttpWsIOProvider implements IOProvider {
  private readonly http: HttpClient;

  private readonly wsBaseUrl: string;

  private readonly getToken: () => string | null;

  private readonly onAuthExpired: () => void;

  private readonly wsClients = new Map<string, SessionWsClient>();
  private readonly teamWsClients = new Map<string, TeamWsClient>();

  private readonly agentRuntimeById = new Map<string, { name: string; backend: string }>();

  constructor(options: HttpWsIOProviderOptions) {
    this.http = new HttpClient({
      baseUrl: options.baseUrl,
      getToken: options.getToken
    });
    this.wsBaseUrl = options.wsBaseUrl;
    this.getToken = options.getToken;
    this.onAuthExpired = options.onAuthExpired;
  }

  async login(username: string, password: string): Promise<LoginResult> {
    return this.http.post<LoginResult>('/api/auth/login', { username, password });
  }

  async listSessions(input?: { archived?: boolean; q?: string; tag?: string }): Promise<SessionInfo[]> {
    const params = new URLSearchParams();
    if (input?.q) {
      params.set('q', input.q);
    }
    if (input?.tag) {
      params.set('tag', input.tag);
    }
    if (input?.archived) {
      params.set('archived', 'true');
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const payload = await this.http.get<SessionInfo[] | ListPayload<SessionInfo>>(`/api/sessions${suffix}`);
    return unwrapItems(payload);
  }

  async createSession(title?: string): Promise<SessionInfo> {
    const resolvedTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : '新会话';
    return this.http.post<SessionInfo>('/api/sessions', { title: resolvedTitle });
  }


  async archiveSession(sessionId: string): Promise<SessionInfo> {
    return this.http.post<SessionInfo>(`/api/sessions/${encodeURIComponent(sessionId)}/archive`, {});
  }

  async restoreSession(sessionId: string): Promise<SessionInfo> {
    return this.http.post<SessionInfo>(`/api/sessions/${encodeURIComponent(sessionId)}/restore`, {});
  }

  async listSessionReferences(sessionId: string, query?: string): Promise<SessionReferenceRecord[]> {
    const suffix = query && query.trim().length > 0 ? `?q=${encodeURIComponent(query.trim())}` : "";
    const payload = await this.http.get<SessionReferenceRecord[] | ListPayload<SessionReferenceRecord>>(
      `/api/sessions/${encodeURIComponent(sessionId)}/references${suffix}`
    );
    return unwrapItems(payload);
  }
  async getRepoContext(repoId: string): Promise<RepoContextRecord> {
    return this.http.get<RepoContextRecord>(`/api/repos/${encodeURIComponent(repoId)}/context`);
  }

  async updateRepoContext(repoId: string, input: Partial<RepoContextRecord['snapshot']>): Promise<RepoContextRecord> {
    return this.http.patch<RepoContextRecord>(`/api/repos/${encodeURIComponent(repoId)}/context`, input);
  }


  async listIdentityProfiles(): Promise<IdentityProfile[]> {
    const payload = await this.http.get<IdentityProfile[] | ListPayload<IdentityProfile>>("/api/identity");
    return unwrapItems(payload);
  }

  async getActiveIdentity(): Promise<IdentityProfile | null> {
    const payload = await this.http.get<{ item?: IdentityProfile | null }>("/api/identity/active");
    return payload.item ?? null;
  }

  async upsertIdentity(input: Omit<IdentityProfile, "id" | "createdAt" | "updatedAt">): Promise<IdentityProfile> {
    const payload = await this.http.post<{ item: IdentityProfile }>("/api/identity", input);
    return payload.item;
  }

  async activateIdentity(identityId: string): Promise<IdentityProfile> {
    const payload = await this.http.post<{ item: IdentityProfile }>(`/api/identity/${encodeURIComponent(identityId)}/activate`, {});
    return payload.item;
  }
  async listAgentTraces(sessionId: string): Promise<AgentTraceEvent[]> {
    const payload = await this.http.get<AgentTraceEvent[] | ListPayload<AgentTraceEvent>>(`/api/agents/traces/${encodeURIComponent(sessionId)}`);
    return unwrapItems(payload);
  }
  async continueRepoContext(repoId: string): Promise<RepoContinueRecord> {
    return this.http.post<RepoContinueRecord>(`/api/repos/${encodeURIComponent(repoId)}/continue`, {});
  }

  async listMemoryEntries(input?: { repoId?: string; memoryType?: MemoryType; status?: MemoryStatus }): Promise<MemoryEntry[]> {
    const params = new URLSearchParams();
    if (input?.repoId) {
      params.set('repoId', input.repoId);
    }
    if (input?.memoryType) {
      params.set('memoryType', input.memoryType);
    }
    if (input?.status) {
      params.set('status', input.status);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const payload = await this.http.get<MemoryEntry[] | ListPayload<MemoryEntry>>(`/api/memory${suffix}`);
    return unwrapItems(payload);
  }

  async createMemoryEntry(input: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt" | "userId">): Promise<MemoryEntry> {
    const payload = await this.http.post<{ item: MemoryEntry }>('/api/memory', input);
    return payload.item;
  }

  async updateMemoryEntry(memoryId: string, input: Partial<Pick<MemoryEntry, "title" | "content" | "summary" | "confidence" | "status">>): Promise<MemoryEntry> {
    const payload = await this.http.patch<{ item: MemoryEntry }>(`/api/memory/${encodeURIComponent(memoryId)}`, input);
    return payload.item;
  }

  async syncMemoryRepo(repoId: string): Promise<{ imported: number }> {
    return this.http.post<{ imported: number }>('/api/memory/sync', { repoId });
  }

  async listRuntimeBackends(): Promise<RuntimeBackendHealth[]> {
    const payload = await this.http.get<
      BackendRuntimeHealthRecord[] | ListPayload<BackendRuntimeHealthRecord>
    >('/api/agents/runtime/backends');
    return unwrapItems(payload).map((item, index) => mapRuntimeBackend(item, index));
  }

  async askQuestion(input: AskQuestionInput): Promise<void> {
    const runtime = this.resolveAgentRuntime(input.agentId);
    this.getOrCreateWsClient(input.sessionId).sendQaMessage({
      action: 'ask',
      backend: runtime.backend,
      agent_name: runtime.name,
      client_message_id: input.clientMessageId,
      content: input.content,
      ...(input.skillIds && input.skillIds.length > 0 ? { skill_ids: input.skillIds } : {}),
      ...(input.mcpServerIds && input.mcpServerIds.length > 0 ? { mcp_server_ids: input.mcpServerIds } : {})
    });
  }

  async retryQuestion(input: RetryQuestionInput): Promise<void> {
    const runtime = this.resolveAgentRuntime(input.agentId);
    this.getOrCreateWsClient(input.sessionId).sendQaMessage({
      action: 'follow_up',
      backend: runtime.backend,
      agent_name: runtime.name,
      client_message_id: input.clientMessageId,
      content: input.content,
      ...(input.skillIds && input.skillIds.length > 0 ? { skill_ids: input.skillIds } : {}),
      ...(input.mcpServerIds && input.mcpServerIds.length > 0 ? { mcp_server_ids: input.mcpServerIds } : {})
    });
  }

  async abortSession(sessionId: string): Promise<void> {
    this.getOrCreateWsClient(sessionId).sendAbortMessage();
  }

  subscribeSession(input: SubscribeSessionInput): () => void {
    const client = this.getOrCreateWsClient(input.sessionId);
    const unsubscribe = client.subscribe(input.subscriber, input.lastEventId);

    return () => {
      unsubscribe();
      if (!client.hasSubscribers) {
        client.close();
        this.wsClients.delete(input.sessionId);
      }
    };
  }

  subscribeTeam(input: SubscribeTeamInput): () => void {
    const client = this.getOrCreateTeamWsClient(input.teamId);
    const unsubscribe = client.subscribe(input.subscriber);

    return () => {
      unsubscribe();
      if (!client.hasSubscribers) {
        client.close();
        this.teamWsClients.delete(input.teamId);
      }
    };
  }

  async runTeam(input: TeamRunRequest): Promise<TeamRunRecord> {
    const payload = await this.http.post<BackendTeamRunRecord>('/api/agents/teams/runs', input);
    return mapTeamRunRecord(payload);
  }

  async getTeamRun(runId: string): Promise<TeamRunRecord | null> {
    try {
      const payload = await this.http.get<{ item?: BackendTeamRunRecord }>(`/api/agents/teams/runs/${runId}`);
      if (!isObject(payload) || !payload.item) {
        return null;
      }
      return mapTeamRunRecord(payload.item);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async listTeamRuns(sessionId: string): Promise<TeamRunRecord[]> {
    const payload = await this.http.get<BackendTeamRunRecord[] | ListPayload<BackendTeamRunRecord>>(
      `/api/agents/teams/runs?sessionId=${encodeURIComponent(sessionId)}`
    );
    return unwrapItems(payload).map((item) => mapTeamRunRecord(item));
  }

  async listAgents(): Promise<AgentInfo[]> {
    const payload = await this.http.get<BackendAgentRecord[] | ListPayload<BackendAgentRecord>>('/api/agents');
    const records = unwrapItems(payload);

    this.agentRuntimeById.clear();

    return records.map((record, index) => {
      const source = isObject(record) ? record : {};
      const name = asString(source.name, `Agent ${index + 1}`);
      const backend = asString(source.backend, 'codex');
      const id = asString(source.id, `${backend}:${name}`);
      const description = asString(source.description, '');

      this.agentRuntimeById.set(id, { name, backend });

      return {
        id,
        name,
        description,
        backend
      };
    });
  }

  async saveKnowledgeSuggestion(input: SaveKnowledgeInput): Promise<KnowledgeSuggestion> {
    return this.http.post<KnowledgeSuggestion>(`/api/knowledge/suggestions/${input.suggestionId}/save`, {
      sessionId: input.sessionId
    });
  }

  async ignoreKnowledgeSuggestion(input: SaveKnowledgeInput): Promise<void> {
    await this.http.post<void>(`/api/knowledge/suggestions/${input.suggestionId}/ignore`, {
      sessionId: input.sessionId
    });
  }

  async listMcpServers(): Promise<McpServerSetting[]> {
    const payload = await this.http.get<BackendMcpRecord[] | ListPayload<BackendMcpRecord>>('/api/mcp/servers');
    return unwrapItems(payload).map((record, index) => mapMcpServer(record, index));
  }

  async createMcpServer(input: CreateMcpServerInput): Promise<McpServerSetting> {
    const payload = await this.http.post<BackendMcpRecord>('/api/mcp/servers', input);
    return mapMcpServer(payload, 0);
  }

  async updateMcpServer(serverId: string, input: UpdateMcpServerInput): Promise<McpServerSetting> {
    const payload = await this.http.patch<BackendMcpRecord>(`/api/mcp/servers/${serverId}`, input);
    return mapMcpServer(payload, 0);
  }

  async deleteMcpServer(serverId: string): Promise<void> {
    await this.http.delete<void>(`/api/mcp/servers/${serverId}`);
  }

  async setMcpServerEnabled(serverId: string, enabled: boolean): Promise<McpServerSetting> {
    return this.updateMcpServer(serverId, { enabled });
  }

  async startMcpServer(serverId: string): Promise<McpServerSetting> {
    const payload = await this.http.post<BackendMcpRecord>(`/api/mcp/servers/${serverId}/start`);
    return mapMcpServer(payload, 0);
  }

  async stopMcpServer(serverId: string): Promise<McpServerSetting> {
    const payload = await this.http.post<BackendMcpRecord>(`/api/mcp/servers/${serverId}/stop`);
    return mapMcpServer(payload, 0);
  }

  async listMcpTools(serverId: string): Promise<McpToolInfo[]> {
    const payload = await this.http.get<BackendMcpToolRecord[] | ListPayload<BackendMcpToolRecord>>(
      `/api/mcp/servers/${serverId}/tools`
    );
    return unwrapItems(payload).map((record) => {
      const source = isObject(record) ? record : {};
      return {
        name: asString(source.name, 'unknown_tool'),
        description: asString(source.description, ''),
        inputSchema: isObject(source.inputSchema) ? source.inputSchema : null
      };
    });
  }

  async callMcpTool(serverId: string, name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    const payload = await this.http.post<BackendMcpToolCallPayload>(`/api/mcp/servers/${serverId}/tools/call`, {
      name,
      arguments: args
    });
    const raw = isObject(payload.raw) ? payload.raw : {};
    return {
      content: asString(payload.content, ''),
      raw
    };
  }

  async listMcpResources(serverId: string): Promise<McpResourceInfo[]> {
    const payload = await this.http.get<BackendMcpResourceRecord[] | ListPayload<BackendMcpResourceRecord>>(
      `/api/mcp/servers/${serverId}/resources`
    );
    return unwrapItems(payload).map((record) => {
      const source = isObject(record) ? record : {};
      return {
        uri: asString(source.uri, ''),
        name: asString(source.name, ''),
        description: asString(source.description, ''),
        mimeType: asNullableString(source.mimeType)
      };
    });
  }

  async readMcpResource(serverId: string, uri: string): Promise<McpResourceReadContent[]> {
    const payload = await this.http.post<BackendMcpResourceReadPayload>(`/api/mcp/servers/${serverId}/resources/read`, {
      uri
    });
    const source = Array.isArray(payload.contents) ? payload.contents : [];
    return source
      .map((item) => (isObject(item) ? item : null))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({
        uri: asString(item.uri, ''),
        mimeType: asNullableString(item.mimeType),
        text: asString(item.text, '')
      }));
  }

  async listSkills(): Promise<SkillInfo[]> {
    const payload = await this.http.get<BackendSkillRecord[] | ListPayload<BackendSkillRecord>>('/api/skills');
    return unwrapItems(payload).map((record, index) => mapSkillInfo(record, index));
  }

  async readSkill(skillId: string): Promise<SkillDetail> {
    const payload = await this.http.get<BackendSkillDetailPayload>(`/api/skills/${skillId}`);
    const item = isObject(payload.item) ? payload.item : {};
    const riskPayload = isObject(payload.risk) ? payload.risk : {};
    const riskLevel = toRiskLevel(item.riskLevel);

    return {
      id: asString(item.id, skillId),
      name: asString(item.name, skillId),
      description: asString(item.description, ''),
      riskLevel,
      installed: Boolean(item.installed),
      version: asString(item.version, '0.0.0'),
      source: asString(item.source, ''),
      installedAt: asNullableString(item.installedAt),
      rootPath: asString(item.rootPath, ''),
      content: asString(item.content, ''),
      riskSummary: toRiskSummary(item.riskSummary ?? riskPayload.summary, riskLevel)
    };
  }

  async listSkillFiles(skillId: string): Promise<SkillFileInfo[]> {
    const payload = await this.http.get<BackendSkillFileRecord[] | ListPayload<BackendSkillFileRecord>>(
      `/api/skills/${skillId}/files`
    );

    return unwrapItems(payload).map((record) => {
      const source = isObject(record) ? record : {};
      return {
        path: asString(source.path, ''),
        kind: source.kind === 'directory' ? 'directory' : 'file',
        size: typeof source.size === 'number' ? source.size : 0
      };
    });
  }


  async scanSkillRisk(skillId: string): Promise<SkillRiskScanResult> {
    const payload = await this.http.get<BackendSkillRiskPayload>(`/api/skills/${skillId}/risk-scan`);
    const summary = toRiskSummary(payload.summary, 'low');
    const issuesRaw = Array.isArray(payload.issues) ? payload.issues : [];
    return {
      summary,
      issues: issuesRaw
        .map((item) => mapSkillRiskIssue(item))
        .filter((item): item is SkillRiskIssue => item !== null)
    };
  }

  async diagnoseSkill(skillId: string): Promise<SkillDiagnosisResult> {
    const payload = await this.http.post<{ diagnosis: SkillDiagnosisResult }>(`/api/skills/${encodeURIComponent(skillId)}/diagnose`, {});
    return payload.diagnosis;
  }

  async setSkillEnabled(skillId: string, enabled: boolean): Promise<SkillInfo> {
    const payload = await this.http.patch<{ item: SkillInfo }>(`/api/skills/${encodeURIComponent(skillId)}/enabled`, { enabled });
    return payload.item;
  }

  async deleteSkill(skillId: string): Promise<void> {
    await this.http.delete<void>(`/api/skills/${skillId}`);
  }


  async importSkillFolder(input: ImportSkillFolderInput): Promise<SkillInfo> {
    const payload = await this.http.post<{ item?: BackendSkillRecord }>('/api/skills/import-folder', input);
    return mapSkillInfo(payload.item ?? {}, 0);
  }

  async installSkill(skillId: string): Promise<SkillInfo> {
    const payload = await this.http.post<BackendSkillRecord>(`/api/skills/${skillId}/install`);
    return mapSkillInfo(payload, 0);
  }

  async listSkillMarket(query?: string): Promise<SkillMarketItem[]> {
    const queryString = typeof query === 'string' && query.trim().length > 0 ? `?q=${encodeURIComponent(query.trim())}` : '';
    const payload = await this.http.get<BackendSkillMarketRecord[] | ListPayload<BackendSkillMarketRecord>>(
      `/api/skills/market${queryString}`
    );
    return unwrapItems(payload).map((record, index) => mapSkillMarketItem(record, index));
  }

  async installSkillFromMarket(input: InstallSkillFromMarketInput): Promise<SkillInfo> {
    const payload = await this.http.post<{ item?: BackendSkillRecord }>('/api/skills/market/install', input);
    return mapSkillInfo(payload.item ?? {}, 0);
  }

  private getOrCreateWsClient(sessionId: string): SessionWsClient {
    const existing = this.wsClients.get(sessionId);
    if (existing) {
      return existing;
    }

    const created = new SessionWsClient({
      wsBaseUrl: this.wsBaseUrl,
      sessionId,
      getToken: this.getToken,
      onAuthExpired: this.onAuthExpired
    });

    this.wsClients.set(sessionId, created);
    return created;
  }

  private getOrCreateTeamWsClient(teamId: string): TeamWsClient {
    const existing = this.teamWsClients.get(teamId);
    if (existing) {
      return existing;
    }

    const created = new TeamWsClient({
      wsBaseUrl: this.wsBaseUrl,
      teamId,
      getToken: this.getToken,
      onAuthExpired: this.onAuthExpired
    });
    this.teamWsClients.set(teamId, created);
    return created;
  }

  private resolveAgentRuntime(agentId?: string): { name: string; backend: string } {
    if (agentId) {
      const selected = this.agentRuntimeById.get(agentId);
      if (selected) {
        return selected;
      }
    }

    const first = this.agentRuntimeById.values().next();
    if (!first.done) {
      return first.value;
    }

    return {
      name: 'code-reviewer',
      backend: 'codex'
    };
  }
}














