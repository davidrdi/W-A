import type { WeatherSnapshot } from "@w-a/shared";
import { getOrSet, hashKey, ONE_HOUR_MS } from "../lib/cache.js";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// Con listas grandes (p.ej. TODAS las playas de España para la vista general)
// una sola URL con miles de pares lat/lon supera límites prácticos de
// longitud de muchos servidores/proxies intermedios. Se trocea en lotes
// razonables y cada lote se pide (y cachea) por separado.
const BATCH_SIZE = 100;

interface OpenMeteoHourly {
  time: string[];
  precipitation: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  temperature_2m: number[];
}

interface OpenMeteoResponse {
  hourly: OpenMeteoHourly;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// Agrupa por fecha usando el propio timestamp local que devuelve la API
// (timezone=auto) en vez del reloj del proceso, para no arrastrar bugs de
// zona horaria al separar "ayer" de "hoy".
function daySummary(hourly: OpenMeteoHourly, date: string) {
  const indices = hourly.time.reduce<number[]>((acc, t, i) => {
    if (t.startsWith(date)) acc.push(i);
    return acc;
  }, []);
  const rain = indices.reduce((sum, i) => sum + (hourly.precipitation[i] ?? 0), 0);
  const winds = indices.map((i) => hourly.wind_speed_10m[i] ?? 0);
  const temps = indices.map((i) => hourly.temperature_2m[i] ?? 0);
  const middayIndex = indices[Math.min(12, indices.length - 1)] ?? indices[0];

  return {
    rainMm: round(rain, 1),
    windAvgKmh: round(winds.reduce((a, b) => a + b, 0) / (winds.length || 1), 1),
    windMaxKmh: round(Math.max(0, ...winds), 1),
    windDirectionDeg: middayIndex !== undefined ? Math.round(hourly.wind_direction_10m[middayIndex] ?? 0) : 0,
    temperatureAvgC: round(temps.reduce((a, b) => a + b, 0) / (temps.length || 1), 1),
  };
}

async function fetchBatch(coords: { lat: number; lon: number }[]): Promise<WeatherSnapshot[]> {
  const cacheKey = hashKey("weather", coords.map((c) => `${round(c.lat, 2)},${round(c.lon, 2)}`));

  return getOrSet(cacheKey, ONE_HOUR_MS, async () => {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set("latitude", coords.map((c) => c.lat).join(","));
    url.searchParams.set("longitude", coords.map((c) => c.lon).join(","));
    url.searchParams.set("hourly", "precipitation,wind_speed_10m,wind_direction_10m,temperature_2m");
    url.searchParams.set("past_days", "1");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo respondió ${res.status}`);
    }
    const data = (await res.json()) as OpenMeteoResponse | OpenMeteoResponse[];
    const entries = Array.isArray(data) ? data : [data];

    return entries.map((entry): WeatherSnapshot => {
      const dates = [...new Set(entry.hourly.time.map((t) => t.slice(0, 10)))].sort();
      const [yesterday, today] = dates;
      const y = daySummary(entry.hourly, yesterday);
      const t = daySummary(entry.hourly, today ?? yesterday);

      return {
        rainYesterdayMm: y.rainMm,
        rainTodayMm: t.rainMm,
        windAvgTodayKmh: t.windAvgKmh,
        windMaxTodayKmh: t.windMaxKmh,
        windDirectionMiddayDeg: t.windDirectionDeg,
        temperatureAvgTodayC: t.temperatureAvgC,
      };
    });
  });
}

export async function getWeatherSnapshots(coords: { lat: number; lon: number }[]): Promise<WeatherSnapshot[]> {
  if (coords.length === 0) return [];

  const batches = await Promise.all(chunk(coords, BATCH_SIZE).map(fetchBatch));
  return batches.flat();
}
