import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../lib/auth.js";
import { upsertPushToken } from "../services/pushTokensDb.js";

const schema = z.object({ expoPushToken: z.string().min(1) });

export async function registerPushTokensRoute(app: FastifyInstance) {
  app.post("/push-tokens", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    await upsertPushToken(request.userId!, parsed.data.expoPushToken);
    return reply.status(204).send();
  });
}
