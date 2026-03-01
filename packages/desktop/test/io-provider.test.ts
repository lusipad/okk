import { describe, expect, it, vi } from "vitest";
import { registerIOProviderHandlers } from "../src/main/io-provider.js";
import { IO_CHANNELS } from "../src/shared/ipc.js";

describe("registerIOProviderHandlers", () => {
  it("注册所有 IO provider 并返回可用的 stub 响应", async () => {
    const handlerMap = new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>();

    const ipcMainLike = {
      handle: vi.fn((channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) => {
        handlerMap.set(channel, handler);
      })
    };

    registerIOProviderHandlers(ipcMainLike);

    expect(ipcMainLike.handle).toHaveBeenCalledTimes(Object.keys(IO_CHANNELS).length);

    const qaHandler = handlerMap.get(IO_CHANNELS.qa);
    expect(qaHandler).toBeDefined();

    const response = await qaHandler?.({}, { action: "ping", payload: { q: "hello" } });

    expect(response).toMatchObject({
      provider: "qa",
      ok: true,
      action: "ping",
      payload: { q: "hello" }
    });
  });
});
