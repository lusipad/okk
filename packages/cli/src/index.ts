#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createCore, type BackendName, type CoreApi, type CoreAgentRecord, type CoreSessionRecord } from "@okk/core";

type CommandHandler = (core: CoreApi, args: string[]) => Promise<void>;

interface ParsedOptions {
  values: Record<string, string | boolean | string[] | undefined>;
  positionals: string[];
}

type CliOptionSchema = Record<
  string,
  {
    type: "boolean" | "string";
    multiple?: boolean;
    default?: boolean | string | string[];
  }
>;

interface DerivedCheckpoint {
  id: string;
  type: "identity" | "team_run_error" | "team_run_missing";
  title: string;
  summary: string;
  requiresUserAction: boolean;
}

function print(text = ""): void {
  process.stdout.write(`${text}\n`);
}

function fail(message: string): never {
  process.stderr.write(`错误: ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

function trimToSingleLine(value: string, max = 96): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, max - 1)}…`;
}

function parseSubcommandArgs(args: string[], options: CliOptionSchema = {}): ParsedOptions {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options
  });
  return {
    values: parsed.values as ParsedOptions["values"],
    positionals: parsed.positionals
  };
}

async function resolveBackend(core: CoreApi, preferred?: string): Promise<BackendName> {
  const health = await core.runtime.listBackendHealth();
  const available = health.filter((item) => item.available);
  if (preferred) {
    const found = available.find((item) => item.backend === preferred);
    if (!found) {
      fail(`backend ${preferred} 不可用`);
    }
    return found.backend;
  }
  if (available.length > 0) {
    return available[0].backend;
  }
  const agents = await core.agents.list();
  if (agents.length > 0) {
    return agents[0].backend;
  }
  fail("当前没有可用 backend");
}

