import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { spawn } from "node:child_process";
import type { FastifyPluginAsync, FastifyInstance } from "fastify";

type RiskLevel = "low" | "medium" | "high";
type RiskSeverity = "low" | "medium" | "high";

interface SkillRiskIssue {
  ruleId: string;
  severity: RiskSeverity;
  message: string;
  filePath: string;
  line: number;
  snippet: string;
}

interface SkillRiskSummary {
  level: RiskLevel;
  issueCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

interface SkillInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  source: string;
  riskLevel: RiskLevel;
  riskSummary: SkillRiskSummary;
  installed: boolean;
  installedAt: string | null;
}

interface SkillDetail extends SkillInfo {
  rootPath: string;
  content: string;
}

interface SkillFileEntry {
  path: string;
  kind: "file" | "directory";
  size: number;
}

interface LocalSkillRecord {
  id: string;
  dirName: string;
  rootPath: string;
  skillFilePath: string;
  name: string;
  description: string;
  version: string;
  source: string;
  content: string;
}

interface InstalledSkillRow {
  name: string;
  description: string;
  source: string;
  version: string;
  installedAt?: string;
}

interface InstalledSkillsDaoLike {
  list(): InstalledSkillRow[];
  upsert(input: {
    name: string;
    description: string;
    source: string;
    version: string;
  }): InstalledSkillRow;
}

interface ScanRule {
  id: string;
  severity: RiskSeverity;
  message: string;
  pattern: RegExp;
}

interface ImportFolderBody {
  folderPath?: string;
  targetName?: string;
  overwrite?: boolean;
}

type MarketSourceType = "folder" | "git";

interface SkillMarketItem {
  id: string;
  name: string;
  description: string;
  version: string;
  source: string;
  tags: string[];
  author: string;
  homepage: string;
  sourceType: MarketSourceType;
  sourceLocation: string;
  sourceBranch: string | null;
}

interface SkillMarketPayload {
  items?: unknown;
}

interface SkillMarketItemPayload {
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
}

interface InstallMarketBody {
  skillId?: string;
  targetName?: string;
  overwrite?: boolean;
}

