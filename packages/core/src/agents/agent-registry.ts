import fs from "node:fs";
import path from "node:path";
import type { AgentDefinition } from "../types.js";
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

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  register(definition: AgentDefinition): void {
    if (!definition.name || !definition.description) {
      throw new Error("Agent definition requires name and description");
    }
    this.agents.set(definition.name, definition);
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  get(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadFromDirectory(directoryPath: string): Promise<string[]> {
    const warnings: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      warnings.push(
        `Skip directory ${directoryPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return warnings;
    }

    const sortedEntries = entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of sortedEntries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const filePath = path.join(directoryPath, entry.name);
      try {
        const raw = await fs.promises.readFile(filePath, "utf-8");
        const parsed = parseFrontmatter(raw);

        const name = parsed.attributes.name ? String(parsed.attributes.name).trim() : "";
        const description = parsed.attributes.description
          ? String(parsed.attributes.description).trim()
          : "";

        if (!name || !description) {
          warnings.push(`Skip ${entry.name}: missing name or description`);
          continue;
        }

        this.register({
          name,
          description,
          icon: parsed.attributes.icon ? String(parsed.attributes.icon) : undefined,
          allowedTools: asStringArray(
            parsed.attributes.allowedTools ?? parsed.attributes.allowed_tools
          ),
          maxIterations:
            typeof parsed.attributes.maxIterations === "number"
              ? parsed.attributes.maxIterations
              : undefined,
          model: parsed.attributes.model ? String(parsed.attributes.model) : undefined,
          temperature:
            typeof parsed.attributes.temperature === "number"
              ? parsed.attributes.temperature
              : undefined,
          systemPrompt: parsed.body.trim(),
          filePath
        });
      } catch (error) {
        warnings.push(
          `Skip ${entry.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return warnings;
  }
}
