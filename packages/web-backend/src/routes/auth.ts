import type { FastifyPluginAsync } from "fastify";

interface LoginBody {
  username: string;
  password: string;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
    const { username, password } = request.body ?? {};
    if (!username || !password) {
      return reply.code(400).send({ message: "username 和 password 必填" });
    }

    const user = await app.core.auth.authenticate(username, password);
    if (!user) {
      return reply.code(401).send({ message: "用户名或密码错误" });
    }

    const token = await reply.jwtSign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = typeof request.user.sub === "string" ? request.user.sub : "";
    const user = await app.core.auth.getUserById(userId);
    if (!user) {
      return reply.code(404).send({ message: "用户不存在" });
    }

    return reply.send({ user });
  });

  app.post("/logout", { preHandler: [app.authenticate] }, async (_request, reply) => {
    return reply.send({ success: true });
  });
};
