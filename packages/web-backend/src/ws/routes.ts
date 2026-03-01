import type { FastifyPluginAsync } from "fastify";

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { sessionId: string } }>(
    "/qa/:sessionId",
    {
      websocket: true,
      preValidation: [app.authenticate],
    },
    (socket, request) => {
      app.qaGateway.onConnection(socket, request.params.sessionId);
    },
  );

  app.get<{ Params: { teamId: string } }>(
    "/team/:teamId",
    {
      websocket: true,
      preValidation: [app.authenticate],
    },
    (socket, request) => {
      app.teamGateway.onConnection(socket, request.params.teamId);
    },
  );
};
