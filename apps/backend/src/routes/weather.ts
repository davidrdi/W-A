import type { FastifyInstance } from "fastify";
import type { WeatherResponse } from "@w-a/shared";
import { z } from "zod";

import { resolveLocality } from "../services/geocoding.js";
import { getWeatherSnapshots } from "../services/weather.js";

// Consulta general del tiempo: solo Open-Meteo, sin Overpass ni Claude — no
// hay "zona" que recomendar, es solo tiempo (hoy + ayer). Acepta lat/lon
// directas o el nombre de una localidad (se geocodifica igual que en
// /spots y /recommend, reutilizando resolveLocality).
const byCoords = z.object({ lat: z.coerce.number(), lon: z.coerce.number() });
const byLocality = z.object({ locality: z.string().min(2) });
const querySchema = z.union([byCoords, byLocality]);

export async function registerWeatherRoute(app: FastifyInstance) {
  app.get("/weather", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parámetros inválidos", details: parsed.error.flatten() });
    }

    let lat: number;
    let lon: number;
    let locality: string | undefined;

    if ("locality" in parsed.data) {
      const area = await resolveLocality(parsed.data.locality);
      lat = area.lat;
      lon = area.lon;
      locality = area.displayName;
    } else {
      ({ lat, lon } = parsed.data);
    }

    const [weather] = await getWeatherSnapshots([{ lat, lon }]);

    const response: WeatherResponse = { lat, lon, locality, weather };
    return response;
  });
}
