import type { FastifyPluginAsync } from "fastify";
import { agentsRoutes } from "./agents.js";
import { authRoutes } from "./auth.js";
import { knowledgeRoutes } from "./knowledge.js";
import { knowledgeSuggestionsRoutes } from "./knowledge-suggestions.js";
import { mcpRoutes } from "./mcp.js";
import { reposRoutes } from "./repos.js";
import { sessionsRoutes } from "./sessions.js";
import { skillsRoutes } from "./skills.js";

export const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(reposRoutes, { prefix: "/repos" });
  await app.register(sessionsRoutes, { prefix: "/sessions" });
  await app.register(knowledgeRoutes, { prefix: "/knowledge" });
  await app.register(knowledgeSuggestionsRoutes, { prefix: "/knowledge/suggestions" });
  await app.register(agentsRoutes, { prefix: "/agents" });
  await app.register(mcpRoutes, { prefix: "/mcp" });
  await app.register(skillsRoutes, { prefix: "/skills" });
};
