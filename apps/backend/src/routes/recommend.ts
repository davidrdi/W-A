import type { FastifyInstance } from "fastify";
import type { RecommendResponse } from "@w-a/shared";
import { z } from "zod";

import { SPORT_VALUES, isWaterSport } from "../lib/sport.js";
import { resolveZones } from "../services/zones.js";
import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";

const DEFAULT_LIMIT = 8;

// Datos crudos por spot (meteo + marino si aplica), sin scoring ni
// explicación IA — eso vive en /spots (scoring) y /explain (IA).
const querySchema = z.object({
  sport: z.enum(SPORT_VALUES),
  locality: z.string().min(2),
});

export async function registerRecommendRoute(app: FastifyInstance) {
  app.get("/recommend", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport, locality } = parsed.data;

    const zones = await resolveZones(sport, locality, DEFAULT_LIMIT);
    const { spots, localityCenter } = zones;

    if (spots.length === 0) {
      const empty: RecommendResponse = { locality: zones.locality, sport, localityCenter, spots: [] };
      return empty;
    }

    const coords = spots.map((s) => ({ lat: s.lat, lon: s.lon }));
    const weatherSnapshots = await getWeatherSnapshots(coords);

    if (isWaterSport(sport)) {
      const marineSnapshots = await getMarineSnapshots(coords);
      const response: RecommendResponse = {
        locality: zones.locality,
        sport,
        localityCenter,
        spots: spots.map((spot, i) => ({ ...spot, weather: weatherSnapshots[i], marine: marineSnapshots[i] })),
      };
      return response;
    }

    const response: RecommendResponse = {
      locality: zones.locality,
      sport,
      localityCenter,
      spots: spots.map((spot, i) => ({ ...spot, weather: weatherSnapshots[i] })),
    };
    return response;
  });
}
