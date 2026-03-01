import type { BackendRequest } from "../types.js";
import { CliBackend, type CliBackendLogEntry } from "./cli-backend.js";

export interface CodexCliBackendOptions {
  command?: string;
  onLog?: (entry: CliBackendLogEntry) => void;
}

const resolveBackendSessionId = (request: BackendRequest): string | null => {
  const value = request.metadata?.backendSessionId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

export class CodexCliBackend extends CliBackend {
  constructor(options: string | CodexCliBackendOptions = {}) {
    const normalizedOptions: CodexCliBackendOptions =
      typeof options === "string" ? { command: options } : options;

    super({
      name: "codex",
      command: normalizedOptions.command ?? "codex",
      onLog: normalizedOptions.onLog,
      buildArgs: (request: BackendRequest) => {
        const backendSessionId = resolveBackendSessionId(request);
        const args: string[] = ["exec"];
        if (backendSessionId) {
          args.push("resume", backendSessionId);
        }

        args.push("--json");
        args.push(request.prompt ?? "");
        return args;
      }
    });
  }
}
