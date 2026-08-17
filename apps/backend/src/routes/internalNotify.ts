import type { FastifyInstance } from "fastify";

import { notifyFavorites } from "../services/favoritesNotifier.js";

// Pensada para que la llame un scheduler externo (cron / Supabase scheduled
// function), no el móvil — protegida por un secreto compartido, no por
// requireAuth (no hay un usuario detrás, es un job de sistema).
export async function registerInternalNotifyRoute(app: FastifyInstance) {
  app.post("/internal/notify-favorites", async (request, reply) => {
    const expectedSecret = process.env.INTERNAL_JOB_SECRET;
    const providedSecret = request.headers["x-internal-secret"];
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const result = await notifyFavorites(today);
    return result;
  });
}
