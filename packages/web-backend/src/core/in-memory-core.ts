import { randomUUID } from "node:crypto";
import type {
  AgentRecord,
  KnowledgeReferencePayload,
  KnowledgeRecord,
  MissionCheckpointRecord,
  MissionHandoffRecord,
  MissionRecord,
  MissionSummaryRecord,
  MissionWorkstreamRecord,
  OkkCore,
  QaRequest,
  RepoActivityRecord,
  RepoContextRecord,
  RepoContinueRecord,
  RepoRecord,
  SessionRecord,
  MemoryEntry,
  PartnerSummaryRecord,
  SkillRecord,
  TeamRunRecord,
  TeamRunRequest,
} from "./types.js";
import type { TeamEvent } from "../types/contracts.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createInMemoryCore(): OkkCore {
  const now = () => new Date().toISOString();

  const users = [{ id: "u-admin", username: "admin", role: "admin" as const, password: "admin" }];
  const repos: RepoRecord[] = [];
  const sessions: SessionRecord[] = [];
  const knowledge: KnowledgeRecord[] = [];
  const memories: MemoryEntry[] = [];
  const repoContexts = new Map<string, RepoContextRecord>();
  const agents: AgentRecord[] = [
    {
      name: "knowledge-extractor",
      description: "提取可沉淀知识",
      backend: "claude-code",
    },
    {
      name: "code-reviewer",
      description: "执行代码审查",
      backend: "codex",
    },
  ];
  const skills: SkillRecord[] = [
    {
      name: "repo-stats",
      description: "统计仓库活跃度",
      version: "0.1.0",
    },
  ];

  const listeners = new Map<string, Set<(event: TeamEvent) => void>>();
  const teamCounters = new Map<string, number>();
  const sessionAbortFlags = new Map<string, { aborted: boolean }>();
  const teamRuns = new Map<string, TeamRunRecord>();
  const missions: MissionRecord[] = [];
  const missionWorkstreams = new Map<string, MissionWorkstreamRecord[]>();
  const missionCheckpoints = new Map<string, MissionCheckpointRecord[]>();
  const missionHandoffs = new Map<string, MissionHandoffRecord[]>();

  const nextTeamEventId = (teamId: string) => {
    const current = teamCounters.get(teamId) ?? 0;
    const next = current + 1;
    teamCounters.set(teamId, next);
    return next;
  };

  const publishTeamEvent = (event: Omit<TeamEvent, "event_id" | "timestamp">): TeamEvent => {
    const wrapped: TeamEvent = {
      ...event,
      event_id: nextTeamEventId(event.teamId),
      timestamp: now(),
    };

    for (const handler of listeners.get(event.teamId) ?? []) {
      handler(wrapped);
    }

    return wrapped;
  };

  const getDefaultRepoContext = (repoId: string, repoName: string): RepoContextRecord => ({
    repoId,
    repoName,
    snapshot: {
      preferredSkillIds: [],
      preferredMcpServerIds: [],
    },
    recentActivities: [],
  });

  async function* streamAnswer(request: QaRequest) {
    const flag = { aborted: false };
    sessionAbortFlags.set(request.sessionId, flag);
    const knowledgeReferences: KnowledgeReferencePayload[] = [
      {
        id: "knowledge-memory-1",
        title: "测试知识引用",
        summary: "内存模式下的知识引用样例",
        category: "guide",
        updatedAt: now(),
        injectionKind: "related"
      }
    ];

    const text = `[${request.backend}/${request.agentName}] ${request.content}`;
    const midpoint = Math.max(1, Math.floor(text.length / 2));
    const chunks = [text.slice(0, midpoint), text.slice(midpoint)];

    yield {
      content: "",
      knowledgeReferences
    };

    for (const chunk of chunks) {
      await delay(20);
      if (flag.aborted) {
        return;
      }
      yield { content: chunk };
    }

    sessionAbortFlags.delete(request.sessionId);
  }

  return {
    runtime: {
      async listBackendHealth() {
        return [
          {
            backend: "codex",
            command: "codex",
            available: true,
          },
          {
            backend: "claude-code",
            command: "claude",
            available: true,
          },
        ];
      },
    },
    auth: {
      async authenticate(username, password) {
        const found = users.find((user) => user.username === username && user.password === password);
        if (!found) {
          return null;
        }

        return {
          id: found.id,
          username: found.username,
          role: found.role,
        };
      },
      async getUserById(userId) {
        const found = users.find((user) => user.id === userId);
        if (!found) {
          return null;
        }

        return {
          id: found.id,
          username: found.username,
          role: found.role,
        };
      },
    },
    repos: {
      async list() {
        return repos;
      },
      async create(input) {
        const record: RepoRecord = {
          id: randomUUID(),
          name: input.name,
          path: input.path,
          createdAt: now(),
        };
        repos.push(record);
        repoContexts.set(record.id, {
          repoId: record.id,
          repoName: record.name,
          snapshot: { preferredSkillIds: [], preferredMcpServerIds: [] },
          recentActivities: []
        });
        return record;
      },
      async getContext(repoId) {
        const repoName = repos.find((item) => item.id === repoId)?.name ?? "默认仓库";
        const current = repoContexts.get(repoId) ?? {
          repoId,
          repoName,
          snapshot: { preferredSkillIds: [], preferredMcpServerIds: [] },
          recentActivities: []
        };
        repoContexts.set(repoId, current);
        return current;
      },
      async updateContext(repoId, input) {
        const current = await this.getContext(repoId);
        const next = {
          ...current,
          snapshot: {
            ...current.snapshot,
            ...input,
            preferredSkillIds: input.preferredSkillIds ?? current.snapshot.preferredSkillIds,
            preferredMcpServerIds: input.preferredMcpServerIds ?? current.snapshot.preferredMcpServerIds,
            lastUpdatedAt: now(),
          },
          recentActivities: [
            {
              id: randomUUID(),
              repoId,
              activityType: "context_update",
              summary: "更新了项目上下文偏好",
              payload: input as Record<string, unknown>,
              createdAt: now(),
            },
            ...current.recentActivities,
          ].slice(0, 5),
        };
        repoContexts.set(repoId, next);
        return next;
      },
      async continue(repoId) {
        const current = await this.getContext(repoId);
        return {
          repoId,
          repoName: current.repoName,
          prompt: current.snapshot.continuePrompt ?? `请继续上次工作：${current.snapshot.lastActivitySummary ?? "继续当前仓库任务"}` ,
          summary: current.snapshot.lastActivitySummary ?? current.recentActivities[0]?.summary ?? "继续上次工作",
          snapshot: current.snapshot,
          recentActivities: current.recentActivities,
        };
      },
    },
    sessions: {
      async list(input) {
        const archived = input?.archived === true;
        return sessions.filter((item) => archived ? Boolean(item.archivedAt) : !item.archivedAt);
      },
      async create(input) {
        const timestamp = now();
        const record: SessionRecord = {
          id: randomUUID(),
          title: input.title,
          repoId: input.repoId,
          summary: "",
          tags: [],
          archivedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        sessions.push(record);
        return record;
      },
      async archive(sessionId) {
        const index = sessions.findIndex((item) => item.id === sessionId);
        if (index < 0) {
          return null;
        }
        sessions[index] = { ...sessions[index], archivedAt: now(), updatedAt: now() };
        return sessions[index];
      },
      async restore(sessionId) {
        const index = sessions.findIndex((item) => item.id === sessionId);
        if (index < 0) {
          return null;
        }
        sessions[index] = { ...sessions[index], archivedAt: null, updatedAt: now() };
        return sessions[index];
      },
      async listReferences() {
        return [];
      },
    },
    missions: {
      async list(input) {
        return missions.filter((item) => {
          if (input?.status && item.status !== input.status) return false;
          if (input?.repoId && item.repoId !== input.repoId) return false;
          if (input?.sessionId && item.sessionId !== input.sessionId) return false;
          return true;
        });
      },
      async listSummaries(input) {
        const items = await this.list(input);
        return items.map<MissionSummaryRecord>((item) => {
          const workstreams = missionWorkstreams.get(item.id) ?? [];
          const checkpoints = missionCheckpoints.get(item.id) ?? [];
          return {
            id: item.id,
            title: item.title,
            goal: item.goal,
            status: item.status,
            phase: item.phase,
            repoId: item.repoId,
            sessionId: item.sessionId,
            ownerPartnerId: item.ownerPartnerId,
            partnerCount: new Set(workstreams.map((entry) => entry.assigneePartnerId)).size,
            workstreamTotal: workstreams.length,
            workstreamCompleted: workstreams.filter((entry) => entry.status === 'completed').length,
            blockedCount: workstreams.filter((entry) => entry.status === 'blocked' || entry.status === 'failed').length,
            openCheckpointCount: checkpoints.filter((entry) => entry.status === 'open' && entry.requiresUserAction).length,
            updatedAt: item.updatedAt
          };
        });
      },
      async create(input) {
        const timestamp = now();
        const mission: MissionRecord = {
          id: randomUUID(),
          sessionId: input.sessionId ?? null,
          workspaceId: input.workspaceId ?? null,
          repoId: input.repoId ?? null,
          title: input.title,
          goal: input.goal,
          summary: input.goal,
          status: 'active',
          phase: 'align',
          ownerPartnerId: input.ownerPartnerId ?? null,
          createdByUserId: 'u-admin',
          createdAt: timestamp,
          updatedAt: timestamp
        };
        missions.unshift(mission);
        return mission;
      },
      async get(missionId) {
        return missions.find((item) => item.id === missionId) ?? null;
      },
      async listWorkstreams(missionId) {
        return missionWorkstreams.get(missionId) ?? [];
      },
      async listCheckpoints(missionId) {
        return missionCheckpoints.get(missionId) ?? [];
      },
      async resolveCheckpoint(checkpointId) {
        for (const [missionId, items] of missionCheckpoints.entries()) {
          const index = items.findIndex((item) => item.id === checkpointId);
          if (index >= 0) {
            items[index] = { ...items[index], status: 'resolved', resolvedAt: now(), updatedAt: now() };
            missionCheckpoints.set(missionId, items);
            return items[index];
          }
        }
        return null;
      },
      async listHandoffs(missionId) {
        return missionHandoffs.get(missionId) ?? [];
      }
    },
    knowledge: {
      async list() {
        return knowledge;
      },
      async create(input) {
        const record: KnowledgeRecord = {
          ...input,
          id: randomUUID(),
          updatedAt: now(),
        };
        knowledge.push(record);
        return record;
      },
    },
    memory: {
      async list(input) {
        return memories.filter((item) => {
          if (input?.repoId !== undefined && item.repoId !== input.repoId) {
            return false;
          }
          if (input?.memoryType && item.memoryType !== input.memoryType) {
            return false;
          }
          if (input?.status && item.status !== input.status) {
            return false;
          }
          return true;
        });
      },
      async upsert(input) {
        const existingIndex = memories.findIndex((item) => item.userId === input.userId && item.repoId === (input.repoId ?? null) && item.memoryType === input.memoryType && item.title === input.title);
        if (existingIndex >= 0) {
          memories[existingIndex] = { ...memories[existingIndex], ...input, updatedAt: now() };
          return memories[existingIndex];
        }
        const record = { ...input, id: randomUUID(), createdAt: now(), updatedAt: now() };
        memories.unshift(record);
        return record;
      },
      async update(memoryId, input) {
        const index = memories.findIndex((item) => item.id === memoryId);
        if (index < 0) {
          return null;
        }
        memories[index] = { ...memories[index], ...input, updatedAt: now() };
        return memories[index];
      },
      async syncRepo(repoId) {
        const existing = memories.find((item) => item.repoId === repoId && item.sourceKind === 'manual');
        if (!existing) {
          memories.unshift({
            id: randomUUID(),
            userId: 'u-admin',
            repoId,
            memoryType: 'project',
            title: 'repo-sync',
            content: 'memory sync seed',
            summary: '已同步仓库上下文',
            confidence: 0.5,
            status: 'active',
            sourceKind: 'manual',
            sourceRef: null,
            metadata: {},
            createdAt: now(),
            updatedAt: now(),
          });
          return { imported: 1 };
        }
        return { imported: 0 };
      },
    },
    partner: {
      async getSummary(): Promise<PartnerSummaryRecord> {
        return {
          identity: null,
          memoryCount: memories.length,
          recentMemories: memories.slice(0, 3).map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
            memoryType: item.memoryType,
          })),
          activeRepoName: repos[0]?.name ?? null,
        };
      },
    },
    agents: {
      async list() {
        return agents;
      },
    },
    skills: {
      async list() {
        return skills;
      },
    },
    qa: {
      streamAnswer,
      async abort(sessionId) {
        const flag = sessionAbortFlags.get(sessionId);
        if (!flag) {
          return false;
        }
        flag.aborted = true;
        sessionAbortFlags.delete(sessionId);
        return true;
      },
    },
    team: {
      async list() {
        return [
          { id: "team-default", name: "默认团队" },
          { id: "team-review", name: "审查团队" },
        ];
      },
      publish: publishTeamEvent,
      subscribe(teamId, handler) {
        const set = listeners.get(teamId) ?? new Set();
        set.add(handler);
        listeners.set(teamId, set);

        return () => {
          const handlers = listeners.get(teamId);
          if (!handlers) {
            return;
          }
          handlers.delete(handler);
          if (handlers.size === 0) {
            listeners.delete(teamId);
          }
        };
      },
      async run(request: TeamRunRequest) {
        const runId = randomUUID();
        const teamId = request.teamId ?? runId;
        const startedAt = now();
        const running: TeamRunRecord = {
          id: runId,
          teamId,
          sessionId: request.sessionId,
          teamName: request.teamName,
          status: "running",
          memberCount: request.members.length,
          startedAt,
          updatedAt: startedAt,
          members: [],
        };
        teamRuns.set(runId, running);

        void (async () => {
          await delay(60);
          const finishedAt = now();
          teamRuns.set(runId, {
            ...running,
            status: "done",
            updatedAt: finishedAt,
            endedAt: finishedAt,
            summary: `${request.members.length}/${request.members.length} 成员完成`,
            members: request.members.map((member, index) => ({
              memberId: member.memberId ?? `member-${index + 1}`,
              agentName: member.agentName,
              backend: member.backend ?? "codex",
              status: "done",
              startedAt,
              updatedAt: finishedAt,
              output: `[mock] ${member.taskTitle}`,
            })),
          });
        })();

        return running;
      },
      async getRun(runId: string) {
        return teamRuns.get(runId) ?? null;
      },
      async listRuns(sessionId: string) {
        return Array.from(teamRuns.values()).filter((item) => item.sessionId === sessionId);
      },
    },
  };
}