const SCAN_RULES: ScanRule[] = [
  {
    id: "dangerous-delete",
    severity: "high",
    message: "检测到高风险删除指令",
    pattern: /\b(rm\s+-rf|rd\s+\/s\s+\/q|del\s+\/f\s+\/s\s+\/q)\b/i
  },
  {
    id: "shell-eval",
    severity: "high",
    message: "检测到动态脚本执行",
    pattern: /\b(eval\s*\(|Invoke-Expression|new\s+Function\s*\()\b/i
  },
  {
    id: "credential-touch",
    severity: "medium",
    message: "检测到凭据相关读取",
    pattern: /\b(API[_-]?KEY|TOKEN|PASSWORD|SECRET)\b/i
  },
  {
    id: "network-download",
    severity: "medium",
    message: "检测到外部下载或远程命令",
    pattern: /\b(curl|wget|Invoke-WebRequest|Start-BitsTransfer)\b/i
  },
  {
    id: "privilege-change",
    severity: "medium",
    message: "检测到权限/系统级操作",
    pattern: /\b(chmod|chown|sudo|Set-ExecutionPolicy|sc\s+config)\b/i
  }
];

const MAX_SCAN_FILE_SIZE = 256 * 1024;
const MAX_SCAN_FILES = 200;
const MAX_FILE_LIST_COUNT = 500;
const SKILL_MARKET_TEMP_PREFIX = "okk-skill-market-";

let standaloneInstalledDaoPromise: Promise<InstalledSkillsDaoLike | null> | null = null;
const installedSkillsFallback = new Map<string, InstalledSkillRow>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSkillId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function pickWorkspaceRoot(): string {
  let current = process.cwd();

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

function resolveSkillsDirectory(): string {
  const configured = process.env.OKK_SKILLS_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  const workspaceRoot = pickWorkspaceRoot();
  const candidates = [
    path.join(workspaceRoot, ".codex", "skills"),
    path.resolve(process.cwd(), ".codex", "skills"),
    path.join(os.homedir(), ".codex", "skills")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveSkillMarketIndexPath(): string {
  const configured = process.env.OKK_SKILL_MARKET_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  return path.join(pickWorkspaceRoot(), ".okk", "skill-market.json");
}

function normalizeMarketString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeMarketTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeMarketSourceType(value: unknown): MarketSourceType {
  return value === "git" ? "git" : "folder";
}

function normalizeMarketItem(
  input: SkillMarketItemPayload,
  index: number
): SkillMarketItem | null {
  const name = normalizeMarketString(input.name, `Skill ${index + 1}`);
  const sourceType = normalizeMarketSourceType(input.sourceType);
  const sourceLocation = normalizeMarketString(input.sourceLocation);
  if (!sourceLocation) {
    return null;
  }

  return {
    id: normalizeMarketString(input.id, toSkillId(name) || `market-skill-${index + 1}`),
    name,
    description: normalizeMarketString(input.description),
    version: normalizeMarketString(input.version, "0.0.1"),
    source: normalizeMarketString(input.source, "market"),
    tags: normalizeMarketTags(input.tags),
    author: normalizeMarketString(input.author),
    homepage: normalizeMarketString(input.homepage),
    sourceType,
    sourceLocation,
    sourceBranch:
      sourceType === "git" ? normalizeMarketString(input.sourceBranch) || null : null
  };
}

function asInstalledSkillsDao(value: unknown): InstalledSkillsDaoLike | null {
  if (!isObject(value)) {
    return null;
  }

  const list = value.list;
  const upsert = value.upsert;
  if (typeof list !== "function" || typeof upsert !== "function") {
    return null;
  }

  return {
    list: () => list.call(value) as InstalledSkillRow[],
    upsert: (input) => upsert.call(value, input) as InstalledSkillRow
  };
}

function resolveInstalledSkillsDaoFromCore(app: FastifyInstance): InstalledSkillsDaoLike | null {
  const core = app.core as unknown as Record<string, unknown>;

  const candidates: unknown[] = [
    core.installedSkills,
    isObject(core.skills) ? core.skills.installedSkills : null,
    isObject(core.database) ? core.database.installedSkills : null,
    isObject(core.db) ? core.db.installedSkills : null,
    isObject(core.sqlite) ? core.sqlite.installedSkills : null
  ];

  for (const candidate of candidates) {
    const dao = asInstalledSkillsDao(candidate);
    if (dao) {
      return dao;
    }
  }

  return null;
}

async function resolveStandaloneInstalledSkillsDao(): Promise<InstalledSkillsDaoLike | null> {
  if (standaloneInstalledDaoPromise) {
    return standaloneInstalledDaoPromise;
  }

  standaloneInstalledDaoPromise = (async () => {
    try {
      const dynamicImport = new Function("specifier", "return import(specifier)") as (
        specifier: string
      ) => Promise<Record<string, unknown>>;
      const coreModule = await dynamicImport("@okk/core");
      const SqliteDatabaseCtor = coreModule.SqliteDatabase;

      if (typeof SqliteDatabaseCtor !== "function") {
        return null;
      }

      const workspaceRoot = pickWorkspaceRoot();
      const dbPath = process.env.OKK_CORE_DB_PATH?.trim()
        ? path.resolve(process.env.OKK_CORE_DB_PATH)
        : path.join(workspaceRoot, ".okk", "core.db");

      const database = new (SqliteDatabaseCtor as new (options: { dbPath: string }) => Record<string, unknown>)({
        dbPath
      });

      return asInstalledSkillsDao((database as Record<string, unknown>).installedSkills);
    } catch {
      return null;
    }
  })();

  return standaloneInstalledDaoPromise;
}

async function getInstalledSkillRows(app: FastifyInstance): Promise<InstalledSkillRow[]> {
  const coreDao = resolveInstalledSkillsDaoFromCore(app);
  if (coreDao) {
    return coreDao.list();
  }

  const standaloneDao = await resolveStandaloneInstalledSkillsDao();
  if (standaloneDao) {
    return standaloneDao.list();
  }

  return Array.from(installedSkillsFallback.values());
}

async function upsertInstalledSkill(
  app: FastifyInstance,
  input: { name: string; description: string; source: string; version: string }
): Promise<InstalledSkillRow> {
  const coreDao = resolveInstalledSkillsDaoFromCore(app);
  if (coreDao) {
    return coreDao.upsert(input);
  }

  const standaloneDao = await resolveStandaloneInstalledSkillsDao();
  if (standaloneDao) {
    return standaloneDao.upsert(input);
  }

  const row: InstalledSkillRow = {
    ...input,
    installedAt: new Date().toISOString()
  };
  installedSkillsFallback.set(toSkillId(input.name), row);
  return row;
}

function parseFrontmatter(raw: string): { attrs: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) {
    return { attrs: {}, body: raw };
  }

  const lines = raw.split(/\r?\n/);
  let endIndex = -1;

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      endIndex = index;
      break;
    }
  }

  if (endIndex <= 0) {
    return { attrs: {}, body: raw };
  }

  const attrs: Record<string, string> = {};
  for (const line of lines.slice(1, endIndex)) {
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$/);
    if (!match) {
      continue;
    }

    attrs[match[1]] = match[2].replace(/^['\"]|['\"]$/g, "");
  }

  return {
    attrs,
    body: lines.slice(endIndex + 1).join("\n")
  };
}

function getFallbackDescription(content: string): string {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    return trimmed;
  }
  return "";
}

async function listLocalSkills(skillsRootDir: string): Promise<LocalSkillRecord[]> {
  await fsp.mkdir(skillsRootDir, { recursive: true });
  const entries = await fsp.readdir(skillsRootDir, { withFileTypes: true });
  const results: LocalSkillRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const rootPath = path.join(skillsRootDir, entry.name);
    const skillFilePath = path.join(rootPath, "SKILL.md");

    if (!fs.existsSync(skillFilePath)) {
      continue;
    }

    const content = await fsp.readFile(skillFilePath, "utf-8");
    const parsed = parseFrontmatter(content);
    const name = parsed.attrs.name?.trim() || entry.name;
    const description = parsed.attrs.description?.trim() || getFallbackDescription(parsed.body) || "";
    const version = parsed.attrs.version?.trim() || "0.0.0";

    results.push({
      id: toSkillId(entry.name),
      dirName: entry.name,
      rootPath,
      skillFilePath,
      name,
      description,
      version,
      source: `local:${entry.name}`,
      content
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return results;
}

async function resolveSkillById(skillsRootDir: string, skillId: string): Promise<LocalSkillRecord | null> {
  const skills = await listLocalSkills(skillsRootDir);
  return skills.find((item) => item.id === skillId || item.dirName === skillId) ?? null;
}

async function collectFiles(rootPath: string): Promise<SkillFileEntry[]> {
  const items: SkillFileEntry[] = [];

  const walk = async (absoluteDir: string, relativeDir: string): Promise<void> => {
    if (items.length >= MAX_FILE_LIST_COUNT) {
      return;
    }

    const entries = await fsp.readdir(absoluteDir, { withFileTypes: true });

    for (const entry of entries) {
      if (items.length >= MAX_FILE_LIST_COUNT) {
        return;
      }

      if (entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }

      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        items.push({
          path: relativePath,
          kind: "directory",
          size: 0
        });

        await walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        const stat = await fsp.stat(absolutePath);
        items.push({
          path: relativePath,
          kind: "file",
          size: stat.size
        });
      }
    }
  };

  await walk(rootPath, "");
  return items;
}

function isLikelyTextFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return [
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".js",
    ".cjs",
    ".mjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".sh",
    ".bash",
    ".ps1",
    ".bat",
    ".cmd",
    ".py",
    ".rb",
    ".go",
    ".rs",
    ".java",
    ".env"
  ].includes(extension);
}

async function scanSkillRisk(rootPath: string): Promise<{ summary: SkillRiskSummary; issues: SkillRiskIssue[] }> {
  const files = await collectFiles(rootPath);
  const issues: SkillRiskIssue[] = [];

  for (const file of files) {
    if (issues.length >= MAX_SCAN_FILES) {
      break;
    }

    if (file.kind !== "file") {
      continue;
    }

    if (!isLikelyTextFile(file.path)) {
      continue;
    }

    const absolutePath = path.join(rootPath, file.path);
    const stat = await fsp.stat(absolutePath);
    if (stat.size > MAX_SCAN_FILE_SIZE) {
      continue;
    }

    const raw = await fsp.readFile(absolutePath, "utf-8");
    const lines = raw.split(/\r?\n/);

    for (const rule of SCAN_RULES) {
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (!rule.pattern.test(line)) {
          continue;
        }

        issues.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message,
          filePath: file.path,
          line: index + 1,
          snippet: line.trim().slice(0, 200)
        });
      }
    }
  }

  const highCount = issues.filter((item) => item.severity === "high").length;
  const mediumCount = issues.filter((item) => item.severity === "medium").length;
  const lowCount = issues.filter((item) => item.severity === "low").length;

  const level: RiskLevel = highCount > 0 ? "high" : mediumCount > 0 ? "medium" : "low";

  return {
    summary: {
      level,
      issueCount: issues.length,
      highCount,
      mediumCount,
      lowCount
    },
    issues
  };
}

