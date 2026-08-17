import type { FastifyInstance } from "fastify";
import type { RecommendResponse } from "@w-a/shared";
import { z } from "zod";

import { resolveLocality } from "../services/geocoding.js";
import { findRunningSpots } from "../services/spots.js";
import { getWeatherSnapshots } from "../services/weather.js";

// Fase 1: solo running como deporte piloto, sin scoring ni explicación IA
// todavía (llegan en las Fases 2 y 3).
const querySchema = z.object({
  sport: z.literal("running"),
  locality: z.string().min(2),
});

export async function registerRecommendRoute(app: FastifyInstance) {
  app.get("/recommend", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport, locality } = parsed.data;

    const area = await resolveLocality(locality);
    const spots = await findRunningSpots(area.areaId);

    if (spots.length === 0) {
      const empty: RecommendResponse = { locality: area.displayName, sport, spots: [] };
      return empty;
    }

    const weatherSnapshots = await getWeatherSnapshots(spots.map((s) => ({ lat: s.lat, lon: s.lon })));

    const response: RecommendResponse = {
      locality: area.displayName,
      sport,
      spots: spots.map((spot, i) => ({ ...spot, weather: weatherSnapshots[i] })),
    };
    return response;
  });
}
