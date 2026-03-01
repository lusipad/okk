import fastifyPlugin from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export interface JwtPluginOptions {
  jwtSecret: string;
}

const plugin: FastifyPluginAsync<JwtPluginOptions> = async (app, options): Promise<void> => {
  await app.register(fastifyJwt, {
    secret: options.jwtSecret,
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const queryToken =
        typeof (request.query as Record<string, unknown> | undefined)?.token === "string"
          ? (request.query as Record<string, string>).token
          : undefined;
      if (queryToken && !request.headers.authorization) {
        request.headers.authorization = `Bearer ${queryToken}`;
      }
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: "Unauthorized" });
    }
  });
};

export const jwtPlugin = fastifyPlugin(plugin);
