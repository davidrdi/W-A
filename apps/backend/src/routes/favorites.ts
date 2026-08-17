import type { FastifyInstance } from "fastify";
import type { CreateFavoriteRequest, FavoritesResponse } from "@w-a/shared";
import { z } from "zod";

import { requireAuth } from "../lib/auth.js";
import { SPORT_VALUES } from "../lib/sport.js";
import { createFavorite, deleteFavorite, listFavorites } from "../services/favoritesDb.js";

const createSchema = z.object({
  spotId: z.string().min(1),
  spotName: z.string().min(1),
  sport: z.enum(SPORT_VALUES),
  lat: z.number(),
  lon: z.number(),
});

export async function registerFavoritesRoute(app: FastifyInstance) {
  app.get("/favorites", { preHandler: requireAuth }, async (request) => {
    const favorites = await listFavorites(request.userId!);
    const response: FavoritesResponse = { favorites };
    return response;
  });

  app.post("/favorites", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const input: CreateFavoriteRequest = parsed.data;
    return createFavorite(request.userId!, input);
  });

  app.delete("/favorites/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteFavorite(request.userId!, id);
    return reply.status(204).send();
  });
}
