import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentRegistry } from "../src/agents/agent-registry.js";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "okclaw-agent-registry-"));
  tempDirs.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("AgentRegistry", () => {
  it("从 markdown/frontmatter 加载并注册 Agent，缺失字段时返回 warning", async () => {
    const directory = await createTempDir();

    await fs.writeFile(
      path.join(directory, "repo-explorer.md"),
      "---\nname: repo-explorer\ndescription: Explore repository\nallowedTools: Read, Glob\nmaxIterations: 3\nmodel: gpt-test\ntemperature: 0.2\n---\n\nYou are repo explorer.\n",
      "utf-8"
    );

    await fs.writeFile(
      path.join(directory, "code-reviewer.md"),
      "---\nname: code-reviewer\ndescription: Review code\nallowed_tools: [Read, Grep]\n---\n\nYou are code reviewer.\n",
      "utf-8"
    );

    await fs.writeFile(
      path.join(directory, "broken.md"),
      "---\nname: broken-agent\n---\n\nmissing description\n",
      "utf-8"
    );

    const registry = new AgentRegistry();
    const warnings = await registry.loadFromDirectory(directory);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("broken.md");

    const repoExplorer = registry.get("repo-explorer");
    expect(repoExplorer).toBeDefined();
    expect(repoExplorer?.allowedTools).toEqual(["Read", "Glob"]);
    expect(repoExplorer?.systemPrompt).toBe("You are repo explorer.");

    const codeReviewer = registry.get("code-reviewer");
    expect(codeReviewer?.allowedTools).toEqual(["Read", "Grep"]);

    expect(registry.getAll().map((agent) => agent.name)).toEqual(["code-reviewer", "repo-explorer"]);
  });

  it("目录不存在时返回 warning 而不是抛错", async () => {
    const registry = new AgentRegistry();
    const warnings = await registry.loadFromDirectory(path.join(os.tmpdir(), "okclaw-not-found"));

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Skip directory");
  });
});
