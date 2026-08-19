import type { FastifyInstance } from "fastify";

import { refreshAllSpots } from "../services/spotsRefresh.js";

// Pensada para que la llame un scheduler externo (cron / Supabase scheduled
// function), no el móvil ni el navegador — protegida por un secreto
// compartido, no por requireAuth (no hay un usuario detrás, es un job de
// sistema). Mismo patrón que /internal/notify-favorites.
export async function registerInternalRefreshSpotsRoute(app: FastifyInstance) {
  app.post("/internal/refresh-spots", async (request, reply) => {
    const expectedSecret = process.env.INTERNAL_JOB_SECRET;
    const providedSecret = request.headers["x-internal-secret"];
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return reply.status(401).send({ error: "No autorizado" });
    }

    const results = await refreshAllSpots();
    return { results };
  });
}
