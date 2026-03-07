import fs from "node:fs";
import path from "node:path";
import type { RepositoryContext } from "../types.js";
import type { KnowledgeDao } from "../database/dao/knowledge-dao.js";

export interface RepositoryPathValidationResult {
  valid: boolean;
  normalizedPath: string;
  errors: string[];
}

export interface BuildRepositoryContextInput {
  repositoryPath: string;
  repoId: string;
  additionalDirectories?: string[];
  knowledgeLimit?: number;
  projectContextAppendix?: string;
}

const DEFAULT_DENY_PATTERNS = [
  "/.ssh",
  "/.gnupg",
  "/credentials",
  "/secrets",
  "/.aws"
];

export class RepositoryContextService {
  constructor(
    private readonly knowledgeDao: KnowledgeDao,
    private readonly denyPatterns: string[] = DEFAULT_DENY_PATTERNS
  ) {}

  validateRepositoryPath(rawPath: string): RepositoryPathValidationResult {
    const normalizedPath = path.resolve(rawPath);
    const normalizedUnix = normalizedPath.replace(/\\/g, "/").toLowerCase();
    const errors: string[] = [];

    if (!fs.existsSync(normalizedPath)) {
      errors.push("Path does not exist");
    } else if (!fs.statSync(normalizedPath).isDirectory()) {
      errors.push("Path is not a directory");
    }

    if (this.denyPatterns.some((pattern) => normalizedUnix.includes(pattern))) {
      errors.push("Path matches blocked security pattern");
    }

    const gitMetadataPath = path.join(normalizedPath, ".git");
    if (!fs.existsSync(gitMetadataPath)) {
      errors.push("Path is not a git repository (.git missing)");
    }

    return {
      valid: errors.length === 0,
      normalizedPath,
      errors
    };
  }

  async buildContext(input: BuildRepositoryContextInput): Promise<RepositoryContext> {
    const mainValidation = this.validateRepositoryPath(input.repositoryPath);
    if (!mainValidation.valid) {
      throw new Error(mainValidation.errors.join("; "));
    }

    const additionalDirectories = Array.from(
      new Set(
        (input.additionalDirectories ?? [])
          .map((directory) => this.validateRepositoryPath(directory))
          .filter((validation) => validation.valid)
          .map((validation) => validation.normalizedPath)
      )
    );

    const claudeMdPath = path.join(mainValidation.normalizedPath, "CLAUDE.md");
    const claudeMd = fs.existsSync(claudeMdPath)
      ? await fs.promises.readFile(claudeMdPath, "utf-8")
      : null;

    const knowledgeSummaries = this.knowledgeDao.listPublishedSummariesByRepo(
      input.repoId,
      input.knowledgeLimit ?? 10
    );

    const knowledgeSummary = knowledgeSummaries
      .map(
        (entry, index) =>
          `${index + 1}. [${entry.category}] ${entry.title}: ${entry.summary}`
      )
      .join("\n");

    const sections: string[] = [];
    if (claudeMd) {
      sections.push(`## CLAUDE.md\n${claudeMd.trim()}`);
    }
    if (knowledgeSummary) {
      sections.push(`## Published Knowledge\n${knowledgeSummary}`);
    }

    return {
      workingDirectory: mainValidation.normalizedPath,
      additionalDirectories,
      claudeMd,
      knowledgeSummary,
      systemPromptAppendix: sections.join("\n\n")
    };
  }
}



