import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  BackendManager,
  ClaudeCliBackend,
  CodexCliBackend,
  type BackendManagerLogEntry,
  type CliBackendLogEntry
} from "./backend/index.js";
import { AgentRunner } from "./agents/agent-runner.js";
import { SqliteDatabase } from "./database/index.js";
import { TeamManager, type TeamMemberInput } from "./team/index.js";
import type {
  AgentDefinition,
  BackendName,
  CollaborationAction,
  CollaborationDiagnostics,
  CollaborationRunStatus,
  CollaborationSourceType,
  KnowledgeStatus,
  Repository,
  Session,
  UserRole
} from "./types.js";
import { RepositoryContextService } from "./repository/index.js";
import { SkillRegistry } from "./skills/index.js";
import { generateId, nowIso } from "./utils/id.js";

export interface CoreAuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface CoreRepoRecord {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface CoreSessionRecord {
  id: string;
  title: string;
  repoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoreKnowledgeRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  status: KnowledgeStatus;
  updatedAt: string;
}

export interface CoreAgentRecord {
  name: string;
  description: string;
  backend: BackendName;
}

export interface CoreSkillRecord {
  name: string;
  description: string;
  version: string;
}

export interface CoreQaStreamChunk {
  content: string;
}

export interface CoreQaRequest {
  sessionId: string;
  action: "ask" | "follow_up";
  backend: BackendName;
  agentName: string;
  clientMessageId: string;
  content: string;
  skillIds?: string[];
  mcpServerIds?: string[];
}

export interface CoreTeamEvent {
  type: string;
  teamId: string;
  event_id: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface CoreBackendHealth {
  backend: BackendName;
  command: string;
  available: boolean;
  reason?: string;
  sourceType?: CollaborationSourceType;
  runtimeStatus?: CollaborationRunStatus;
  diagnostics?: CollaborationDiagnostics;
  actions?: CollaborationAction[];
}

export interface CoreTeamRunMemberInput {
  memberId?: string;
  agentName: string;
  backend?: BackendName;
  prompt: string;
  taskTitle: string;
  dependsOn?: string[];
}

export interface CoreTeamRunRequest {
  teamId?: string;
  sessionId: string;
  teamName: string;
  members: CoreTeamRunMemberInput[];
}

export interface CoreTeamRunMemberResult {
  memberId: string;
  agentName: string;
  backend: BackendName;
  status: "done" | "error";
  startedAt: string;
  updatedAt: string;
  output?: string;
  error?: string;
}

export interface CoreTeamRunRecord {
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
  members: CoreTeamRunMemberResult[];
}

export interface CoreApi {
  runtime: {
    listBackendHealth(): Promise<CoreBackendHealth[]>;
  };
  auth: {
    authenticate(username: string, password: string): Promise<CoreAuthUser | null>;
    getUserById(userId: string): Promise<CoreAuthUser | null>;
  };
  repos: {
    list(): Promise<CoreRepoRecord[]>;
    create(input: Pick<CoreRepoRecord, "name" | "path">): Promise<CoreRepoRecord>;
  };
  sessions: {
    list(): Promise<CoreSessionRecord[]>;
    create(input: Pick<CoreSessionRecord, "title" | "repoId">): Promise<CoreSessionRecord>;
  };
  knowledge: {
    list(): Promise<CoreKnowledgeRecord[]>;
    create(input: Omit<CoreKnowledgeRecord, "id" | "updatedAt">): Promise<CoreKnowledgeRecord>;
  };
  agents: {
    list(): Promise<CoreAgentRecord[]>;
  };
  skills: {
    list(): Promise<CoreSkillRecord[]>;
  };
  qa: {
    streamAnswer(request: CoreQaRequest): AsyncIterable<CoreQaStreamChunk>;
    abort(sessionId: string): Promise<boolean>;
  };
  team: {
    list(): Promise<Array<{ id: string; name: string }>>;
    publish(event: Omit<CoreTeamEvent, "event_id" | "timestamp">): CoreTeamEvent;
    subscribe(teamId: string, handler: (event: CoreTeamEvent) => void): () => void;
    run(request: CoreTeamRunRequest): Promise<CoreTeamRunRecord>;
    getRun(runId: string): Promise<CoreTeamRunRecord | null>;
    listRuns(sessionId: string): Promise<CoreTeamRunRecord[]>;
  };
  installedSkills: SqliteDatabase["installedSkills"];
  database: SqliteDatabase;
}

export interface CoreLogger {
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error?(message: string, extra?: Record<string, unknown>): void;
}

export interface CreateCoreOptions {
  dbPath?: string;
  workspaceRoot?: string;
  logger?: CoreLogger;
  claudeCommand?: string;
  codexCommand?: string;
  skillDirectories?: string[];
}

interface ResolvedRepositoryContext {
  workingDirectory?: string;
  additionalDirectories?: string[];
  systemPrompt?: string;
}

const DEFAULT_ADMIN_ID = "u-admin";
const DEFAULT_DB_RELATIVE_PATH = ".okk/core.db";

const DEFAULT_AGENTS: CoreAgentRecord[] = [
  {
    name: "knowledge-extractor",
    description: "提取可沉淀知识",
    backend: "claude-code"
  },
  {
    name: "code-reviewer",
    description: "执行代码审查",
    backend: "codex"
  }
];

const FALLBACK_SKILLS: CoreSkillRecord[] = [
  {
    name: "repo-stats",
    description: "统计仓库活跃度",
    version: "0.1.0"
  }
];

const noopLogger: Required<CoreLogger> = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

function pickWorkspaceRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }

    current = parent;
  }
}

function resolveDatabasePath(options: CreateCoreOptions, workspaceRoot: string): string {
  const configured = options.dbPath ?? process.env.OKK_CORE_DB_PATH;
  const trimmed = configured?.trim();
  if (trimmed) {
    return trimmed === ":memory:" ? trimmed : path.resolve(trimmed);
  }

  return path.resolve(workspaceRoot, DEFAULT_DB_RELATIVE_PATH);
}

interface BackendCommandConfig {
  command: string;
  source: "option" | "env" | "default";
  envName?: string;
}

function quoteWindowsShellArg(value: string): string {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function resolveBackendCommand(
  explicitCommand: string | undefined,
  envName: string,
  fallbackCommand: string
): BackendCommandConfig {
  const configured = explicitCommand?.trim();
  if (configured) {
    return {
      command: configured,
      source: "option"
    };
  }

  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) {
    return {
      command: fromEnv,
      source: "env",
      envName
    };
  }

  return {
    command: fallbackCommand,
    source: "default"
  };
}

function describeBackendCommandSource(config: BackendCommandConfig): string {
  if (config.source === "option") {
    return "createCore options";
  }

  if (config.source === "env") {
    return `环境变量 ${config.envName}`;
  }

  return "默认命令";
}

function probeBackendCommand(backend: BackendName, config: BackendCommandConfig): CoreBackendHealth {
  const command = config.command.trim();
  const sourceDetail = `命令来源: ${describeBackendCommandSource(config)}`;

  if (!command) {
    return {
      backend,
      command,
      available: false,
      reason: "command_missing",
      sourceType: "backend",
      runtimeStatus: "unavailable",
      diagnostics: {
        code: "command_missing",
        message: "CLI 命令未配置",
        detail: sourceDetail,
        retryable: true,
        severity: "error"
      },
      actions: [
        { kind: "refresh", label: "刷新状态" },
        { kind: "copy_diagnostic", label: "复制诊断" }
      ]
    };
  }

  try {
    const result =
      process.platform === "win32"
        ? spawnSync("cmd.exe", ["/d", "/s", "/c", `${quoteWindowsShellArg(command)} --help`], {
            stdio: "ignore",
            windowsHide: true,
            timeout: 4000
          })
        : spawnSync(command, ["--help"], {
            stdio: "ignore",
            windowsHide: true,
            timeout: 4000
          });

    if (result.error) {
      const probeError = result.error as NodeJS.ErrnoException;
      const timedOut = probeError.code === "ETIMEDOUT";
      const reason = timedOut ? "command_probe_timeout" : "command_not_found_or_not_executable";
      return {
        backend,
        command,
        available: false,
        reason,
        sourceType: "backend",
        runtimeStatus: "unavailable",
        diagnostics: {
          code: reason,
          message: timedOut ? "CLI 命令探测超时" : "CLI 命令不可用",
          detail: `${sourceDetail}；请先确认 \`${command}\` 可执行，并手动运行 \`${command} --help\` 复核环境。`,
          retryable: true,
          severity: "error"
        },
        actions: [
          { kind: "refresh", label: "刷新状态" },
          { kind: "copy_diagnostic", label: "复制诊断" }
        ]
      };
    }

    if (result.status !== 0) {
      return {
        backend,
        command,
        available: false,
        reason: "command_not_found_or_not_executable",
        sourceType: "backend",
        runtimeStatus: "unavailable",
        diagnostics: {
          code: "command_not_found_or_not_executable",
          message: "CLI 命令不可用",
          detail: `${sourceDetail}；命令退出码为 ${result.status ?? "unknown"}，请手动运行 \`${command} --help\` 复核环境。`,
          retryable: true,
          severity: "error"
        },
        actions: [
          { kind: "refresh", label: "刷新状态" },
          { kind: "copy_diagnostic", label: "复制诊断" }
        ]
      };
    }
  } catch (error) {
    return {
      backend,
      command,
      available: false,
      reason: "command_probe_failed",
      sourceType: "backend",
      runtimeStatus: "unavailable",
      diagnostics: {
        code: "command_probe_failed",
        message: "CLI 命令探测失败",
        detail: `${sourceDetail}；${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        severity: "error"
      },
      actions: [
        { kind: "refresh", label: "刷新状态" },
        { kind: "copy_diagnostic", label: "复制诊断" }
      ]
    };
  }

  return {
    backend,
    command,
    available: true,
    sourceType: "backend",
    runtimeStatus: "ready",
    diagnostics: {
      code: "backend_ready",
      message: "CLI 后端可用",
      detail: sourceDetail,
      retryable: false,
      severity: "info"
    }
  };
}

function toAuthUser(user: { id: string; username: string; role: UserRole }): CoreAuthUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

function toRepoRecord(record: Repository): CoreRepoRecord {
  return {
    id: record.id,
    name: record.name,
    path: record.path,
    createdAt: record.createdAt
  };
}

function toSessionRecord(record: Session): CoreSessionRecord {
  return {
    id: record.id,
    title: record.title,
    repoId: record.repoId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function summarizeContent(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length <= 140) {
    return trimmed;
  }

  return `${trimmed.slice(0, 137)}...`;
}

function normalizeTagList(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function normalizeCoreSkill(record: {
  name: string;
  description: string;
  content?: string;
}): CoreSkillRecord {
  const versionMatch = record.content?.match(/\nversion\s*:\s*([^\n]+)/i);
  return {
    name: record.name,
    description: record.description,
    version: versionMatch?.[1]?.trim() ?? "0.0.0"
  };
}

function toSkillId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeIdList(input: string[] | undefined): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return Array.from(
    new Set(
      input
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function joinPromptSections(sections: Array<string | undefined>): string | undefined {
  const normalized = sections
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  if (normalized.length === 0) {
    return undefined;
  }
  return normalized.join("\n\n");
}

function buildCodexPrompt(content: string, systemPrompt: string | undefined): string {
  if (!systemPrompt) {
    return content;
  }
  return [
    "## System Context",
    systemPrompt,
    "",
    "## User Request",
    content
  ].join("\n");
}

function emitCoreLog(
  logger: Required<CoreLogger>,
  entry: CliBackendLogEntry | BackendManagerLogEntry,
  source: "backend" | "backend-manager"
): void {
  const payload: Record<string, unknown> = {
    source,
    sessionId: entry.sessionId,
    message: entry.message,
    ...("backend" in entry && entry.backend ? { backend: entry.backend } : {}),
    ...(entry.data ? { data: entry.data } : {})
  };

  if (entry.level === "error") {
    logger.error(`${source}:${entry.message}`, payload);
    return;
  }

  if (entry.level === "warn") {
    logger.warn(`${source}:${entry.message}`, payload);
    return;
  }

  logger.info(`${source}:${entry.message}`, payload);
}

export async function createCore(options: CreateCoreOptions = {}): Promise<CoreApi> {
  const logger: Required<CoreLogger> = {
    ...noopLogger,
    ...options.logger,
    error: options.logger?.error ?? options.logger?.warn ?? noopLogger.error
  };

  const workspaceRoot = path.resolve(options.workspaceRoot ?? pickWorkspaceRoot(process.cwd()));
  const databasePath = resolveDatabasePath(options, workspaceRoot);
  const database = new SqliteDatabase({ dbPath: databasePath });

  if (!database.users.getById(DEFAULT_ADMIN_ID)) {
    database.users.create({
      id: DEFAULT_ADMIN_ID,
      username: "admin",
      passwordHash: "admin",
      displayName: "Admin",
      role: "admin"
    });
  }

  const defaultRepo = database.repositories.getByPath(workspaceRoot) ?? database.repositories.create({
    name: path.basename(workspaceRoot) || "默认仓库",
    path: workspaceRoot,
    defaultBackend: "codex"
  });

  const skillRegistry = new SkillRegistry();
  const candidateSkillDirectories = options.skillDirectories ?? [
    path.join(workspaceRoot, ".codex", "skills"),
    path.join(workspaceRoot, ".claude", "skills")
  ];
  for (const directory of candidateSkillDirectories) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    const warnings = await skillRegistry.loadFromDirectory(directory);
    for (const warning of warnings) {
      logger.warn("core_skill_load_warning", {
        warning,
        directory
      });
    }
  }

  const backendManager = new BackendManager({
    onLog: (entry) => emitCoreLog(logger, entry, "backend-manager")
  });
  const availableBackends = new Set<BackendName>();
  const backendHealth = new Map<BackendName, CoreBackendHealth>();

  const codexConfig = resolveBackendCommand(options.codexCommand, "OKK_CODEX_COMMAND", "codex");
  const codexHealth = probeBackendCommand("codex", codexConfig);
  if (codexHealth.available) {
    backendManager.registerBackend(
      new CodexCliBackend({
        command: codexConfig.command,
        onLog: (entry) => emitCoreLog(logger, entry, "backend")
      })
    );
    availableBackends.add("codex");
    logger.info("core_backend_enabled", {
      backend: "codex",
      command: codexConfig.command,
      source: codexConfig.source
    });
  } else {
    logger.warn("core_backend_unavailable", {
      backend: "codex",
      command: codexConfig.command,
      reason: codexHealth.reason,
      source: codexConfig.source
    });
  }
  backendHealth.set("codex", codexHealth);

  const claudeConfig = resolveBackendCommand(options.claudeCommand, "OKK_CLAUDE_COMMAND", "claude");
  const claudeHealth = probeBackendCommand("claude-code", claudeConfig);
  if (claudeHealth.available) {
    backendManager.registerBackend(
      new ClaudeCliBackend({
        command: claudeConfig.command,
        onLog: (entry) => emitCoreLog(logger, entry, "backend")
      })
    );
    availableBackends.add("claude-code");
    logger.info("core_backend_enabled", {
      backend: "claude-code",
      command: claudeConfig.command,
      source: claudeConfig.source
    });
  } else {
    logger.warn("core_backend_unavailable", {
      backend: "claude-code",
      command: claudeConfig.command,
      reason: claudeHealth.reason,
      source: claudeConfig.source
    });
  }
  backendHealth.set("claude-code", claudeHealth);

  const repositoryContextService = new RepositoryContextService(database.knowledge);
  const qaSessionToBackendSession = new Map<string, { backend: BackendName; sessionId: string }>();
  const inflightQaSessions = new Set<string>();

  const teamListeners = new Map<string, Set<(event: CoreTeamEvent) => void>>();
  const teamCounters = new Map<string, number>();

  const publishTeamEvent = (event: Omit<CoreTeamEvent, "event_id" | "timestamp">): CoreTeamEvent => {
    const eventId = (teamCounters.get(event.teamId) ?? 0) + 1;
    teamCounters.set(event.teamId, eventId);

    const wrapped: CoreTeamEvent = {
      ...event,
      event_id: eventId,
      timestamp: nowIso()
    };

    for (const handler of teamListeners.get(event.teamId) ?? []) {
      handler(wrapped);
    }

    return wrapped;
  };

  const resolveRepositoryContext = async (qaSessionId: string): Promise<ResolvedRepositoryContext> => {
    const session = database.sessions.getById(qaSessionId);
    if (!session) {
      return {
        workingDirectory: workspaceRoot,
        additionalDirectories: []
      };
    }

    const repository = database.repositories.getById(session.repoId);
    if (!repository) {
      return {
        workingDirectory: workspaceRoot,
        additionalDirectories: []
      };
    }

    try {
      const context = await repositoryContextService.buildContext({
        repositoryPath: repository.path,
        repoId: repository.id,
        knowledgeLimit: 10
      });

      return {
        workingDirectory: context.workingDirectory,
        additionalDirectories: context.additionalDirectories,
        systemPrompt: context.systemPromptAppendix || undefined
      };
    } catch (error) {
      logger.warn("core_repository_context_fallback", {
        qaSessionId,
        repositoryPath: repository.path,
        reason: error instanceof Error ? error.message : String(error)
      });
      return {
        workingDirectory: repository.path,
        additionalDirectories: []
      };
    }
  };

  const toKnowledgeRecord = (entry: {
    id: string;
    title: string;
    content: string;
    tags: string[];
    category: string;
    status: KnowledgeStatus;
    updatedAt: string;
  }): CoreKnowledgeRecord => ({
    id: entry.id,
    title: entry.title,
    content: entry.content,
    tags: entry.tags,
    category: entry.category,
    status: entry.status,
    updatedAt: entry.updatedAt
  });

  const resolveActiveBackend = (): BackendName => {
    if (availableBackends.has("codex")) {
      return "codex";
    }
    if (availableBackends.has("claude-code")) {
      return "claude-code";
    }
    return "codex";
  };

  const knownAgents = DEFAULT_AGENTS.filter((agent) => availableBackends.has(agent.backend));
  if (knownAgents.length === 0) {
    logger.warn("core_no_backend_enabled", { availableBackends: Array.from(availableBackends) });
  }

  const toAgentDefinition = (agent: CoreAgentRecord): AgentDefinition => ({
    name: agent.name,
    description: agent.description,
    allowedTools: ["Read", "Search", "Skill"],
    systemPrompt: `${agent.description}\n请基于当前仓库上下文完成任务，并明确给出可执行结论。`
  });
  const agentDefinitions = new Map<string, AgentDefinition>(
    knownAgents.map((agent) => [agent.name, toAgentDefinition(agent)])
  );
  const teamRuns = new Map<string, CoreTeamRunRecord>();
  const teamAgentRunner = new AgentRunner({
    execute: (request) => backendManager.execute(request),
    abort: (sessionId) => backendManager.abort(sessionId)
  });
  const teamManager = new TeamManager(teamAgentRunner);
  teamManager.subscribe((event) => {
    publishTeamEvent({
      teamId: event.teamId,
      type: event.type,
      payload: event.payload as unknown as Record<string, unknown>
    });
  });

  const toTeamRunRecordFromDatabase = (
    run: ReturnType<SqliteDatabase["runs"]["getTeamRunById"]>
  ): CoreTeamRunRecord | null => {
    if (!run) {
      return null;
    }
    const snapshot = teamRuns.get(run.id);
    if (snapshot) {
      return snapshot;
    }
    return {
      id: run.id,
      teamId: run.id,
      sessionId: run.sessionId,
      teamName: run.teamName,
      status: run.status,
      memberCount: run.memberCount,
      startedAt: run.createdAt,
      updatedAt: run.updatedAt,
      members: []
    };
  };

  const core: CoreApi = {
    runtime: {
      async listBackendHealth() {
        return Array.from(backendHealth.values()).sort((a, b) => a.backend.localeCompare(b.backend));
      }
    },
    auth: {
      async authenticate(username, password) {
        const user = database.users.getByUsername(username);
        if (!user || user.passwordHash !== password) {
          return null;
        }
        return toAuthUser(user);
      },
      async getUserById(userId) {
        const user = database.users.getById(userId);
        return user ? toAuthUser(user) : null;
      }
    },
    repos: {
      async list() {
        return database.repositories.list().map(toRepoRecord);
      },
      async create(input) {
        const created = database.repositories.create({
          name: input.name,
          path: path.resolve(input.path),
          defaultBackend: resolveActiveBackend()
        });
        return toRepoRecord(created);
      }
    },
    sessions: {
      async list() {
        return database.sessions.listByUserId(DEFAULT_ADMIN_ID).map(toSessionRecord);
      },
      async create(input) {
        const repository =
          database.repositories.getById(input.repoId) ??
          database.repositories.getById(defaultRepo.id) ??
          defaultRepo;

        const preferredBackend = availableBackends.has(repository.defaultBackend)
          ? repository.defaultBackend
          : resolveActiveBackend();

        const created = database.sessions.create({
          userId: DEFAULT_ADMIN_ID,
          repoId: repository.id,
          title: input.title,
          backend: preferredBackend,
          mode: "ask",
          status: "active"
        });

        return toSessionRecord(created);
      }
    },
    knowledge: {
      async list() {
        return database.knowledge.listByRepo().map(toKnowledgeRecord);
      },
      async create(input) {
        const targetRepo =
          database.repositories.list()[0] ??
          database.repositories.getById(defaultRepo.id) ??
          defaultRepo;

        const created = database.knowledge.create({
          title: input.title,
          content: input.content,
          summary: summarizeContent(input.content),
          repoId: targetRepo.id,
          category: input.category,
          sourceSessionId: null,
          status: input.status,
          tags: normalizeTagList(input.tags),
          createdBy: DEFAULT_ADMIN_ID,
          metadata: { source: "web-backend" }
        });

        return toKnowledgeRecord(created);
      }
    },
    agents: {
      async list() {
        return knownAgents;
      }
    },
    skills: {
      async list() {
        const discovered = skillRegistry.getAll().map((skill) => normalizeCoreSkill(skill));
        return discovered.length > 0 ? discovered : FALLBACK_SKILLS;
      }
    },
    qa: {
      async *streamAnswer(request) {
        if (!availableBackends.has(request.backend)) {
          throw new Error(
            `backend ${request.backend} 不可用，可用 backend: ${Array.from(availableBackends).join(", ") || "无"}`
          );
        }

        const context = await resolveRepositoryContext(request.sessionId);
        const requestedSkillIds = normalizeIdList(request.skillIds);
        const requestedMcpServerIds = normalizeIdList(request.mcpServerIds);
        const installedSkillNames = new Set(
          database.installedSkills
            .list()
            .map((item) => item.name)
            .filter(Boolean)
        );
        const discoveredSkills = skillRegistry.getAll();
        const skillById = new Map(discoveredSkills.map((item) => [toSkillId(item.name), item]));
        const resolvedSkills = requestedSkillIds
          .map((skillId) => {
            const byId = skillById.get(skillId);
            if (byId) {
              return byId;
            }
            return discoveredSkills.find((item) => item.name === skillId) ?? null;
          })
          .filter((item): item is (typeof discoveredSkills)[number] => Boolean(item))
          .filter((item) => installedSkillNames.has(item.name));
        const ignoredSkillIds = requestedSkillIds.filter(
          (skillId) => !resolvedSkills.some((item) => toSkillId(item.name) === skillId || item.name === skillId)
        );
        const skillPrompt = resolvedSkills.length
          ? [
              "## Enabled Skills",
              ...resolvedSkills.map((item) => `### ${item.name}\n${item.content}`)
            ].join("\n\n")
          : undefined;
        const mcpPrompt = requestedMcpServerIds.length
          ? `## Enabled MCP Servers\n${requestedMcpServerIds.map((item) => `- ${item}`).join("\n")}`
          : undefined;
        const effectiveSystemPrompt = joinPromptSections([context.systemPrompt, skillPrompt, mcpPrompt]);
        const storedBackendSession = qaSessionToBackendSession.get(request.sessionId);
        const storedBackendSessionId =
          storedBackendSession && storedBackendSession.backend === request.backend
            ? storedBackendSession.sessionId
            : undefined;
        const managerSessionId = storedBackendSessionId ?? request.sessionId;
        const effectivePrompt = request.backend === "codex"
          ? buildCodexPrompt(request.content, effectiveSystemPrompt)
          : request.content;

        const persistedSession = database.sessions.getById(request.sessionId);
        if (persistedSession) {
          database.messages.create({
            sessionId: request.sessionId,
            role: "user",
            content: request.content,
            clientMessageId: request.clientMessageId,
            metadata: {
              backend: request.backend,
              agentName: request.agentName,
              action: request.action,
              skillIds: requestedSkillIds,
              ignoredSkillIds,
              mcpServerIds: requestedMcpServerIds
            }
          });
        }

        inflightQaSessions.add(request.sessionId);
        let assistantContent = "";
        let chunkCount = 0;

        try {
          const eventStream = backendManager.execute({
            backend: request.backend,
            prompt: effectivePrompt,
            sessionId: managerSessionId,
            workingDirectory: context.workingDirectory,
            additionalDirectories: context.additionalDirectories,
            systemPrompt: effectiveSystemPrompt,
            clientMessageId: request.clientMessageId,
            metadata: {
              backendSessionId: storedBackendSessionId,
              qaSessionId: request.sessionId,
              action: request.action,
              agentName: request.agentName,
              skillIds: requestedSkillIds,
              resolvedSkillNames: resolvedSkills.map((item) => item.name),
              mcpServerIds: requestedMcpServerIds
            }
          });

          for await (const event of eventStream) {
            if (event.type === "session_update") {
              qaSessionToBackendSession.set(request.sessionId, {
                backend: request.backend,
                sessionId: event.payload.sessionId
              });
              if (persistedSession) {
                database.sessions.updateBackendSessionId(persistedSession.id, event.payload.sessionId);
              }
              continue;
            }

            if (event.type === "text_delta") {
              assistantContent += event.payload.content;
              chunkCount += 1;
              yield { content: event.payload.content };
              continue;
            }

            if (event.type === "error") {
              logger.error("core_qa_backend_error", {
                qaSessionId: request.sessionId,
                backend: request.backend,
                payload: event.payload
              });
              throw new Error(event.payload.message);
            }
          }

          if (chunkCount === 0) {
            const fallbackText = `[${request.backend}/${request.agentName}] 已完成`;
            assistantContent += fallbackText;
            yield { content: fallbackText };
          }

          if (persistedSession) {
            database.messages.create({
              sessionId: persistedSession.id,
              role: "assistant",
              content: assistantContent,
              clientMessageId: null,
              metadata: {
                backend: request.backend,
                qaSessionId: request.sessionId,
                backendSessionId: qaSessionToBackendSession.get(request.sessionId)?.sessionId ?? null,
                skillIds: requestedSkillIds,
                resolvedSkillNames: resolvedSkills.map((item) => item.name),
                mcpServerIds: requestedMcpServerIds
              }
            });
          }
        } finally {
          inflightQaSessions.delete(request.sessionId);
        }
      },
      async abort(sessionId) {
        const mappedBackendSession = qaSessionToBackendSession.get(sessionId)?.sessionId;
        const wasActive =
          inflightQaSessions.has(sessionId) ||
          backendManager.isSessionActive(sessionId) ||
          (mappedBackendSession ? backendManager.isSessionActive(mappedBackendSession) : false);

        if (mappedBackendSession) {
          backendManager.abort(mappedBackendSession);
        }
        backendManager.abort(sessionId);
        return wasActive;
      }
    },
    team: {
      async list() {
        return [
          { id: "team-default", name: "默认团队" },
          { id: "team-review", name: "审查团队" }
        ];
      },
      publish: publishTeamEvent,
      subscribe(teamId, handler) {
        const handlers = teamListeners.get(teamId) ?? new Set();
        handlers.add(handler);
        teamListeners.set(teamId, handlers);

        return () => {
          const current = teamListeners.get(teamId);
          if (!current) {
            return;
          }

          current.delete(handler);
          if (current.size === 0) {
            teamListeners.delete(teamId);
          }
        };
      },
      async run(request) {
        const sessionId = request.sessionId?.trim();
        if (!sessionId) {
          throw new Error("sessionId 必填");
        }
        const session = database.sessions.getById(sessionId);
        if (!session) {
          throw new Error(`session ${sessionId} 不存在`);
        }
        if (!Array.isArray(request.members) || request.members.length === 0) {
          throw new Error("members 至少包含一个成员");
        }

        const runId = generateId();
        const startedAt = nowIso();
        database.runs.createTeamRun({
          id: runId,
          sessionId,
          teamName: request.teamName,
          status: "running",
          memberCount: request.members.length
        });

        const runningRecord: CoreTeamRunRecord = {
          id: runId,
          teamId: request.teamId ?? runId,
          sessionId,
          teamName: request.teamName,
          status: "running",
          memberCount: request.members.length,
          startedAt,
          updatedAt: startedAt,
          members: []
        };
        teamRuns.set(runId, runningRecord);

        void (async () => {
          try {
            const repositoryContext = await resolveRepositoryContext(sessionId);
            const members: TeamMemberInput[] = request.members.map((member, index) => {
              const matchedAgent =
                knownAgents.find(
                  (item) =>
                    item.name === member.agentName &&
                    (!member.backend || item.backend === member.backend)
                ) ?? knownAgents.find((item) => item.name === member.agentName);
              if (!matchedAgent) {
                throw new Error(`agent ${member.agentName} 不存在或不可用`);
              }

              const resolvedBackend = member.backend ?? matchedAgent.backend;
              if (!availableBackends.has(resolvedBackend)) {
                throw new Error(`backend ${resolvedBackend} 不可用`);
              }

              const agentDefinition = agentDefinitions.get(matchedAgent.name);
              if (!agentDefinition) {
                throw new Error(`agent ${matchedAgent.name} 定义缺失`);
              }

              const prompt = member.prompt?.trim();
              if (!prompt) {
                throw new Error(`成员 ${member.agentName} 的 prompt 不能为空`);
              }

              return {
                memberId: member.memberId?.trim() || undefined,
                backend: resolvedBackend,
                agent: agentDefinition,
                prompt,
                taskTitle: member.taskTitle?.trim() || `任务 ${index + 1}`,
                dependsOn: Array.isArray(member.dependsOn)
                  ? Array.from(
                      new Set(
                        member.dependsOn
                          .map((item) => item.trim())
                          .filter(Boolean)
                      )
                    )
                  : []
              };
            });

            const result = await teamManager.run({
              teamId: runningRecord.teamId,
              teamName: request.teamName,
              sessionId,
              workingDirectory: repositoryContext.workingDirectory,
              additionalDirectories: repositoryContext.additionalDirectories,
              members
            });

            const finishedAt = nowIso();
            const finishedRecord: CoreTeamRunRecord = {
              ...runningRecord,
              status: result.status,
              updatedAt: finishedAt,
              endedAt: finishedAt,
              summary: `${result.members.filter((item) => item.status === "done").length}/${
                result.members.length
              } 成员完成`,
              members: result.members.map((item) => ({
                memberId: item.memberId,
                agentName: item.agentName,
                backend: item.backend,
                status: item.status,
                startedAt: item.startedAt,
                updatedAt: item.updatedAt,
                ...(item.result ? { output: item.result.output } : {}),
                ...(item.error ? { error: item.error } : {})
              }))
            };
            teamRuns.set(runId, finishedRecord);
            database.runs.updateTeamRun(runId, {
              status: result.status,
              memberCount: result.members.length
            });
          } catch (error) {
            const finishedAt = nowIso();
            const failedRecord: CoreTeamRunRecord = {
              ...runningRecord,
              status: "error",
              updatedAt: finishedAt,
              endedAt: finishedAt,
              summary: error instanceof Error ? error.message : String(error)
            };
            teamRuns.set(runId, failedRecord);
            database.runs.updateTeamRun(runId, {
              status: "error"
            });
            logger.error("core_team_run_failed", {
              runId,
              sessionId,
              reason: failedRecord.summary
            });
          }
        })();

        return runningRecord;
      },
      async getRun(runId) {
        return toTeamRunRecordFromDatabase(database.runs.getTeamRunById(runId));
      },
      async listRuns(sessionId) {
        return database.runs
          .listTeamRunsBySession(sessionId)
          .map((item) => toTeamRunRecordFromDatabase(item))
          .filter((item): item is CoreTeamRunRecord => Boolean(item));
      }
    },
    installedSkills: database.installedSkills,
    database
  };

  logger.info("core_initialized", {
    workspaceRoot,
    databasePath,
    availableBackends: Array.from(availableBackends),
    initializedAt: nowIso()
  });

  return core;
}

export const createOkkCore = createCore;














