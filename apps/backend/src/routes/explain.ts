import type { FastifyInstance } from "fastify";
import type { AlternativesResponse, FollowUpResponse, SpotExplanation, SpotGroundingPayload } from "@w-a/shared";
import { distanceKm } from "@w-a/shared";
import { z } from "zod";

import { SPORT_VALUES, isWaterSport } from "../lib/sport.js";
import { askFollowUp, recommendAlternatives, type AlternativeCandidate } from "../services/claude.js";
import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { explainLandSport, explainWaterSport } from "../scoring/rules.js";

// El score lo decide SIEMPRE el backend (scoring/rules.ts) — a Claude solo
// se le pide que explique en palabras un score que ya viene calculado,
// nunca que lo ponga.
const amenitiesSchema = z.object({
  naturist: z.boolean().optional(),
  dogsAllowed: z.boolean().optional(),
});

// spotId/lat/lon vienen del spot ya listado por /spots — las amenidades
// también, para no tener que re-consultar Overpass solo para leer dos tags.
const explainSchema = z.object({
  sport: z.enum(SPORT_VALUES),
  spotId: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
  amenities: amenitiesSchema.optional(),
});

const weatherSchema = z.object({
  rainYesterdayMm: z.number(),
  rainTodayMm: z.number(),
  windAvgTodayKmh: z.number(),
  windMaxTodayKmh: z.number(),
  windDirectionMiddayDeg: z.number(),
  temperatureAvgTodayC: z.number(),
});

const marineSchema = z.object({
  waveHeightAvgM: z.number(),
  waveHeightMaxM: z.number(),
  seaSurfaceTempC: z.number(),
});

const groundingPayloadSchema = z.object({
  sport: z.enum(SPORT_VALUES),
  spotName: z.string(),
  score: z.number(),
  scoreBand: z.enum(["green", "amber", "red"]),
  weather: weatherSchema,
  marine: marineSchema.optional(),
  amenities: amenitiesSchema.optional(),
});

const alternativesSchema = z.object({
  selected: z.object({
    sport: z.enum(SPORT_VALUES),
    spotId: z.string().min(1),
    name: z.string().min(1),
    lat: z.number(),
    lon: z.number(),
  }),
  // Las zonas candidatas las manda el cliente: ya las tiene del mapa, así que
  // no hace falta volver a consultar Overpass para compararlas.
  nearby: z
    .array(z.object({ spotId: z.string().min(1), name: z.string().min(1), lat: z.number(), lon: z.number() }))
    .max(20),
});

const followUpSchema = z.object({
  groundingPayload: groundingPayloadSchema,
  priorMessages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  question: z.string().min(1),
});

export async function registerExplainRoute(app: FastifyInstance) {
  app.post("/explain", async (request, reply) => {
    const parsed = explainSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport, name, lat, lon, amenities } = parsed.data;

    const [weather] = await getWeatherSnapshots([{ lat, lon }]);

    // El diagnóstico sale del scoring determinista, no de la IA: es
    // instantáneo, no cuesta nada y está disponible siempre. La IA solo
    // entra bajo demanda en /explain/alternatives.
    let breakdown;
    let groundingPayload: SpotGroundingPayload;
    if (isWaterSport(sport)) {
      const [marine] = await getMarineSnapshots([{ lat, lon }]);
      breakdown = explainWaterSport(sport, weather, marine);
      groundingPayload = {
        sport,
        spotName: name,
        score: breakdown.score,
        scoreBand: breakdown.scoreBand,
        weather,
        marine,
        amenities,
      };
    } else {
      breakdown = explainLandSport(sport, weather);
      groundingPayload = {
        sport,
        spotName: name,
        score: breakdown.score,
        scoreBand: breakdown.scoreBand,
        weather,
        amenities,
      };
    }

    const response: SpotExplanation = {
      score: breakdown.score,
      scoreBand: breakdown.scoreBand,
      headline: breakdown.headline,
      factors: breakdown.factors,
      groundingPayload,
    };
    return response;
  });

  // Función premium: la IA mira la zona elegida y las de alrededor y dice a
  // cuál ir en su lugar. Aparte de /explain a propósito — la ficha de la zona
  // tiene que seguir funcionando sin IA, sin suscripción y sin saldo de API.
  app.post("/explain/alternatives", async (request, reply) => {
    const parsed = alternativesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { selected, nearby } = parsed.data;

    const others = nearby.filter((spot) => spot.spotId !== selected.spotId);
    if (others.length === 0) {
      const empty: AlternativesResponse = { verdict: "No hay otras zonas cargadas con las que comparar.", alternatives: [] };
      return empty;
    }

    const coords = others.map((s) => ({ lat: s.lat, lon: s.lon }));
    const weatherSnapshots = await getWeatherSnapshots(coords);
    const water = isWaterSport(selected.sport);
    const marineSnapshots = water ? await getMarineSnapshots(coords) : null;

    const candidates: AlternativeCandidate[] = others.map((spot, i) => {
      const breakdown = water
        ? explainWaterSport(selected.sport, weatherSnapshots[i], marineSnapshots![i])
        : explainLandSport(selected.sport, weatherSnapshots[i]);
      return {
        spotId: spot.spotId,
        spotName: spot.name,
        score: breakdown.score,
        distanceKm: Math.round(distanceKm(selected, { lat: spot.lat, lon: spot.lon }) * 10) / 10,
        weather: weatherSnapshots[i],
        marine: marineSnapshots?.[i],
      };
    });

    const [selectedWeather] = await getWeatherSnapshots([{ lat: selected.lat, lon: selected.lon }]);
    const selectedMarine = water ? (await getMarineSnapshots([{ lat: selected.lat, lon: selected.lon }]))[0] : undefined;
    const selectedBreakdown = water
      ? explainWaterSport(selected.sport, selectedWeather, selectedMarine!)
      : explainLandSport(selected.sport, selectedWeather);

    const result = await recommendAlternatives(
      {
        sport: selected.sport,
        spotName: selected.name,
        score: selectedBreakdown.score,
        scoreBand: selectedBreakdown.scoreBand,
        weather: selectedWeather,
        marine: selectedMarine,
      },
      candidates,
    );

    const byId = new Map(candidates.map((c) => [c.spotId, c]));
    const response: AlternativesResponse = {
      verdict: result.verdict,
      alternatives: result.alternatives.map((a) => {
        const candidate = byId.get(a.spotId)!;
        return {
          spotId: a.spotId,
          name: candidate.spotName,
          score: candidate.score,
          distanceKm: candidate.distanceKm,
          why: a.why,
        };
      }),
    };
    return response;
  });

  app.post("/explain/followup", async (request, reply) => {
    const parsed = followUpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { groundingPayload, priorMessages, question } = parsed.data;

    const answer = await askFollowUp(groundingPayload, priorMessages, question);
    const response: FollowUpResponse = { answer };
    return response;
  });
}
