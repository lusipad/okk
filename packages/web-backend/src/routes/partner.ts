import type { FastifyPluginAsync } from "fastify";
import type { PartnerSummaryRecord } from "../core/types.js";

export const partnerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [app.authenticate] }, async (_request, reply) => {
    const partner = (app.core as unknown as {
      partner?: {
        getSummary?: () => Promise<PartnerSummaryRecord>;
      };
    }).partner;

    if (typeof partner?.getSummary !== "function") {
      return reply.code(501).send({ message: "partner summary not available" });
    }

    const item = await partner.getSummary();
    return reply.send({ item });
  });
};
