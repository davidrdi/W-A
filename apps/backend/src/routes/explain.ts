import type { FastifyInstance } from "fastify";
import type { FollowUpResponse, SpotExplanation, SpotGroundingPayload } from "@w-a/shared";
import { z } from "zod";

import { SPORT_VALUES, isWaterSport } from "../lib/sport.js";
import { askFollowUp, explainSpot } from "../services/claude.js";
import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport } from "../scoring/rules.js";

// El score lo decide SIEMPRE el backend (scoring/rules.ts) — a Claude solo
// se le pide que explique en palabras un score que ya viene calculado,
// nunca que lo ponga.
const explainSchema = z.object({
  sport: z.enum(SPORT_VALUES),
  spotId: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
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
    const { sport, name, lat, lon } = parsed.data;

    const [weather] = await getWeatherSnapshots([{ lat, lon }]);

    let groundingPayload: SpotGroundingPayload;
    if (isWaterSport(sport)) {
      const [marine] = await getMarineSnapshots([{ lat, lon }]);
      const score = scoreWaterSport(sport, weather, marine);
      groundingPayload = { sport, spotName: name, score, scoreBand: scoreBandFor(score), weather, marine };
    } else {
      const score = scoreLandSport(sport, weather);
      groundingPayload = { sport, spotName: name, score, scoreBand: scoreBandFor(score), weather };
    }

    const explanation = await explainSpot(groundingPayload);

    const response: SpotExplanation = {
      score: groundingPayload.score,
      scoreBand: groundingPayload.scoreBand,
      ...explanation,
      groundingPayload,
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