async function getAllSessions(core: CoreApi): Promise<CoreSessionRecord[]> {
  const [active, archived] = await Promise.all([
    core.sessions.list({ archived: false }),
    core.sessions.list({ archived: true })
  ]);
  const seen = new Set<string>();
  return [...active, ...archived].filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

async function findSession(core: CoreApi, missionId: string): Promise<CoreSessionRecord> {
  const items = await getAllSessions(core);
  const found = items.find((item) => item.id === missionId);
  if (!found) {
    fail(`mission ${missionId} 不存在`);
  }
  return found;
}

async function findMissionOrSession(core: CoreApi, id: string): Promise<{ missionId: string | null; session: CoreSessionRecord; title: string; summary: string }> {
  const mission = await core.missions.get(id);
  if (mission) {
    const session =
      (mission.sessionId ? await findSession(core, mission.sessionId) : null) ??
      ({
        id: mission.id,
        title: mission.title,
        repoId: mission.repoId ?? "",
        summary: mission.summary,
        tags: [],
        archivedAt: null,
        createdAt: mission.createdAt,
        updatedAt: mission.updatedAt
      } as CoreSessionRecord);
    return {
      missionId: mission.id,
      session,
      title: mission.title,
      summary: mission.summary
    };
  }

  const session = await findSession(core, id);
  return {
    missionId: null,
    session,
    title: session.title,
    summary: session.summary
  };
}

async function listMissionRuns(core: CoreApi, missionId: string) {
  return core.team.listRuns(missionId);
}

function buildRunSummary(runs: Awaited<ReturnType<CoreApi["team"]["listRuns"]>>) {
  return {
    total: runs.length,
    running: runs.filter((run) => run.status === "running").length,
    done: runs.filter((run) => run.status === "done").length,
    error: runs.filter((run) => run.status === "error").length
  };
}

async function deriveMissionCheckpoints(core: CoreApi, mission: CoreSessionRecord): Promise<DerivedCheckpoint[]> {
  const checkpoints: DerivedCheckpoint[] = [];
  const activeIdentity = await core.identity.getActive();
  if (!activeIdentity) {
    checkpoints.push({
      id: `identity-${mission.id}`,
      type: "identity",
      title: "设置主同事身份",
      summary: "当前未设置活跃身份，建议先配置主同事画像与长期协作风格。",
      requiresUserAction: true
    });
  }

  const runs = await listMissionRuns(core, mission.id);
  if (runs.length === 0) {
    checkpoints.push({
      id: `team-run-${mission.id}`,
      type: "team_run_missing",
      title: "尚未发起团队协作",
      summary: "当前 Mission 还没有 Team Run，可按需进入 run team 发起多同事协作。",
      requiresUserAction: false
    });
  }

  for (const run of runs.filter((item) => item.status === "error")) {
    checkpoints.push({
      id: `team-run-error-${run.id}`,
      type: "team_run_error",
      title: `Team Run 失败：${run.teamName}`,
      summary: run.summary ?? "Team Run 失败，需要检查 backend 可用性或调整编排。",
      requiresUserAction: true
    });
  }

  return checkpoints;
}

async function findRepoId(core: CoreApi, candidate?: string): Promise<string> {
  const repos = await core.repos.list();
  if (repos.length === 0) {
    fail("当前没有可用仓库，请先在 Web/Desktop 中创建或注册仓库");
  }

  if (!candidate) {
    return repos[0].id;
  }

  const normalized = candidate.trim().toLowerCase();
  const found = repos.find((repo) => repo.id.toLowerCase() === normalized || repo.name.toLowerCase() === normalized);
  if (!found) {
    fail(`仓库 ${candidate} 不存在`);
  }
  return found.id;
}

function resolveAgent(agents: CoreAgentRecord[], backend: BackendName, requested?: string): CoreAgentRecord {
  if (requested) {
    const found = agents.find((agent) => agent.name === requested);
    if (!found) {
      fail(`agent ${requested} 不存在`);
    }
    return found;
  }

  return agents.find((agent) => agent.backend === backend) ?? agents[0] ?? fail("当前没有可用 agent");
}

function printUsage(): void {
  print("OKK CLI MVP");
  print("");
  print("用法:");
  print("  okk repo list");
  print("  okk partner list");
  print("  okk partner home");
  print("  okk partner summary");
  print("  okk partner team");
  print("  okk mission list [--all]");
  print("  okk mission new <title> [--repo <repoId|repoName>]");
  print("  okk mission show <missionId>");
  print("  okk mission continue <missionId>");
  print("  okk checkpoint list <missionId>");
  print('  okk run direct <missionId> --prompt \"...\" [--backend <backend>] [--agent <agentName>]');
  print('  okk run team <missionId> [--goal \"...\"] [--team-name \"...\"] [--member \"agent|task|prompt\"]...');
  print("");
  print("说明:");
  print("  - 第一版 CLI 直接复用现有 Core API。");
  print("  - 当前 mission 暂时映射到现有 session 层。");
  print("  - 当前 team run 直接复用 Team Run 编排。");
}

function printSection(title: string): void {
  print(title);
  print("-".repeat(Math.max(title.length, 12)));
}

async function printPartnerHome(core: CoreApi): Promise<void> {
  const summary = await core.partner.getSummary();
  const missionSummaries = await core.missions.listSummaries();
  const recentMissions = missionSummaries.length > 0 ? missionSummaries : await core.sessions.list({ archived: false });
  const backendHealth = await core.runtime.listBackendHealth();
  const activeRuns = missionSummaries.length > 0
    ? (await Promise.all(missionSummaries.slice(0, 12).map((mission) => mission.sessionId ? core.team.listRuns(mission.sessionId) : Promise.resolve([])))).flat().filter((run) => run.status === "running")
    : (await Promise.all((recentMissions as CoreSessionRecord[]).slice(0, 12).map((mission) => core.team.listRuns(mission.id)))).flat().filter((run) => run.status === "running");

  printSection(`欢迎回来，${summary.identity?.name ?? "赛博同事"}`);
  print(summary.identity?.summary ?? "我已经准备好基于你最近的上下文继续协作。");
  print("");
  print(`活跃仓库: ${summary.activeRepoName ?? "未激活"}`);
  print(`长期记忆: ${summary.memoryCount}`);
  print(`进行中的 Mission: ${recentMissions.length}`);
  print(`进行中的 Team Run: ${activeRuns.length}`);
  print("");

  printSection("当前同事");
  if (!summary.identity) {
    print("- 未设置主同事身份");
  } else {
    print(`- ${summary.identity.name} [active]`);
  }
  for (const run of activeRuns.slice(0, 3)) {
    print(`- ${run.teamName} (${run.memberCount} members running)`);
  }
  print("");

  printSection("最近记忆");
  if (summary.recentMemories.length === 0) {
    print("- 暂无");
  } else {
    for (const memory of summary.recentMemories) {
      print(`- [${memory.memoryType}] ${memory.title}: ${trimToSingleLine(memory.summary, 80)}`);
    }
  }
  print("");

  printSection("最近 Missions");
  if (recentMissions.length === 0) {
    print("- 暂无");
  } else {
    for (const mission of recentMissions.slice(0, 5)) {
      if ("workstreamTotal" in mission) {
        print(`- ${mission.title}`);
        print(`  phase=${mission.phase} · ${mission.workstreamCompleted}/${mission.workstreamTotal} done · 待确认 ${mission.openCheckpointCount}`);
      } else {
        print(`- ${mission.title}`);
        print(`  ${trimToSingleLine(mission.summary || "暂无摘要", 84)}`);
      }
    }
  }
  print("");

  printSection("运行时");
  for (const item of backendHealth) {
    const status = item.available ? "ready" : "unavailable";
    print(`- ${item.backend}: ${status}`);
  }
}

async function printPartnerTeam(core: CoreApi): Promise<void> {
  const activeIdentity = await core.identity.getActive();
  const agents = await core.agents.list();
  const runtime = await core.runtime.listBackendHealth();
  const sessions = await core.sessions.list({ archived: false });
  const activeRuns = (
    await Promise.all(sessions.slice(0, 12).map((session) => core.team.listRuns(session.id)))
  ).flat().filter((run) => run.status === "running");

  printSection("主同事");
  if (!activeIdentity) {
    print("- 未设置活跃身份");
  } else {
    print(`- ${activeIdentity.name}`);
    print(`  ${trimToSingleLine(activeIdentity.systemPrompt, 88)}`);
  }
  print("");

  printSection("可用执行角色");
  if (agents.length === 0) {
    print("- 暂无");
  } else {
    for (const agent of agents) {
      print(`- ${agent.name} (${agent.backend})`);
      print(`  ${agent.description}`);
    }
  }
  print("");

  printSection("运行时");
  for (const item of runtime) {
    print(`- ${item.backend}: ${item.available ? "ready" : "unavailable"}`);
  }
  print("");

  printSection("正在协作的团队");
  if (activeRuns.length === 0) {
    print("- 当前没有进行中的 Team Run");
    return;
  }
  for (const run of activeRuns) {
    print(`- ${run.teamName} [${run.status}] ${run.memberCount} members`);
    if (run.members.length > 0) {
      for (const member of run.members) {
        print(`  · ${member.agentName}: ${member.status}`);
      }
    }
  }
}

const repoCommand: CommandHandler = async (core, args) => {
  const sub = args[0];
  if (sub !== "list") {
    fail("repo 仅支持 list");
  }

  const items = await core.repos.list();
  if (items.length === 0) {
    print("暂无仓库。");
    return;
  }

  for (const repo of items) {
    print(`${repo.id}  ${repo.name}  ${repo.path}`);
  }
};

const partnerCommand: CommandHandler = async (core, args) => {
  const sub = args[0];

  if (sub === "list") {
    const identities = await core.identity.list();
    const active = await core.identity.getActive();
    if (identities.length === 0) {
      print("暂无已配置身份。");
      return;
    }

    for (const item of identities) {
      const marker = active?.id === item.id ? "*" : " ";
      print(`${marker} ${item.id}  ${item.name}  ${trimToSingleLine(item.systemPrompt, 48)}`);
    }
    return;
  }

  if (sub === "summary") {
    const summary = await core.partner.getSummary();
    print(`当前同事: ${summary.identity?.name ?? "未设置"}`);
    print(`画像摘要: ${summary.identity?.summary ?? "暂无"}`);
    print(`活跃仓库: ${summary.activeRepoName ?? "未激活"}`);
    print(`记忆数: ${summary.memoryCount}`);
    print("最近记忆:");
    if (summary.recentMemories.length === 0) {
      print("  - 暂无");
      return;
    }
    for (const memory of summary.recentMemories) {
      print(`  - [${memory.memoryType}] ${memory.title}: ${trimToSingleLine(memory.summary, 72)}`);
    }
    return;
  }

  if (sub === "team") {
    await printPartnerTeam(core);
    return;
  }

  if (sub === "home") {
    await printPartnerHome(core);
    return;
  }

  fail("partner 仅支持 list / home / summary / team");
};

const missionCommand: CommandHandler = async (core, args) => {
  const sub = args[0];

  if (sub === "list") {
    const parsed = parseSubcommandArgs(args.slice(1), {
      all: { type: "boolean", default: false }
    });
    const missionItems = await core.missions.listSummaries();
    if (missionItems.length === 0) {
      const items = parsed.values.all ? await getAllSessions(core) : await core.sessions.list({ archived: false });
      if (items.length === 0) {
        print("暂无 mission。");
        return;
      }
      for (const item of items) {
        const status = item.archivedAt ? "archived" : "active";
        print(`${item.id}  [${status}]  ${item.title}`);
        print(`    ${trimToSingleLine(item.summary || "暂无摘要", 92)}`);
      }
      return;
    }
    const filtered = parsed.values.all ? missionItems : missionItems.filter((item) => item.status !== "completed");
    if (filtered.length === 0) {
      print("暂无 mission。");
      return;
    }
    for (const item of filtered) {
      print(`${item.id}  [${item.status}]  ${item.title}`);
      print(`    phase=${item.phase} · ${item.workstreamCompleted}/${item.workstreamTotal} done · 待确认 ${item.openCheckpointCount}`);
    }
    return;
  }

  if (sub === "new") {
    const parsed = parseSubcommandArgs(args.slice(1), {
      repo: { type: "string" }
    });
    const title = parsed.positionals.join(" ").trim();
    if (!title) {
      fail("mission new 需要标题");
    }
    const repoId = await findRepoId(core, typeof parsed.values.repo === "string" ? parsed.values.repo : undefined);
    const created = await core.missions.create({ title, goal: title, repoId });
    print(`已创建 mission: ${created.id}`);
    print(`标题: ${created.title}`);
    print(`session: ${created.sessionId ?? "-"}`);
    return;
  }

  if (sub === "show") {
    const missionId = args[1];
    if (!missionId) {
      fail("mission show 需要 missionId");
    }
    const target = await findMissionOrSession(core, missionId);
    const refs = await core.sessions.listReferences(target.session.id);
    const teamRuns = await core.team.listRuns(target.session.id);
    const runSummary = buildRunSummary(teamRuns);
    const checkpoints = await deriveMissionCheckpoints(core, target.session);
    print(`Mission: ${target.title}`);
    print(`ID: ${target.missionId ?? target.session.id}`);
    print(`状态: ${target.missionId ? ((await core.missions.get(target.missionId))?.status ?? "active") : (target.session.archivedAt ? "archived" : "active")}`);
    print(`Repo: ${target.session.repoId}`);
    print(`更新时间: ${formatDate(target.session.updatedAt)}`);
    print(`摘要: ${target.summary || "暂无"}`);
    print("");
    print(`相关片段: ${refs.length}`);
    for (const ref of refs.slice(0, 5)) {
      print(`  - ${trimToSingleLine(ref.snippet, 96)} (${formatDate(ref.createdAt)})`);
    }
    print("");
    print(`Team Runs: ${teamRuns.length}`);
    for (const run of teamRuns) {
      print(`  - ${run.id} [${run.status}] ${run.teamName} ${run.memberCount} members`);
    }
    print("");
    print(`团队进度: total=${runSummary.total} running=${runSummary.running} done=${runSummary.done} error=${runSummary.error}`);
    print(`待确认: ${checkpoints.filter((item) => item.requiresUserAction).length}`);
    return;
  }

  if (sub === "continue") {
    const missionId = args[1];
    if (!missionId) {
      fail("mission continue 需要 missionId");
    }
    const target = await findMissionOrSession(core, missionId);
    const next = await core.repos.continue(target.session.repoId);
    print(`继续入口: ${next.repoName}`);
    print(`摘要: ${next.summary}`);
    print("");
    print(next.prompt);
    return;
  }

  fail("mission 仅支持 list / new / show / continue");
};

async function streamDirectAnswer(core: CoreApi, mission: CoreSessionRecord, prompt: string, backend: BackendName, agentName: string): Promise<void> {
  const messageId = `cli-${Date.now()}`;
  for await (const chunk of core.qa.streamAnswer({
    sessionId: mission.id,
    action: "ask",
    backend,
    agentName,
    clientMessageId: messageId,
    content: prompt
  })) {
    process.stdout.write(chunk.content);
  }
  process.stdout.write("\n");
}

function buildDefaultTeamMembers(agents: CoreAgentRecord[], goal: string) {
  if (agents.length === 0) {
    fail("当前没有可用 agent，无法启动 team run");
  }

  const templates = [
    {
      memberId: "coordinator",
      taskTitle: "拆解 Mission 与建立执行计划",
      prompt: `请围绕以下 Mission 目标输出结构化拆解、阶段、风险和工作分配建议：${goal}`,
      dependsOn: [] as string[]
    },
    {
      memberId: "builder",
      taskTitle: "并行推进主工作流",
      prompt: `请基于以下 Mission 目标，独立推进一个最关键的可执行子任务，并给出结果摘要：${goal}`,
      dependsOn: [] as string[]
    },
    {
      memberId: "reviewer",
      taskTitle: "审查、交接与待确认项整理",
      prompt: `请针对以下 Mission 做独立审查，输出风险、handoff 建议和需要用户确认的 checkpoint：${goal}`,
      dependsOn: ["coordinator", "builder"]
    }
  ];

  return templates.map((template, index) => {
    const agent = agents[index % agents.length];
    return {
      memberId: template.memberId,
      agentName: agent.name,
      backend: agent.backend,
      taskTitle: template.taskTitle,
      prompt: template.prompt,
      dependsOn: template.dependsOn
    };
  });
}

function parseMemberSpec(raw: string) {
  const [agentName, taskTitle, prompt] = raw.split("|").map((item) => item.trim());
  if (!agentName || !taskTitle || !prompt) {
    fail(`member 参数格式错误: ${raw}，应为 "agent|task|prompt"`);
  }
  return { agentName, taskTitle, prompt };
}

async function waitForTeamRun(core: CoreApi, runId: string): Promise<NonNullable<Awaited<ReturnType<CoreApi["team"]["getRun"]>>>> {
  let previousSignature = "";

  for (;;) {
    const current = await core.team.getRun(runId);
    if (!current) {
      fail(`team run ${runId} 不存在`);
    }
    const signature = JSON.stringify({
      status: current.status,
      members: current.members.map((item) => ({
        memberId: item.memberId,
        status: item.status,
        updatedAt: item.updatedAt
      }))
    });
    if (signature !== previousSignature) {
      previousSignature = signature;
      print(`[team] ${current.teamName} -> ${current.status}`);
      for (const member of current.members) {
        print(`  - ${member.agentName} [${member.status}] ${member.error ?? trimToSingleLine(member.output ?? "", 72)}`);
      }
      print("");
    }

    if (current.status !== "running") {
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

const runCommand: CommandHandler = async (core, args) => {
  const sub = args[0];

  if (sub === "direct") {
    const missionId = args[1];
    if (!missionId) {
      fail("run direct 需要 missionId");
    }
    const parsed = parseSubcommandArgs(args.slice(2), {
      prompt: { type: "string" },
      backend: { type: "string" },
      agent: { type: "string" }
    });
    const prompt = typeof parsed.values.prompt === "string" ? parsed.values.prompt.trim() : "";
    if (!prompt) {
      fail('run direct 需要 --prompt "..."');
    }

    const target = await findMissionOrSession(core, missionId);
    const backend = await resolveBackend(core, typeof parsed.values.backend === "string" ? parsed.values.backend : undefined);
    const agents = await core.agents.list();
    const agent = resolveAgent(agents, backend, typeof parsed.values.agent === "string" ? parsed.values.agent : undefined);
    print(`Direct run: ${target.title}`);
    print(`Backend: ${backend}`);
    print(`Agent: ${agent.name}`);
    print("");
    await streamDirectAnswer(core, target.session, prompt, backend, agent.name);
    return;
  }

  if (sub === "team") {
    const missionId = args[1];
    if (!missionId) {
      fail("run team 需要 missionId");
    }

    const parsed = parseSubcommandArgs(args.slice(2), {
      goal: { type: "string" },
      "team-name": { type: "string" },
      member: { type: "string", multiple: true }
    });
      const target = await findMissionOrSession(core, missionId);
      const goal =
        (typeof parsed.values.goal === "string" ? parsed.values.goal.trim() : "") ||
        target.summary ||
        target.title;
    const membersArg = parsed.values.member;
    const agents = await core.agents.list();
    const members =
      Array.isArray(membersArg) && membersArg.length > 0
        ? membersArg.map(parseMemberSpec).map((item) => {
            const agent = agents.find((candidate) => candidate.name === item.agentName);
            if (!agent) {
              fail(`agent ${item.agentName} 不存在`);
            }
            return {
              memberId: undefined,
              agentName: agent.name,
              backend: agent.backend,
              taskTitle: item.taskTitle,
              prompt: item.prompt
            };
          })
        : buildDefaultTeamMembers(agents, goal);

      const teamName =
      (typeof parsed.values["team-name"] === "string" ? parsed.values["team-name"].trim() : "") ||
      `${target.title} 协作`;
    print(`计划成员: ${members.map((item) => `${item.memberId ?? item.agentName}:${item.agentName}`).join(", ")}`);

    const created = await core.team.run({
      sessionId: target.session.id,
      ...(target.missionId ? { missionId: target.missionId } : {}),
      teamName,
      members
    });
    print(`已启动 Team Run: ${created.id}`);
    print(`Team: ${created.teamName}`);
    print(`Members: ${created.memberCount}`);
    print(`Goal: ${trimToSingleLine(goal, 88)}`);
    print("");
    const finished = await waitForTeamRun(core, created.id);
    print(`最终状态: ${finished.status}`);
    if (finished.summary) {
      print(`摘要: ${finished.summary}`);
    }
    return;
  }

  fail("run 仅支持 direct / team");
};

const checkpointCommand: CommandHandler = async (core, args) => {
  const sub = args[0];
  if (sub !== "list") {
    fail("checkpoint 仅支持 list");
  }
  const missionId = args[1];
  if (!missionId) {
    fail("checkpoint list 需要 missionId");
  }

  const mission = await findSession(core, missionId);
  const checkpoints = await deriveMissionCheckpoints(core, mission);
  printSection(`Mission checkpoints / ${mission.title}`);
  if (checkpoints.length === 0) {
    print("- 暂无");
    return;
  }
  for (const item of checkpoints) {
    const marker = item.requiresUserAction ? "需要确认" : "信息";
    print(`- [${marker}] ${item.title}`);
    print(`  ${item.summary}`);
  }
};

const COMMANDS = new Map<string, CommandHandler>([
  ["repo", repoCommand],
  ["partner", partnerCommand],
  ["mission", missionCommand],
  ["run", runCommand],
  ["checkpoint", checkpointCommand]
]);

async function main(): Promise<void> {
  const [, , ...argv] = process.argv;
  const command = argv[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  const handler = COMMANDS.get(command);
  if (!handler) {
    fail(`未知命令 ${command}`);
  }

  const core = await createCore({
    workspaceRoot: process.cwd()
  });
  await handler(core, argv.slice(1));
}

await main().catch((error) => {
  if (process.exitCode === 1) {
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`执行失败: ${message}\n`);
  process.exitCode = 1;
});
