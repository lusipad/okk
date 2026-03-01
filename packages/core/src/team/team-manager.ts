import type {
  AgentDefinition,
  AgentResult,
  AgentRunnerRequest,
  BackendName,
  TeamEvent
} from "../types.js";
import { nowIso, generateId } from "../utils/id.js";
import { TeamEventBus } from "./team-event-bus.js";

export interface TeamMemberInput {
  memberId?: string;
  backend: BackendName;
  agent: AgentDefinition;
  prompt: string;
  taskTitle: string;
  dependsOn?: string[];
}

export interface TeamRunRequest {
  teamId?: string;
  teamName: string;
  sessionId?: string;
  workingDirectory?: string;
  additionalDirectories?: string[];
  members: TeamMemberInput[];
}

export interface TeamMemberResult {
  memberId: string;
  agentName: string;
  backend: BackendName;
  status: "done" | "error";
  startedAt: string;
  updatedAt: string;
  result?: AgentResult;
  error?: string;
}

export interface TeamRunResult {
  teamId: string;
  teamName: string;
  status: "done" | "error";
  startedAt: string;
  endedAt: string;
  members: TeamMemberResult[];
}

export interface TeamAgentExecutor {
  run(request: AgentRunnerRequest): Promise<AgentResult>;
}

const DEFAULT_MEMBER_PREFIX = "member";

const ensureMemberId = (input: TeamMemberInput, index: number): string => {
  const candidate = input.memberId?.trim();
  if (candidate) {
    return candidate;
  }
  return `${DEFAULT_MEMBER_PREFIX}-${index + 1}`;
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class TeamManager {
  constructor(
    private readonly executor: TeamAgentExecutor,
    private readonly eventBus: TeamEventBus = new TeamEventBus()
  ) {}

  get events(): TeamEventBus {
    return this.eventBus;
  }

  subscribe(handler: (event: TeamEvent) => void): () => void {
    return this.eventBus.on(handler);
  }

  async run(request: TeamRunRequest): Promise<TeamRunResult> {
    const teamId = request.teamId?.trim() || generateId();
    const startedAt = nowIso();

    this.eventBus.emit(teamId, "team_start", {
      team_name: request.teamName,
      member_count: request.members.length
    });

    request.members.forEach((member, index) => {
      const memberId = ensureMemberId(member, index);
      const timestamp = nowIso();

      this.eventBus.emit(teamId, "team_member_add", {
        member_id: memberId,
        agent_name: member.agent.name,
        status: "pending",
        current_task: member.taskTitle,
        backend: member.backend,
        updated_at: timestamp
      });

      this.eventBus.emit(teamId, "team_task_update", {
        task_id: `${teamId}:${memberId}`,
        title: member.taskTitle,
        status: "pending",
        depends_on: member.dependsOn ?? [],
        owner_member_id: memberId
      });
    });

    const memberResults = await Promise.all(
      request.members.map((member, index) => this.runMember(teamId, member, index, request))
    );

    const status = memberResults.every((item) => item.status === "done") ? "done" : "error";
    const endedAt = nowIso();
    const summary = `${memberResults.filter((item) => item.status === "done").length}/${
      memberResults.length
    } members done`;

    this.eventBus.emit(teamId, "team_end", {
      status,
      summary
    });

    return {
      teamId,
      teamName: request.teamName,
      status,
      startedAt,
      endedAt,
      members: memberResults
    };
  }

  private async runMember(
    teamId: string,
    member: TeamMemberInput,
    index: number,
    request: TeamRunRequest
  ): Promise<TeamMemberResult> {
    const memberId = ensureMemberId(member, index);
    const startedAt = nowIso();

    this.eventBus.emit(teamId, "team_member_update", {
      member_id: memberId,
      agent_name: member.agent.name,
      status: "running",
      current_task: member.taskTitle,
      backend: member.backend,
      started_at: startedAt,
      updated_at: startedAt
    });

    this.eventBus.emit(teamId, "team_task_update", {
      task_id: `${teamId}:${memberId}`,
      title: member.taskTitle,
      status: "running",
      depends_on: member.dependsOn ?? [],
      owner_member_id: memberId
    });

    this.eventBus.emit(teamId, "team_message", {
      message_id: generateId(),
      member_id: memberId,
      content: `开始执行：${member.taskTitle}`,
      created_at: startedAt
    });

    try {
      const result = await this.executor.run({
        backend: member.backend,
        agent: member.agent,
        prompt: member.prompt,
        sessionId: request.sessionId,
        workingDirectory: request.workingDirectory,
        additionalDirectories: request.additionalDirectories,
        metadata: {
          teamId,
          memberId,
          taskTitle: member.taskTitle
        }
      });

      const finalStatus: TeamMemberResult["status"] = result.success ? "done" : "error";
      const updatedAt = nowIso();

      this.eventBus.emit(teamId, "team_member_update", {
        member_id: memberId,
        agent_name: member.agent.name,
        status: finalStatus,
        current_task: member.taskTitle,
        backend: member.backend,
        started_at: startedAt,
        updated_at: updatedAt
      });

      this.eventBus.emit(teamId, "team_task_update", {
        task_id: `${teamId}:${memberId}`,
        title: member.taskTitle,
        status: finalStatus,
        depends_on: member.dependsOn ?? [],
        owner_member_id: memberId
      });

      this.eventBus.emit(teamId, "team_message", {
        message_id: generateId(),
        member_id: memberId,
        content: result.success ? "执行完成" : `执行失败：${result.error ?? "unknown"}`,
        created_at: updatedAt
      });

      return {
        memberId,
        agentName: member.agent.name,
        backend: member.backend,
        status: finalStatus,
        startedAt,
        updatedAt,
        result,
        ...(result.success ? {} : { error: result.error ?? "unknown_error" })
      };
    } catch (error) {
      const updatedAt = nowIso();
      const message = toErrorMessage(error);

      this.eventBus.emit(teamId, "team_member_update", {
        member_id: memberId,
        agent_name: member.agent.name,
        status: "error",
        current_task: member.taskTitle,
        backend: member.backend,
        started_at: startedAt,
        updated_at: updatedAt
      });

      this.eventBus.emit(teamId, "team_task_update", {
        task_id: `${teamId}:${memberId}`,
        title: member.taskTitle,
        status: "error",
        depends_on: member.dependsOn ?? [],
        owner_member_id: memberId
      });

      this.eventBus.emit(teamId, "team_message", {
        message_id: generateId(),
        member_id: memberId,
        content: `执行失败：${message}`,
        created_at: updatedAt
      });

      return {
        memberId,
        agentName: member.agent.name,
        backend: member.backend,
        status: "error",
        startedAt,
        updatedAt,
        error: message
      };
    }
  }
}

