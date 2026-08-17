import type { FastifyInstance } from "fastify";
import type { ScoredSpot, SpotsResponse } from "@w-a/shared";
import { z } from "zod";

import { resolveLocality } from "../services/geocoding.js";
import { findRunningSpots } from "../services/spots.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreRunning } from "../scoring/rules.js";

// Endpoint ligero para pintar el mapa: solo score y coordenadas, no el
// desglose de meteo (eso vive en /recommend, para cuando se toca un pin).
const querySchema = z.object({
  sport: z.literal("running"),
  locality: z.string().min(2),
});

export async function registerSpotsRoute(app: FastifyInstance) {
  app.get("/spots", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport, locality } = parsed.data;

    const area = await resolveLocality(locality);
    const spots = await findRunningSpots(area.areaId);

    if (spots.length === 0) {
      const empty: SpotsResponse = { locality: area.displayName, sport, spots: [] };
      return empty;
    }

    const weatherSnapshots = await getWeatherSnapshots(spots.map((s) => ({ lat: s.lat, lon: s.lon })));

    const scored: ScoredSpot[] = spots.map((spot, i) => {
      const score = scoreRunning(weatherSnapshots[i]);
      return { ...spot, score, scoreBand: scoreBandFor(score) };
    });

    const response: SpotsResponse = { locality: area.displayName, sport, spots: scored };
    return response;
  });
}
