import type { FastifyInstance } from "fastify";
import type { OverviewResponse, OverviewSpot } from "@w-a/shared";
import { z } from "zod";

import { allSeedZones } from "../data/seedZones.js";
import { resolveLocality } from "../services/geocoding.js";
import { SPORT_VALUES, isWaterSport } from "../lib/sport.js";
import { getMarineSnapshots } from "../services/marine.js";
import { findSpots } from "../services/spots.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport } from "../scoring/rules.js";

const querySchema = z.object({ sport: z.enum(SPORT_VALUES) });

// "Todas las playas" pedido de verdad: con este tope, el único caso en que se
// recortaría es que España tenga más elementos natural=beach en OSM que esto
// — muy por encima de lo real (del orden de unos pocos miles) — así que en la
// práctica equivale a sin límite, sin dejar de tener un techo defendible.
const NATIONWIDE_BEACH_LIMIT = 8000;

/**
 * Vista general por deporte, sin buscar localidad ni hacer zoom.
 *
 * Playa/surf/windsurf: TODAS las playas de España, en vivo desde OSM
 * (natural=beach es un tag concreto y acotado — factible a escala nacional).
 * Se resuelve el área de España una vez (cacheada) y se reutiliza
 * literalmente findSpots(), el mismo camino que ya usa la búsqueda por
 * localidad, solo que con el área de todo el país y sin techo real.
 *
 * Running/paseo/senderismo/bici: zonas representativas precalculadas
 * (data/seedZones.ts), no exhaustivas — el tag equivalente en Overpass
 * (sendas y caminos peatonales de TODA España) es demasiado amplio para
 * pedirlo en vivo sin arriesgar el servicio (podría timeout / payload enorme
 * / tumbar la instancia pública que lo atienda).
 *
 * Si la vía en vivo de playas falla (Overpass caído, geocodificar "España"
 * falla...), se cae al mismo conjunto precalculado que usan los deportes de
 * tierra, para no dejar la vista general vacía.
 */
export async function registerOverviewRoute(app: FastifyInstance) {
  app.get("/overview", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport } = parsed.data;

    if (isWaterSport(sport)) {
      try {
        return await nationwideBeaches(sport);
      } catch (error) {
        request.log.warn({ err: error }, "vista general de playas en vivo falló, usando zonas precalculadas");
      }
    }

    return await seedOverview(sport);
  });
}

async function nationwideBeaches(sport: OverviewResponse["sport"]): Promise<OverviewResponse> {
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
    };
  });

  return { sport, spots };
}
