import { randomUUID } from "node:crypto";
import type {
  AgentRecord,
  KnowledgeRecord,
  OkkCore,
  QaRequest,
  RepoRecord,
  SessionRecord,
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

  async function* streamAnswer(request: QaRequest) {
    const flag = { aborted: false };
    sessionAbortFlags.set(request.sessionId, flag);

    const text = `[${request.backend}/${request.agentName}] ${request.content}`;
    const midpoint = Math.max(1, Math.floor(text.length / 2));
    const chunks = [text.slice(0, midpoint), text.slice(midpoint)];

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
        return record;
      },
    },
    sessions: {
      async list() {
        return sessions;
      },
      async create(input) {
        const timestamp = now();
        const record: SessionRecord = {
          id: randomUUID(),
          title: input.title,
          repoId: input.repoId,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        sessions.push(record);
        return record;
      },
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
