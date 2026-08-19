import type { FastifyInstance } from "fastify";
import type { OverviewResponse, OverviewSpot } from "@w-a/shared";
import { z } from "zod";

import { allSeedZones } from "../data/seedZones.js";
import { SPORT_VALUES, isWaterSport } from "../lib/sport.js";
import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport } from "../scoring/rules.js";

const querySchema = z.object({ sport: z.enum(SPORT_VALUES) });

/**
 * Vista general: un pin por zona precalculada de todo el país, coloreado por
 * score, sin que el usuario tenga que buscar ni hacer zoom — solo elegir
 * deporte. Sobre el conjunto fijo de zonas de arranque (data/seedZones.ts) el
 * único coste real es la meteo, pedida en un solo lote y cacheada 1h, así que
 * cambiar de deporte es prácticamente instantáneo y no dispara ninguna
 * llamada a Overpass/Nominatim ni a la IA.
 */
export async function registerOverviewRoute(app: FastifyInstance) {
  app.get("/overview", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport } = parsed.data;

    const zones = allSeedZones(sport);
    if (zones.length === 0) {
      const empty: OverviewResponse = { sport, spots: [] };
      return empty;
    }

    const coords = zones.map((z) => ({ lat: z.lat, lon: z.lon }));
    const weatherSnapshots = await getWeatherSnapshots(coords);

    let spots: OverviewSpot[];
    if (isWaterSport(sport)) {
      const marineSnapshots = await getMarineSnapshots(coords);
      spots = zones.map((zone, i) => {
        const score = scoreWaterSport(sport, weatherSnapshots[i], marineSnapshots[i]);
        return {
          id: zone.id,
          name: zone.name,
          locality: zone.locality,
          lat: zone.lat,
          lon: zone.lon,
          sport,
          score,
          scoreBand: scoreBandFor(score),
        };
      });
    } else {
      spots = zones.map((zone, i) => {
        const score = scoreLandSport(sport, weatherSnapshots[i]);
        return {
          id: zone.id,
          name: zone.name,
          locality: zone.locality,
          lat: zone.lat,
          lon: zone.lon,
          sport,
          score,
          scoreBand: scoreBandFor(score),
        };
      });
    }

    const response: OverviewResponse = { sport, spots };
    return response;
  });
}
