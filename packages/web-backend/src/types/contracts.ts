export type QaActionType = "ask" | "follow_up" | "abort" | "resume";

export interface QaClientBaseMessage {
  action: QaActionType;
  backend: string;
  agent_name: string;
  client_message_id: string;
}

export interface QaAskMessage extends QaClientBaseMessage {
  action: "ask" | "follow_up";
  content: string;
  skill_ids?: string[];
  mcp_server_ids?: string[];
}

export interface QaAbortMessage extends QaClientBaseMessage {
  action: "abort";
}

export interface QaResumeMessage extends QaClientBaseMessage {
  action: "resume";
  last_event_id?: number;
}

export type QaClientMessage = QaAskMessage | QaAbortMessage | QaResumeMessage;

export interface BackendEventEnvelope<TPayload = Record<string, unknown>> {
  type: string;
  sessionId: string;
  event_id: number;
  timestamp: string;
  payload: TPayload;
}

export type StandardTeamEventType =
  | "team_start"
  | "team_member_add"
  | "team_member_update"
  | "team_task_update"
  | "team_message"
  | "team_end";

export type TeamEventType = StandardTeamEventType | (string & {});

export interface TeamMemberPayload {
  member_id: string;
  agent_name: string;
  status: "pending" | "running" | "done" | "error";
  current_task?: string;
  backend: string;
  started_at?: string;
  updated_at: string;
}

export interface TeamTaskPayload {
  task_id: string;
  title: string;
  status: "pending" | "running" | "done" | "error";
  depends_on: string[];
  owner_member_id?: string;
}

export interface TeamMessagePayload {
  message_id: string;
  member_id: string;
  content: string;
  created_at: string;
}

export interface TeamEventPayloadMap {
  team_start: { team_name: string; member_count: number };
  team_member_add: TeamMemberPayload;
  team_member_update: TeamMemberPayload;
  team_task_update: TeamTaskPayload;
  team_message: TeamMessagePayload;
  team_end: { status: "done" | "error"; summary?: string };
}

export interface TeamEvent<TType extends TeamEventType = TeamEventType> {
  type: TType;
  teamId: string;
  event_id: number;
  timestamp: string;
  payload: TType extends keyof TeamEventPayloadMap
    ? TeamEventPayloadMap[TType]
    : Record<string, unknown>;
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}

function normalizeStringArray(input: unknown): string[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw new Error("字段必须为字符串数组");
  }

  const result = Array.from(
    new Set(
      input
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    )
  );

  return result;
}

export function parseQaClientMessage(raw: string): QaClientMessage {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("消息必须是合法 JSON");
  }

  if (!isObject(parsed)) {
    throw new Error("消息必须是对象");
  }

  const { action, backend, agent_name, client_message_id } = parsed;

  if (action !== "ask" && action !== "follow_up" && action !== "abort" && action !== "resume") {
    throw new Error("action 必须是 ask/follow_up/abort/resume");
  }

  if (!isNonEmptyString(backend)) {
    throw new Error("backend 必填");
  }

  if (!isNonEmptyString(agent_name)) {
    throw new Error("agent_name 必填");
  }

  if (!isNonEmptyString(client_message_id)) {
    throw new Error("client_message_id 必填");
  }

  if (action === "ask" || action === "follow_up") {
    if (!isNonEmptyString(parsed.content)) {
      throw new Error("ask/follow_up 必须包含 content");
    }

    const skillIds = normalizeStringArray(parsed.skill_ids);
    const mcpServerIds = normalizeStringArray(parsed.mcp_server_ids);

    return {
      action,
      backend,
      agent_name,
      client_message_id,
      content: parsed.content,
      ...(skillIds ? { skill_ids: skillIds } : {}),
      ...(mcpServerIds ? { mcp_server_ids: mcpServerIds } : {}),
    };
  }

  if (action === "resume") {
    const lastEventId = parsed.last_event_id;
    if (lastEventId !== undefined) {
      if (typeof lastEventId !== "number" || !Number.isInteger(lastEventId) || lastEventId < 0) {
        throw new Error("last_event_id 必须是 >= 0 的整数");
      }
    }

    return {
      action,
      backend,
      agent_name,
      client_message_id,
      last_event_id: lastEventId,
    };
  }

  return {
    action: "abort",
    backend,
    agent_name,
    client_message_id,
  };
}