function toSkillInfo(
  skill: LocalSkillRecord,
  installed: boolean,
  installedAt: string | null,
  riskSummary: SkillRiskSummary
): SkillInfo {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    source: skill.source,
    riskLevel: riskSummary.level,
    riskSummary,
    installed,
    installedAt
  };
}

async function buildSkillInfoList(app: FastifyInstance, skillsRootDir: string): Promise<SkillInfo[]> {
  const [skills, installedRows] = await Promise.all([
    listLocalSkills(skillsRootDir),
    getInstalledSkillRows(app)
  ]);

  const installedByName = new Map<string, InstalledSkillRow>();
  const installedById = new Map<string, InstalledSkillRow>();

  for (const row of installedRows) {
    installedByName.set(row.name, row);
    installedById.set(toSkillId(row.name), row);
  }

  const items: SkillInfo[] = [];

  for (const skill of skills) {
    const risk = await scanSkillRisk(skill.rootPath);
    const installedRow = installedByName.get(skill.name) ?? installedById.get(skill.id);

    items.push(toSkillInfo(skill, Boolean(installedRow), installedRow?.installedAt ?? null, risk.summary));
  }

  return items;
}

function ensureSafeDirName(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw new Error("目录名不能为空");
  }

  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error("目录名仅支持字母、数字、._-");
  }

  return normalized;
}

