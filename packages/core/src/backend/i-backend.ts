import type {
  BackendCapabilities,
  BackendEventInput,
  BackendRequest
} from "../types.js";

export interface IBackend {
  readonly name: string;
  readonly capabilities: BackendCapabilities;
  execute(request: BackendRequest): AsyncGenerator<BackendEventInput>;
  abort(sessionId: string): void;
}

