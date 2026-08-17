import type { MarineSnapshot } from "@w-a/shared";
import { getOrSet, ONE_HOUR_MS } from "../lib/cache.js";

// Host distinto del forecast normal.
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

interface MarineHourly {
  time: string[];
  wave_height: (number | null)[];
  sea_surface_temperature: (number | null)[];
}

interface MarineResponse {
  hourly: MarineHourly;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export async function getMarineSnapshots(coords: { lat: number; lon: number }[]): Promise<MarineSnapshot[]> {
  if (coords.length === 0) return [];

  const cacheKey = `marine:${coords.map((c) => `${round(c.lat, 2)},${round(c.lon, 2)}`).join("|")}`;

  return getOrSet(cacheKey, ONE_HOUR_MS, async () => {
    const url = new URL(MARINE_URL);
    url.searchParams.set("latitude", coords.map((c) => c.lat).join(","));
    url.searchParams.set("longitude", coords.map((c) => c.lon).join(","));
    url.searchParams.set("hourly", "wave_height,sea_surface_temperature");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo Marine respondió ${res.status}`);
    }
    const data = (await res.json()) as MarineResponse | MarineResponse[];
    const entries = Array.isArray(data) ? data : [data];

    // Un punto de costa exacto a veces cae fuera de la malla marina (nulls);
    // se filtran en vez de propagar NaN — si no hay ningún dato, el score
    // de agua tratará 0 como "sin datos de oleaje" (ver scoring/rules.ts).
    return entries.map((entry): MarineSnapshot => {
      const waves = entry.hourly.wave_height.filter((v): v is number => v != null);
      const temps = entry.hourly.sea_surface_temperature.filter((v): v is number => v != null);

      return {
        waveHeightAvgM: round(average(waves), 2),
        waveHeightMaxM: round(waves.length ? Math.max(...waves) : 0, 2),
        seaSurfaceTempC: round(average(temps), 1),
      };
    });
  });
}
