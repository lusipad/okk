import { createServer } from "node:net";
import { createApp } from "@okk/web-backend";

const HOST = "127.0.0.1";
const PORT_START = 3230;
const PORT_END = 3290;

export interface EmbeddedBackendRuntime {
  apiBaseUrl: string;
  wsBaseUrl: string;
  close: () => Promise<void>;
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => {
      resolve(false);
    });
    server.listen(port, HOST, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort(): Promise<number> {
  for (let port = PORT_START; port <= PORT_END; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port in range ${PORT_START}-${PORT_END}`);
}

export async function startEmbeddedBackend(): Promise<EmbeddedBackendRuntime> {
  const port = await pickPort();
  const app = await createApp({
    logger: false,
    coreMode: "real"
  });
  await app.listen({ host: HOST, port });

  const apiBaseUrl = `http://${HOST}:${port}`;
  const wsBaseUrl = `ws://${HOST}:${port}`;

  process.env.OKK_DESKTOP_API_BASE_URL = apiBaseUrl;
  process.env.OKK_DESKTOP_WS_BASE_URL = wsBaseUrl;

  return {
    apiBaseUrl,
    wsBaseUrl,
    close: async () => {
      await app.close();
    }
  };
}
