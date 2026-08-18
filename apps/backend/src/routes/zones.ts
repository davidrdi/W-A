import type { FastifyInstance } from "fastify";
import type {
  LatLon,
  MarineSnapshot,
  ScoredSpot,
  Spot,
  SportScore,
  WeatherSnapshot,
  ZoneChip,
  ZoneDetailResponse,
  ZoneLevel,
  ZoneMode,
  ZonesResponse,
} from "@w-a/shared";
import { z } from "zod";

import { PROVINCES, findProvinceBySlug } from "../data/provinces.js";
import { MODE_FALLBACK_SPOT_SPORT, MODE_SPOT_SPORT, isWaterSport, sportsForMode } from "../lib/sport.js";
import { resolveLocality } from "../services/geocoding.js";
import { getMarineSnapshots } from "../services/marine.js";
import { findSpots, findSpotsAround } from "../services/spots.js";
import {
  anchorZonesToCoast,
  findBeachesInBbox,
  findZonesInBbox,
  levelForZoom,
  limitToNearest,
  type Bbox,
  type ZoneCandidate,
} from "../services/zones.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport, scoreZone } from "../scoring/rules.js";

// Chips que caben en pantalla sin convertirse en una mancha ilegible; es
// también el tope de puntos que se le piden de golpe a Open-Meteo.
const MAX_ZONES = 40;
// Sitios concretos que se listan al abrir una zona.
const MAX_SPOTS = 12;
// Radio de búsqueda cuando la zona no es un polígono administrativo: una
// provincia entera tardaría demasiado en Overpass, y un barrio ni siquiera
// tiene área — en ambos casos se muestrea alrededor del punto del chip.
const PROVINCE_SAMPLE_RADIUS_M = 30_000;
const LOCAL_SAMPLE_RADIUS_M = 4_000;

const zonesQuerySchema = z.object({
  mode: z.enum(["mar", "tierra"]),
  zoom: z.coerce.number().min(0).max(20),
  north: z.coerce.number(),
  south: z.coerce.number(),
  east: z.coerce.number(),
  west: z.coerce.number(),
});

const detailQuerySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.enum(["provincia", "municipio", "local"]),
  mode: z.enum(["mar", "tierra"]),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
});

// La API marina devuelve nulos tierra adentro y el servicio los normaliza a
// 0 — un punto sin ningún dato marino no es "mar en calma", es que no hay
// mar ahí, así que no se puntúa.
function hasMarineData(marine: MarineSnapshot | undefined): marine is MarineSnapshot {
  return !!marine && (marine.waveHeightMaxM > 0 || marine.seaSurfaceTempC > 0);
}

function inBbox(point: LatLon, bbox: Bbox): boolean {
  return point.lat >= bbox.south && point.lat <= bbox.north && point.lon >= bbox.west && point.lon <= bbox.east;
}

/** Provincias visibles, ancladas al punto que corresponde según el modo. */
function provinceCandidates(mode: ZoneMode, bbox: Bbox): ZoneCandidate[] {
  return PROVINCES.flatMap((province) => {
    const point = mode === "mar" ? province.seaPoint : province.center;
    if (!point || !inBbox(point, bbox)) return [];
    return [{ id: `provincia/${province.slug}`, name: province.name, lat: point.lat, lon: point.lon }];
  });
}

async function candidatesFor(mode: ZoneMode, level: ZoneLevel, bbox: Bbox): Promise<ZoneCandidate[]> {
  if (level === "provincia") return provinceCandidates(mode, bbox);

  const zones = await findZonesInBbox(level, bbox);
  if (mode === "tierra") return zones;

  const beaches = await findBeachesInBbox(bbox);
  return anchorZonesToCoast(zones, beaches);
}

