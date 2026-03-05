import type { OkkCore } from "../core/types.js";
import type { QaGateway } from "../ws/qa-gateway.js";
import type { TeamGateway } from "../ws/team-gateway.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: import("fastify").preHandlerAsyncHookHandler;
    core: OkkCore;
    qaGateway: QaGateway;
    teamGateway: TeamGateway;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      username: string;
      role: "user" | "admin";
    };
    user: {
      sub: string;
      username: string;
      role: "user" | "admin";
    };
  }
}
