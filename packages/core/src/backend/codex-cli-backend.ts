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

    const resolvePowerShellString = (value: string): string => value.replace(/'/g, "''");

    super({
      name: "codex",
      command: normalizedOptions.command ?? "codex",
      onLog: normalizedOptions.onLog,
      startupTimeoutMs: 60000,
      resolveSpawn: ({ command, args, env, request }) => {
        if (process.platform !== "win32" || !/\.ps1$/i.test(command.trim())) {
          return { command, args, env };
        }

        const backendSessionId = resolveBackendSessionId(request);
        const powerShellCommand = backendSessionId
          ? `& '${resolvePowerShellString(command)}' exec resume '${resolvePowerShellString(backendSessionId)}' --json $env:OKK_CODEX_PROMPT`
          : `& '${resolvePowerShellString(command)}' exec --json $env:OKK_CODEX_PROMPT`;

        return {
          command: "powershell.exe",
          args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powerShellCommand],
          env: {
            ...env,
            OKK_CODEX_PROMPT: request.prompt ?? ""
          }
        };
      },
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
