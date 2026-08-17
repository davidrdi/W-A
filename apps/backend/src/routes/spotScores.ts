import type { FastifyInstance } from "fastify";
import type { SportScore, SpotScoresResponse } from "@w-a/shared";
import { sportsInSameGroup } from "@w-a/shared";
import { z } from "zod";

import { SPORT_VALUES, isWaterSport } from "../lib/sport.js";
import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { scoreBandFor, scoreLandSport, scoreWaterSport } from "../scoring/rules.js";

// Para un punto dado, puntúa TODOS los deportes que tiene sentido practicar
// ahí (el grupo del deporte pedido — ej. una playa sirve para
// playa/surf/windsurf) con una sola llamada a meteo/marino, no una por
// deporte. Pensado para los anillos de score del modal de detalle.
const querySchema = z.object({
  sport: z.enum(SPORT_VALUES),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
});

export async function registerSpotScoresRoute(app: FastifyInstance) {
  app.get("/spot-scores", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }
    const { sport, lat, lon } = parsed.data;
    const group = sportsInSameGroup(sport);

    const [weather] = await getWeatherSnapshots([{ lat, lon }]);
    const marine = group.some((s) => isWaterSport(s)) ? (await getMarineSnapshots([{ lat, lon }]))[0] : undefined;

    const scores: SportScore[] = group.map((groupSport) => {
      const score = isWaterSport(groupSport)
        ? scoreWaterSport(groupSport, weather, marine!)
        : scoreLandSport(groupSport, weather);
      return { sport: groupSport, score, scoreBand: scoreBandFor(score) };
    });

    const response: SpotScoresResponse = { scores };
    return response;
  });
}
