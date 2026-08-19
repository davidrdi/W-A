import type { MarineSnapshot, TideEvent } from "@w-a/shared";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { getOrSet, hashKey, ONE_HOUR_MS } from "../lib/cache.js";

// Host distinto del forecast normal.
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

// Ver weather.ts: con listas grandes (todas las playas de España) una sola
// URL con miles de pares lat/lon supera límites prácticos de longitud.
const BATCH_SIZE = 100;
// Máximo de lotes en vuelo a la vez — ver mapWithConcurrency.
const BATCH_CONCURRENCY = 4;

interface MarineHourly {
  time: string[];
  wave_height: (number | null)[];
  sea_surface_temperature: (number | null)[];
  /** Nivel del mar sobre el nivel medio: la curva de marea. */
  sea_level_height_msl?: (number | null)[];
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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Saca pleamares y bajamares de la curva horaria de nivel del mar buscando
 * máximos y mínimos locales (un punto más alto —o más bajo— que sus dos
 * vecinos).
 *
 * Con datos horarios el instante exacto del pico tiene una incertidumbre de
 * ~1 h; sirve para orientar ("baja sobre las 14:00"), no para calcular una
 * tabla de mareas náutica. Si el punto no trae el dato (pasa en partes de la
 * malla marina), se devuelve vacío en vez de inventar horas.
 */
export function extractTides(hourly: MarineHourly): TideEvent[] {
  const levels = hourly.sea_level_height_msl;
  if (!levels || levels.length < 3) return [];

  const tides: TideEvent[] = [];
  for (let i = 1; i < levels.length - 1; i++) {
    const prev = levels[i - 1];
    const curr = levels[i];
    const next = levels[i + 1];
    if (prev == null || curr == null || next == null) continue;

    const isHigh = curr > prev && curr >= next;
    const isLow = curr < prev && curr <= next;
    if (!isHigh && !isLow) continue;

    tides.push({
      time: hourly.time[i],
      kind: isHigh ? "pleamar" : "bajamar",
      heightM: round(curr, 2),
    });
  }
  return tides;
}

async function fetchBatch(coords: { lat: number; lon: number }[]): Promise<MarineSnapshot[]> {
  const cacheKey = hashKey("marine", coords.map((c) => `${round(c.lat, 2)},${round(c.lon, 2)}`));

  return getOrSet(cacheKey, ONE_HOUR_MS, async () => {
    const url = new URL(MARINE_URL);
    url.searchParams.set("latitude", coords.map((c) => c.lat).join(","));
    url.searchParams.set("longitude", coords.map((c) => c.lon).join(","));
    // sea_level_height_msl es la curva de marea. Open-Meteo Marine no da
    // pleamares/bajamares ya calculadas, así que se derivan de sus máximos y
    // mínimos locales (ver extractTides).
    url.searchParams.set("hourly", "wave_height,sea_surface_temperature,sea_level_height_msl");
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
        tides: extractTides(entry.hourly),
      };
    });
  });
}

export async function getMarineSnapshots(coords: { lat: number; lon: number }[]): Promise<MarineSnapshot[]> {
  if (coords.length === 0) return [];

  const batches = await mapWithConcurrency(chunk(coords, BATCH_SIZE), BATCH_CONCURRENCY, fetchBatch);
  return batches.flat();
}
