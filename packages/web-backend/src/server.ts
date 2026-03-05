import { createApp, type CoreMode } from "./app.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? "3000");

const envCoreMode = process.env.OKK_CORE_MODE?.trim();
const coreMode: CoreMode =
  envCoreMode === "real" || envCoreMode === "auto" || envCoreMode === "memory"
    ? envCoreMode
    : "real";

const app = await createApp({ logger: true, coreMode });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
