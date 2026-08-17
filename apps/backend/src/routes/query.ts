import type { FastifyInstance } from "fastify";
import type { MarineSnapshot, QueryFilters, QueryResponse, RankedSpot, Spot } from "@w-a/shared";
import { z } from "zod";

import { isWaterSport } from "../lib/sport.js";
import { parseQueryIntent, rankSpots, type RankingCandidate } from "../services/claude.js";
import { resolveLocality } from "../services/geocoding.js";
import { getMarineSnapshots } from "../services/marine.js";
import { findSpots } from "../services/spots.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport } from "../scoring/rules.js";

const bodySchema = z.object({ text: z.string().min(3) });

// requireNaturist es el único filtro estricto (si alguien pide
// específicamente una playa nudista, un "sin dato" no vale). Los demás
// solo excluyen cuando OSM dice explícitamente lo contrario — exigir
// confirmación positiva devolvería casi siempre 0 resultados, porque la
// mayoría de spots no tienen esos tags en absoluto.
function passesFilters(spot: Spot, filters: QueryFilters): boolean {
  if (filters.requireDogsAllowed && spot.amenities?.dogsAllowed === false) return false;
  if (filters.excludeNaturist && spot.amenities?.naturist === true) return false;
  if (filters.requireNaturist && spot.amenities?.naturist !== true) return false;
  return true;
}

export async function registerQueryRoute(app: FastifyInstance) {
  app.post("/query", async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { text } = parsed.data;

    const intent = await parseQueryIntent(text);
    const area = await resolveLocality(intent.localityText);
    const localityCenter = { lat: area.lat, lon: area.lon };

    const allSpots = await findSpots(intent.sport, area.areaId, 12);
    const candidates = allSpots.filter((spot) => passesFilters(spot, intent.filters));

    if (candidates.length === 0) {
      const empty: QueryResponse = { intent, locality: area.displayName, localityCenter, spots: [] };
      return empty;
    }

    const coords = candidates.map((s) => ({ lat: s.lat, lon: s.lon }));
    const weatherSnapshots = await getWeatherSnapshots(coords);

    let scores: number[];
    let marineBySpot: MarineSnapshot[] | null = null;
    if (isWaterSport(intent.sport)) {
      marineBySpot = await getMarineSnapshots(coords);
      scores = candidates.map((_, i) => scoreWaterSport(intent.sport, weatherSnapshots[i], marineBySpot![i]));
    } else {
      scores = candidates.map((_, i) => scoreLandSport(intent.sport, weatherSnapshots[i]));
    }

    const rankingCandidates: RankingCandidate[] = candidates.map((spot, i) => ({
      spotId: spot.id,
      spotName: spot.name,
      score: scores[i],
      scoreBand: scoreBandFor(scores[i]),
      weather: weatherSnapshots[i],
      marine: marineBySpot?.[i],
      amenities: spot.amenities,
    }));

    const rankings = await rankSpots(text, intent.sport, rankingCandidates);

    const byId = new Map(candidates.map((spot, i) => [spot.id, { spot, score: scores[i] }]));
    const seen = new Set<string>();
    const rankedSpots: RankedSpot[] = [];

    for (const r of rankings) {
      const entry = byId.get(r.spotId);
      if (!entry) continue; // Claude no debería inventar ids, pero nos defendemos igual
      seen.add(r.spotId);
      rankedSpots.push({
        ...entry.spot,
        score: entry.score,
        scoreBand: scoreBandFor(entry.score),
        headline: r.headline,
        reasoning: r.reasoning,
      });
    }
    // Si Claude omitió algún candidato, se añade al final en vez de perderlo en silencio.
    for (const spot of candidates) {
      if (seen.has(spot.id)) continue;
      const score = byId.get(spot.id)!.score;
      rankedSpots.push({ ...spot, score, scoreBand: scoreBandFor(score), headline: spot.name, reasoning: "" });
    }

    const response: QueryResponse = { intent, locality: area.displayName, localityCenter, spots: rankedSpots };
    return response;
  });
}
