import type { FastifyInstance } from "fastify";
import type { OverviewResponse, OverviewSpot, Sport } from "@w-a/shared";
import { z } from "zod";

import { allSeedZones } from "../data/seedZones.js";
import { resolveLocality } from "../services/geocoding.js";
import { SPORT_VALUES, isWaterSport } from "../lib/sport.js";
import { getMarineSnapshots } from "../services/marine.js";
import { findSpots, SPORT_CATEGORY } from "../services/spots.js";
import { getSpotsByCategory } from "../services/spotsRepo.js";
import { NATIONWIDE_BEACH_LIMIT } from "../services/spotsRefresh.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport } from "../scoring/rules.js";

const querySchema = z.object({ sport: z.enum(SPORT_VALUES) });

/**
 * Vista general por deporte, sin buscar localidad ni hacer zoom.
 *
 * Vía normal (para cualquier deporte): la tabla `spots` precalculada
 * (services/spotsRepo.ts), sincronizada por un job aparte
 * (services/spotsRefresh.ts) que nunca dispara tráfico de usuario — ni
 * Overpass ni Nominatim entran en el camino de esta petición.
 *
 * Si la tabla está vacía (recién desplegado, el job aún no ha corrido nunca,
 * o Supabase no responde) se cae, por este orden:
 * 1. Playa/surf/windsurf: TODAS las playas de España en vivo desde OSM
 *    (mismo camino que usaba el job antes de que existiera la tabla).
 * 2. Cualquier deporte: zonas de arranque del repo (data/seedZones.ts).
 */
export async function registerOverviewRoute(app: FastifyInstance) {
  app.get("/overview", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport } = parsed.data;

    try {
      const fromTable = await overviewFromTable(sport);
      if (fromTable.spots.length > 0) return fromTable;
    } catch (error) {
      request.log.warn({ err: error }, "vista general: no se pudo leer la tabla de zonas precalculadas");
    }

    if (isWaterSport(sport)) {
      try {
        return await nationwideBeachesLive(sport);
      } catch (error) {
        request.log.warn({ err: error }, "vista general de playas en vivo falló, usando zonas precalculadas");
      }
    }

    return await seedOverview(sport);
  });
}

async function overviewFromTable(sport: Sport): Promise<OverviewResponse> {
  const category = SPORT_CATEGORY[sport];
  const rows = await getSpotsByCategory(category);
  if (rows.length === 0) return { sport, spots: [] };

  const coords = rows.map((r) => ({ lat: r.lat, lon: r.lon }));
  const water = isWaterSport(sport);
  const [weatherSnapshots, marineSnapshots] = await Promise.all([
    getWeatherSnapshots(coords),
    water ? getMarineSnapshots(coords) : Promise.resolve(null),
  ]);

  const spots: OverviewSpot[] = rows.map((row, i) => {
    const score = water
      ? scoreWaterSport(sport, weatherSnapshots[i], marineSnapshots![i])
      : scoreLandSport(sport, weatherSnapshots[i]);
    return {
      id: row.id,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      sport,
      score,
      scoreBand: scoreBandFor(score),
      amenities: row.amenities,
      windDirectionDeg: weatherSnapshots[i].windDirectionMiddayDeg,
      windAvgKmh: weatherSnapshots[i].windAvgTodayKmh,
    };
  });

  return { sport, spots };
}

async function nationwideBeachesLive(sport: OverviewResponse["sport"]): Promise<OverviewResponse> {
  const spain = await resolveLocality("España");
  const beaches = await findSpots(sport, spain.areaId, NATIONWIDE_BEACH_LIMIT);
  if (beaches.length === 0) throw new Error("Overpass no devolvió ninguna playa para España");

  const coords = beaches.map((b) => ({ lat: b.lat, lon: b.lon }));
  const [weatherSnapshots, marineSnapshots] = await Promise.all([
    getWeatherSnapshots(coords),
    getMarineSnapshots(coords),
  ]);

  const spots: OverviewSpot[] = beaches.map((beach, i) => {
    const score = scoreWaterSport(sport, weatherSnapshots[i], marineSnapshots[i]);
    return {
      id: beach.id,
      name: beach.name,
      lat: beach.lat,
      lon: beach.lon,
      sport,
      score,
      scoreBand: scoreBandFor(score),
      amenities: beach.amenities,
      windDirectionDeg: weatherSnapshots[i].windDirectionMiddayDeg,
      windAvgKmh: weatherSnapshots[i].windAvgTodayKmh,
    };
  });

  return { sport, spots };
}

async function seedOverview(sport: OverviewResponse["sport"]): Promise<OverviewResponse> {
  const zones = allSeedZones(sport);
  if (zones.length === 0) return { sport, spots: [] };

  const coords = zones.map((z) => ({ lat: z.lat, lon: z.lon }));
  const weatherSnapshots = await getWeatherSnapshots(coords);
  const marineSnapshots = isWaterSport(sport) ? await getMarineSnapshots(coords) : null;

  const spots: OverviewSpot[] = zones.map((zone, i) => {
    const score = marineSnapshots
      ? scoreWaterSport(sport, weatherSnapshots[i], marineSnapshots[i])
      : scoreLandSport(sport, weatherSnapshots[i]);
    return {
      id: zone.id,
      name: zone.name,
      locality: zone.locality,
      lat: zone.lat,
      lon: zone.lon,
      sport,
      score,
      scoreBand: scoreBandFor(score),
      windDirectionDeg: weatherSnapshots[i].windDirectionMiddayDeg,
      windAvgKmh: weatherSnapshots[i].windAvgTodayKmh,
    };
  });

  return { sport, spots };
}
