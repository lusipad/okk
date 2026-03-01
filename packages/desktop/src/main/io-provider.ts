import type { IpcMain } from "electron";
import { IO_CHANNELS, type IOProviderName } from "../shared/ipc.js";

export interface IOProviderRequest {
  action?: string;
  payload?: unknown;
}

export interface IOProviderResponse {
  provider: IOProviderName;
  ok: true;
  action: string;
  payload: unknown;
  timestamp: string;
}

type IpcMainLike = Pick<IpcMain, "handle">;

export function createStubIOProviderHandler(provider: IOProviderName) {
  return async (_event: unknown, request: IOProviderRequest = {}): Promise<IOProviderResponse> => ({
    provider,
    ok: true,
    action: request.action ?? "noop",
    payload: request.payload ?? null,
    timestamp: new Date().toISOString()
  });
}

export function registerIOProviderHandlers(ipcMain: IpcMainLike): void {
  const providers = Object.keys(IO_CHANNELS) as IOProviderName[];

  for (const provider of providers) {
    ipcMain.handle(IO_CHANNELS[provider], createStubIOProviderHandler(provider));
  }
}
