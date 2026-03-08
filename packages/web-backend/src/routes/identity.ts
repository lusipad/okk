import type { FastifyPluginAsync } from "fastify";

interface IdentityBody {
  name?: string;
  systemPrompt?: string;
  profileJson?: Record<string, unknown>;
  isActive?: boolean;
}

export const identityRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const identity = (app.core as unknown as { identity?: { list?: () => Promise<unknown[]> } }).identity;
    const items = typeof identity?.list === "function" ? await identity.list() : [];
    return reply.send({ items });
  });

  app.get("/active", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const identity = (app.core as unknown as { identity?: { getActive?: () => Promise<unknown> } }).identity;
    const item = typeof identity?.getActive === "function" ? await identity.getActive() : null;
    return reply.send({ item });
  });

  app.post<{ Body: IdentityBody }>("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body ?? {};
    if (!body.name || !body.systemPrompt) {
      return reply.code(400).send({ message: "name 和 systemPrompt 必填" });
    }

    const identity = (app.core as unknown as {
      identity?: {
        upsert?: (input: { name: string; systemPrompt: string; profileJson?: Record<string, unknown>; isActive?: boolean }) => Promise<unknown>;
      };
    }).identity;

    if (typeof identity?.upsert !== "function") {
      return reply.code(501).send({ message: "identity not available" });
    }

    const item = await identity.upsert({
      name: body.name,
      systemPrompt: body.systemPrompt,
      profileJson: body.profileJson ?? {},
      isActive: body.isActive === true
    });
    return reply.code(201).send({ item });
  });

  app.post<{ Params: { identityId: string } }>("/:identityId/activate", { preHandler: [app.authenticate] }, async (request, reply) => {
    const identity = (app.core as unknown as {
      identity?: { activate?: (identityId: string) => Promise<unknown | null> };
    }).identity;

    if (typeof identity?.activate !== "function") {
      return reply.code(501).send({ message: "identity not available" });
    }

    const item = await identity.activate(request.params.identityId);
    if (!item) {
      return reply.code(404).send({ message: "identity not found" });
    }
    return reply.send({ item });
  });
};
