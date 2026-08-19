import type { FastifyInstance } from "fastify";
import type { ScoredSpot, SpotsResponse } from "@w-a/shared";
import { z } from "zod";

import { SPORT_VALUES, isWaterSport } from "../lib/sport.js";
import { getMarineSnapshots } from "../services/marine.js";
import { resolveZones } from "../services/zones.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport } from "../scoring/rules.js";

// Endpoint ligero para pintar el mapa: solo score y coordenadas, no el
// desglose de meteo (eso vive en /recommend, para cuando se toca un pin).
const querySchema = z.object({
  sport: z.enum(SPORT_VALUES),
  locality: z.string().min(2),
});

export async function registerSpotsRoute(app: FastifyInstance) {
  app.get("/spots", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport, locality } = parsed.data;

    const zones = await resolveZones(sport, locality, 8);
    const { spots, localityCenter } = zones;

    if (spots.length === 0) {
      const empty: SpotsResponse = { locality: zones.locality, sport, localityCenter, spots: [], source: zones.source };
      return empty;
    }

    const coords = spots.map((s) => ({ lat: s.lat, lon: s.lon }));
    const weatherSnapshots = await getWeatherSnapshots(coords);

    let scored: ScoredSpot[];
    if (isWaterSport(sport)) {
      const marineSnapshots = await getMarineSnapshots(coords);
      scored = spots.map((spot, i) => {
        const score = scoreWaterSport(sport, weatherSnapshots[i], marineSnapshots[i]);
        return {
          ...spot,
          score,
          scoreBand: scoreBandFor(score),
          windDirectionDeg: weatherSnapshots[i].windDirectionMiddayDeg,
          windAvgKmh: weatherSnapshots[i].windAvgTodayKmh,
        };
      });
    } else {
      scored = spots.map((spot, i) => {
        const score = scoreLandSport(sport, weatherSnapshots[i]);
        return {
          ...spot,
          score,
          scoreBand: scoreBandFor(score),
          windDirectionDeg: weatherSnapshots[i].windDirectionMiddayDeg,
          windAvgKmh: weatherSnapshots[i].windAvgTodayKmh,
        };
      });
    }

    const response: SpotsResponse = {
      locality: zones.locality,
      sport,
      localityCenter,
      spots: scored,
      source: zones.source,
    };
    return response;
  });
}
