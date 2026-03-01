import type { FastifyPluginAsync } from "fastify";

interface SuggestionActionBody {
  sessionId?: string;
}

function resolveSessionId(input: SuggestionActionBody | undefined): string {
  const sessionId = input?.sessionId?.trim();
  if (!sessionId) {
    throw new Error("sessionId 必填");
  }
  return sessionId;
}

function toReplyCode(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : "unknown_error";
  if (message.includes("not found")) {
    return { status: 404, message };
  }
  if (message.includes("必填") || message.includes("ignored")) {
    return { status: 400, message };
  }
  return { status: 500, message };
}

export const knowledgeSuggestionsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { suggestionId: string }; Body: SuggestionActionBody }>(
    "/:suggestionId/save",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const sessionId = resolveSessionId(request.body);
        const suggestion = await app.qaGateway.saveSuggestion(sessionId, request.params.suggestionId);
        return reply.send(suggestion);
      } catch (error) {
        const normalized = toReplyCode(error);
        return reply.code(normalized.status).send({ message: normalized.message });
      }
    }
  );

  app.post<{ Params: { suggestionId: string }; Body: SuggestionActionBody }>(
    "/:suggestionId/ignore",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const sessionId = resolveSessionId(request.body);
        app.qaGateway.ignoreSuggestion(sessionId, request.params.suggestionId);
        return reply.code(204).send();
      } catch (error) {
        const normalized = toReplyCode(error);
        return reply.code(normalized.status).send({ message: normalized.message });
      }
    }
  );
};