export async function registerZonesRoute(app: FastifyInstance) {
  // Mapa interactivo: un chip por zona visible, con el score genérico del
  // modo. El nivel (provincia/municipio/barrio) lo decide el zoom.
  app.get("/zones", async (request, reply) => {
    const parsed = zonesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { mode, zoom, north, south, east, west } = parsed.data;
    const bbox: Bbox = { north, south, east, west };

    const requestedLevel = levelForZoom(zoom);
    let level = requestedLevel;
    let candidates = await candidatesFor(mode, level, bbox);

    // Los barrios solo existen en OSM en parte de las ciudades: si ahí no
    // hay nada, se cae al nivel de municipio en vez de dejar el mapa vacío
    // (la respuesta dice qué nivel se devuelve de verdad).
    if (candidates.length === 0 && level === "local") {
      level = "municipio";
      candidates = await candidatesFor(mode, level, bbox);
    }

    const center: LatLon = { lat: (north + south) / 2, lon: (east + west) / 2 };
    candidates = limitToNearest(candidates, center, MAX_ZONES);

    if (candidates.length === 0) {
      const empty: ZonesResponse = { mode, level, zones: [] };
      return empty;
    }

    const coords = candidates.map((c) => ({ lat: c.lat, lon: c.lon }));
    const weather = await getWeatherSnapshots(coords);
    const marine = mode === "mar" ? await getMarineSnapshots(coords) : [];

    const zones = candidates.flatMap((candidate, i): ZoneChip[] => {
      const marineSnapshot = marine[i];
      if (mode === "mar" && !hasMarineData(marineSnapshot)) return [];
      const score = scoreZone(mode, weather[i], marineSnapshot);
      return [{ ...candidate, level, score, scoreBand: scoreBandFor(score) }];
    });

    const response: ZonesResponse = { mode, level, zones };
    return response;
  });

  // Detalle de un chip: estado de la zona, qué deportes encajan hoy con esas
  // condiciones y los mejores/peores sitios concretos dentro de ella.
  app.get("/zones/detail", async (request, reply) => {
    const parsed = detailQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { id, name, level, mode, lat, lon } = parsed.data;

    const [weather] = await getWeatherSnapshots([{ lat, lon }]);
    const marine = mode === "mar" ? (await getMarineSnapshots([{ lat, lon }]))[0] : undefined;
    if (mode === "mar" && !hasMarineData(marine)) {
      return reply.status(404).send({ error: "No hay datos marinos para esa zona" });
    }

    const score = scoreZone(mode, weather, marine);
    const zone: ZoneChip = { id, name, level, lat, lon, score, scoreBand: scoreBandFor(score) };

    const sportFits: SportScore[] = sportsForMode(mode)
      .map((sport) => {
        const sportScore = isWaterSport(sport)
          ? scoreWaterSport(sport, weather, marine!)
          : scoreLandSport(sport, weather);
        return { sport, score: sportScore, scoreBand: scoreBandFor(sportScore) };
      })
      .sort((a, b) => b.score - a.score);

    const spots = await findSpotsInZone(id, name, level, mode);
    const { best, worst } = await rankSpotsInZone(spots, mode);

    const response: ZoneDetailResponse = { zone, weather, marine, sportFits, best, worst };
    return response;
  });
}

async function findSpotsInZone(id: string, name: string, level: ZoneLevel, mode: ZoneMode): Promise<Spot[]> {
  const sport = MODE_SPOT_SPORT[mode];
  const spots = await findSpotsForScope(id, name, level, sport);
  if (spots.length >= 3) return spots;

  // Poca cosa etiquetada como sendero: se completa con parques y sendas
  // urbanas antes que devolver una zona vacía.
  const fallbackSport = MODE_FALLBACK_SPOT_SPORT[mode];
  if (!fallbackSport) return spots;

  const extra = await findSpotsForScope(id, name, level, fallbackSport);
  const seen = new Set(spots.map((s) => s.id));
  return [...spots, ...extra.filter((s) => !seen.has(s.id))].slice(0, MAX_SPOTS);
}

async function findSpotsForScope(id: string, name: string, level: ZoneLevel, sport: Spot["sport"]): Promise<Spot[]> {
  const [type, rawId] = id.split("/");

  // Un municipio (relación de OSM) sí se busca por su polígono real: el area
  // id de Overpass es 3600000000 + el id de la relación.
  if (type === "relation" && rawId) {
    return findSpots(sport, 3_600_000_000 + Number(rawId), MAX_SPOTS);
  }

  if (level === "provincia") {
    const province = findProvinceBySlug(rawId ?? "");
    const point = province ? (province.seaPoint ?? province.center) : undefined;
    if (!point) return [];
    return findSpotsAround(sport, point, PROVINCE_SAMPLE_RADIUS_M, MAX_SPOTS);
  }

  // Barrio mapeado como nodo: no hay polígono, se muestrea alrededor.
  if (type === "node") {
    const area = await resolveLocality(name);
    return findSpotsAround(sport, { lat: area.lat, lon: area.lon }, LOCAL_SAMPLE_RADIUS_M, MAX_SPOTS);
  }

  return [];
}

async function rankSpotsInZone(spots: Spot[], mode: ZoneMode): Promise<{ best: ScoredSpot[]; worst: ScoredSpot[] }> {
  if (spots.length === 0) return { best: [], worst: [] };

  const coords = spots.map((s) => ({ lat: s.lat, lon: s.lon }));
  const weather = await getWeatherSnapshots(coords);
  const marine = mode === "mar" ? await getMarineSnapshots(coords) : [];

  const scored = spots
    .flatMap((spot, i): ScoredSpot[] => {
      const marineSnapshot = marine[i];
      if (mode === "mar" && !hasMarineData(marineSnapshot)) return [];
      const score = scoreZone(mode, weather[i] as WeatherSnapshot, marineSnapshot);
      return [{ ...spot, score, scoreBand: scoreBandFor(score) }];
    })
    .sort((a, b) => b.score - a.score);

  // Los peores solo se enseñan si hay suficientes sitios como para que la
  // distinción signifique algo (si no, "mejores" y "peores" serían los mismos).
  const worst = scored.length >= 8 ? scored.slice(-3).reverse() : [];
  return { best: scored.slice(0, 5), worst };
}
