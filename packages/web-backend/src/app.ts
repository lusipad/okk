import fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { jwtPlugin } from "./auth/jwt.js";
import { createInMemoryCore } from "./core/in-memory-core.js";
import { loadCore } from "./core/load-core.js";
import type { LoadCoreOptions, OkkCore } from "./core/types.js";
import { apiRoutes } from "./routes/index.js";
import { QaGateway } from "./ws/qa-gateway.js";
import { TeamGateway } from "./ws/team-gateway.js";
import { wsRoutes } from "./ws/routes.js";

export type CoreMode = "real" | "auto" | "memory";

export interface CreateAppOptions {
  logger?: boolean;
  jwtSecret?: string;
  core?: OkkCore;
  coreMode?: CoreMode;
  coreOptions?: LoadCoreOptions["createCoreOptions"];
}

function resolveCoreMode(options: CreateAppOptions): CoreMode {
  if (options.coreMode) {
    return options.coreMode;
  }

  const fromEnv = process.env.OKK_CORE_MODE?.trim();
  if (fromEnv === "real" || fromEnv === "auto" || fromEnv === "memory") {
    return fromEnv;
  }

  return "auto";
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = fastify({
    logger: options.logger ?? false,
  });

  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET ?? "okk-dev-secret";
  const coreMode = resolveCoreMode(options);

  const logger: LoadCoreOptions["logger"] = {
    info: (message, extra) => {
      app.log.info(extra ?? {}, message);
    },
    warn: (message, extra) => {
      app.log.warn(extra ?? {}, message);
    },
    error: (message, extra) => {
      app.log.error(extra ?? {}, message);
    },
  };

  const core =
    options.core ??
    (coreMode === "memory"
      ? createInMemoryCore()
      : await loadCore({
          logger,
          allowInMemoryFallback: coreMode === "auto",
          createCoreOptions: options.coreOptions,
        }));

  if (coreMode === "memory") {
    app.log.warn({ coreMode }, "web_backend_running_with_in_memory_core");
  } else {
    app.log.info({ coreMode }, "web_backend_core_mode_ready");
  }

  app.decorate("core", core);
  app.decorate("qaGateway", new QaGateway(core));
  app.decorate("teamGateway", new TeamGateway(core));

  await app.register(jwtPlugin, { jwtSecret });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const isLocalhost =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        origin.startsWith("app://");
      callback(null, isLocalhost);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  });
  await app.register(websocket);
  await app.register(apiRoutes, { prefix: "/api" });
  await app.register(wsRoutes, { prefix: "/ws" });

  app.get("/healthz", async () => ({ ok: true, coreMode }));

  return app;
}
