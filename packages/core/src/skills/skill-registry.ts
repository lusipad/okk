import fs from "node:fs";
import path from "node:path";
import type { SkillInfo } from "../types.js";
import { parseFrontmatter } from "../utils/frontmatter.js";

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export class SkillRegistry {
  private readonly skills = new Map<string, SkillInfo>();

  register(skill: SkillInfo): void {
    if (!skill.name || !skill.description) {
      throw new Error("Skill requires name and description");
    }
    this.skills.set(skill.name, skill);
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  get(name: string): SkillInfo | undefined {
    return this.skills.get(name);
  }

  getAll(): SkillInfo[] {
    return Array.from(this.skills.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadFromDirectory(directoryPath: string): Promise<string[]> {
    const warnings: string[] = [];
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillRoot = path.join(directoryPath, entry.name);
      const skillFile = path.join(skillRoot, "SKILL.md");
      if (!fs.existsSync(skillFile)) {
        warnings.push(`Skip ${entry.name}: SKILL.md not found`);
        continue;
      }

      const raw = await fs.promises.readFile(skillFile, "utf-8");
      const parsed = parseFrontmatter(raw);

      const name = parsed.attributes.name ? String(parsed.attributes.name) : entry.name;
      const description = parsed.attributes.description
        ? String(parsed.attributes.description)
        : "";
      if (!description) {
        warnings.push(`Skip ${entry.name}: missing description`);
        continue;
      }

      const scriptsDirectory = path.join(skillRoot, "scripts");
      const workingDirectory = fs.existsSync(scriptsDirectory) ? scriptsDirectory : skillRoot;

      this.register({
        name,
        description,
        compatibility: asStringArray(parsed.attributes.compatibility),
        content: raw,
        workingDirectory: path.resolve(workingDirectory),
        rootDirectory: path.resolve(skillRoot)
      });
    }

    return warnings;
  }
}