function normalizePathForResponse(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

async function loadSkillMarketItems(): Promise<SkillMarketItem[]> {
  const configuredUrl = process.env.OKK_SKILL_MARKET_URL?.trim();
  const configuredFilePath = resolveSkillMarketIndexPath();
  let rawPayload: unknown = null;

  if (configuredUrl) {
    try {
      const response = await fetch(configuredUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      rawPayload = (await response.json()) as unknown;
    } catch {
      rawPayload = null;
    }
  }

  if (!rawPayload) {
    try {
      const fileRaw = await fsp.readFile(configuredFilePath, "utf-8");
      rawPayload = JSON.parse(fileRaw) as unknown;
    } catch {
      rawPayload = null;
    }
  }

  if (!isObject(rawPayload)) {
    return [];
  }

  const payload = rawPayload as SkillMarketPayload;
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items
    .map((item) => (isObject(item) ? (item as SkillMarketItemPayload) : null))
    .map((item, index) => (item ? normalizeMarketItem(item, index) : null))
    .filter((item): item is SkillMarketItem => item !== null);
}

async function runCommand(
  command: string,
  args: string[],
  cwd?: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function copySkillFromLocalFolder(
  sourceLocation: string,
  tempRoot: string
): Promise<string> {
  const sourceFolder = path.resolve(sourceLocation);
  const sourceStat = await fsp.stat(sourceFolder).catch(() => null);
  if (!sourceStat?.isDirectory()) {
    throw new Error("Skill 市场来源目录不存在");
  }

  const downloadedDir = path.join(tempRoot, "downloaded-skill");
  await fsp.cp(sourceFolder, downloadedDir, { recursive: true, force: true });
  return downloadedDir;
}

async function cloneSkillFromGit(item: SkillMarketItem, tempRoot: string): Promise<string> {
  const downloadedDir = path.join(tempRoot, "downloaded-skill");
  const args = ["clone", "--depth", "1"];
  if (item.sourceBranch) {
    args.push("--branch", item.sourceBranch);
  }
  args.push(item.sourceLocation, downloadedDir);
  await runCommand("git", args);
  return downloadedDir;
}

async function downloadSkillFromMarketItem(
  item: SkillMarketItem
): Promise<{ tempRoot: string; skillDir: string }> {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), SKILL_MARKET_TEMP_PREFIX));
  try {
    const skillDir =
      item.sourceType === "git"
        ? await cloneSkillFromGit(item, tempRoot)
        : await copySkillFromLocalFolder(item.sourceLocation, tempRoot);
    const skillFile = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      throw new Error("下载结果缺少 SKILL.md");
    }
    return { tempRoot, skillDir };
  } catch (error) {
    await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function installMarketSkillFromDirectory(params: {
  skillsRootDir: string;
  sourceDir: string;
  targetName: string;
  overwrite: boolean;
}): Promise<void> {
  const { skillsRootDir, sourceDir, targetName, overwrite } = params;
  await fsp.mkdir(skillsRootDir, { recursive: true });
  const targetDir = path.join(skillsRootDir, targetName);
  const targetExists = fs.existsSync(targetDir);
  const backupDir = path.join(
    skillsRootDir,
    `.rollback-${targetName}-${Date.now().toString(36)}`
  );

  if (targetExists && !overwrite) {
    throw new Error("目标 Skill 已存在，请开启 overwrite");
  }

  if (targetExists && overwrite) {
    await fsp.rename(targetDir, backupDir);
  }

  try {
    await fsp.cp(sourceDir, targetDir, {
      recursive: true,
      force: false,
      errorOnExist: true
    });
    if (targetExists && overwrite && fs.existsSync(backupDir)) {
      await fsp.rm(backupDir, { recursive: true, force: true });
    }
  } catch (error) {
    await fsp.rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
    if (targetExists && overwrite && fs.existsSync(backupDir)) {
      await fsp.rename(backupDir, targetDir).catch(() => undefined);
    }
    throw error;
  }
}

export const skillsRoutes: FastifyPluginAsync = async (app) => {
  const skillsRootDir = resolveSkillsDirectory();

  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const items = await buildSkillInfoList(app, skillsRootDir);
    return reply.send({ items });
  });

  app.get<{ Querystring: { q?: string } }>(
    "/market",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const [marketItems, localSkills] = await Promise.all([
        loadSkillMarketItems(),
        listLocalSkills(skillsRootDir)
      ]);
      const query = normalizeMarketString(request.query?.q).toLowerCase();
      const installedIds = new Set<string>(
        localSkills.map((item) => item.id).concat(localSkills.map((item) => item.dirName))
      );

      const filteredItems = marketItems
        .filter((item) => {
          if (!query) {
            return true;
          }
          const searchable = [item.name, item.description, item.tags.join(" "), item.author]
            .join(" ")
            .toLowerCase();
          return searchable.includes(query);
        })
        .map((item) => ({
          ...item,
          installed:
            installedIds.has(item.id) ||
            installedIds.has(toSkillId(item.name)) ||
            installedIds.has(toSkillId(item.id))
        }));

      return reply.send({ items: filteredItems });
    }
  );

  app.post<{ Body: InstallMarketBody }>(
    "/market/install",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const marketSkillId = request.body?.skillId?.trim();
      if (!marketSkillId) {
        return reply.code(400).send({ message: "skillId 不能为空" });
      }

      const marketItems = await loadSkillMarketItems();
      const marketItem = marketItems.find((item) => item.id === marketSkillId);
      if (!marketItem) {
        return reply.code(404).send({ message: "市场 Skill 不存在" });
      }

      const targetName = ensureSafeDirName(
        request.body?.targetName?.trim() || toSkillId(marketItem.name)
      );
      const overwrite = Boolean(request.body?.overwrite);
      const downloaded = await downloadSkillFromMarketItem(marketItem);

      try {
        await installMarketSkillFromDirectory({
          skillsRootDir,
          sourceDir: downloaded.skillDir,
          targetName,
          overwrite
        });
      } catch (error) {
        await fsp.rm(downloaded.tempRoot, { recursive: true, force: true }).catch(() => undefined);
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "市场 Skill 安装失败";
        const statusCode = message.includes("已存在") ? 409 : 500;
        return reply.code(statusCode).send({ message });
      }

      await fsp.rm(downloaded.tempRoot, { recursive: true, force: true }).catch(() => undefined);

      const installedSkill = await resolveSkillById(skillsRootDir, targetName);
      if (!installedSkill) {
        return reply.code(500).send({ message: "安装完成但读取 Skill 失败" });
      }

      const [installedRow, risk] = await Promise.all([
        upsertInstalledSkill(app, {
          name: installedSkill.name,
          description: installedSkill.description,
          source: marketItem.source || installedSkill.source,
          version: installedSkill.version || marketItem.version
        }),
        scanSkillRisk(installedSkill.rootPath)
      ]);

      return reply.code(201).send({
        item: toSkillInfo(
          installedSkill,
          true,
          installedRow.installedAt ?? new Date().toISOString(),
          risk.summary
        )
      });
    }
  );

  app.get<{ Params: { skillId: string } }>(
    "/:skillId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const skill = await resolveSkillById(skillsRootDir, request.params.skillId);
      if (!skill) {
        return reply.code(404).send({ message: "Skill 不存在" });
      }

      const [installedRows, risk] = await Promise.all([
        getInstalledSkillRows(app),
        scanSkillRisk(skill.rootPath)
      ]);

      const installedRow =
        installedRows.find((row) => row.name === skill.name) ??
        installedRows.find((row) => toSkillId(row.name) === skill.id) ??
        null;

      const detail: SkillDetail = {
        ...toSkillInfo(skill, Boolean(installedRow), installedRow?.installedAt ?? null, risk.summary),
        rootPath: normalizePathForResponse(path.relative(pickWorkspaceRoot(), skill.rootPath)),
        content: skill.content
      };

      return reply.send({
        item: detail,
        risk: {
          summary: risk.summary,
          issues: risk.issues.map((issue) => ({
            ...issue,
            filePath: normalizePathForResponse(issue.filePath)
          }))
        }
      });
    }
  );

  app.get<{ Params: { skillId: string } }>(
    "/:skillId/files",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const skill = await resolveSkillById(skillsRootDir, request.params.skillId);
      if (!skill) {
        return reply.code(404).send({ message: "Skill 不存在" });
      }

      const files = await collectFiles(skill.rootPath);
      return reply.send({
        items: files.map((file) => ({
          ...file,
          path: normalizePathForResponse(file.path)
        }))
      });
    }
  );

  app.get<{ Params: { skillId: string } }>(
    "/:skillId/risk-scan",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const skill = await resolveSkillById(skillsRootDir, request.params.skillId);
      if (!skill) {
        return reply.code(404).send({ message: "Skill 不存在" });
      }

      const risk = await scanSkillRisk(skill.rootPath);
      return reply.send({
        summary: risk.summary,
        issues: risk.issues.map((issue) => ({
          ...issue,
          filePath: normalizePathForResponse(issue.filePath)
        }))
      });
    }
  );

  app.post<{ Params: { skillId: string } }>(
    "/:skillId/install",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const skill = await resolveSkillById(skillsRootDir, request.params.skillId);
      if (!skill) {
        return reply.code(404).send({ message: "Skill 不存在" });
      }

      const installed = await upsertInstalledSkill(app, {
        name: skill.name,
        description: skill.description,
        source: skill.source,
        version: skill.version
      });

      const risk = await scanSkillRisk(skill.rootPath);

      return reply.send(
        toSkillInfo(skill, true, installed.installedAt ?? new Date().toISOString(), risk.summary)
      );
    }
  );

  app.post<{ Body: ImportFolderBody }>(
    "/import-folder",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const folderPath = request.body?.folderPath?.trim();
      if (!folderPath) {
        return reply.code(400).send({ message: "folderPath 不能为空" });
      }

      const sourceDir = path.resolve(folderPath);
      const sourceStat = await fsp.stat(sourceDir).catch(() => null);
      if (!sourceStat || !sourceStat.isDirectory()) {
        return reply.code(400).send({ message: "folderPath 必须是存在的目录" });
      }

      const sourceSkillFile = path.join(sourceDir, "SKILL.md");
      if (!fs.existsSync(sourceSkillFile)) {
        return reply.code(400).send({ message: "导入目录缺少 SKILL.md" });
      }

      const targetName = ensureSafeDirName(
        request.body?.targetName?.trim() || path.basename(sourceDir)
      );
      const overwrite = Boolean(request.body?.overwrite);

      await fsp.mkdir(skillsRootDir, { recursive: true });
      const targetDir = path.join(skillsRootDir, targetName);
      const targetExists = fs.existsSync(targetDir);

      if (targetExists && !overwrite) {
        return reply.code(409).send({ message: "目标 Skill 已存在，请开启 overwrite" });
      }

      await fsp.cp(sourceDir, targetDir, {
        recursive: true,
        force: overwrite,
        errorOnExist: !overwrite
      });

      const created = await resolveSkillById(skillsRootDir, toSkillId(targetName));
      if (!created) {
        return reply.code(500).send({ message: "导入后读取 Skill 失败" });
      }

      const risk = await scanSkillRisk(created.rootPath);

      return reply.code(201).send({
        item: toSkillInfo(created, false, null, risk.summary)
      });
    }
  );

  app.delete<{ Params: { skillId: string } }>(
    "/:skillId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const skill = await resolveSkillById(skillsRootDir, request.params.skillId);
      if (!skill) {
        return reply.code(404).send({ message: "Skill 不存在" });
      }

      await fsp.rm(skill.rootPath, { recursive: true, force: false });
      return reply.code(204).send();
    }
  );
};
