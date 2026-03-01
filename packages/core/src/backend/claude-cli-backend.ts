import type { BackendRequest } from "../types.js";
import { CliBackend, type CliBackendLogEntry } from "./cli-backend.js";

export interface ClaudeCliBackendOptions {
  command?: string;
  onLog?: (entry: CliBackendLogEntry) => void;
}

const resolveBackendSessionId = (request: BackendRequest): string | null => {
  const value = request.metadata?.backendSessionId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

export class ClaudeCliBackend extends CliBackend {
  constructor(options: string | ClaudeCliBackendOptions = {}) {
    const normalizedOptions: ClaudeCliBackendOptions =
      typeof options === "string" ? { command: options } : options;

    super({
      name: "claude-code",
      command: normalizedOptions.command ?? "claude",
      onLog: normalizedOptions.onLog,
      buildArgs: (request: BackendRequest) => {
        const args: string[] = ["--print", "--verbose", "--output-format", "stream-json"];
        const backendSessionId = resolveBackendSessionId(request);
        if (backendSessionId) {
          args.push("--resume", backendSessionId);
        }
        if (request.systemPrompt) {
          args.push("--system-prompt", request.systemPrompt);
        }
        args.push(request.prompt ?? "");
        return args;
      }
    });
  }
}
