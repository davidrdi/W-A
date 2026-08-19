import { afterEach, describe, expect, it, vi } from "vitest";
import { getWeatherSnapshots } from "./weather.js";

function hourlyFixture(dates: [string, string], rainByDate: [number, number]) {
  const time: string[] = [];
  const precipitation: number[] = [];
  const wind_speed_10m: number[] = [];
  const wind_direction_10m: number[] = [];
  const temperature_2m: number[] = [];

  dates.forEach((date, dayIndex) => {
    for (let hour = 0; hour < 24; hour++) {
      time.push(`${date}T${String(hour).padStart(2, "0")}:00`);
      // Reparte la lluvia del día en dos horas concretas para poder sumarla y verificarla.
      precipitation.push(hour === 8 || hour === 14 ? rainByDate[dayIndex] / 2 : 0);
      wind_speed_10m.push(10 + dayIndex);
      wind_direction_10m.push(90 + dayIndex * 10);
      temperature_2m.push(15 + dayIndex);
    }
  });

  return { time, precipitation, wind_speed_10m, wind_direction_10m, temperature_2m };
}

describe("getWeatherSnapshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("separa la lluvia de ayer de la de hoy usando las fechas locales de la propia respuesta", async () => {
    const hourly = hourlyFixture(["2026-08-16", "2026-08-17"], [12, 3]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hourly }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const [snapshot] = await getWeatherSnapshots([{ lat: 43.36, lon: -8.41 }]);

    expect(snapshot.rainYesterdayMm).toBe(12);
    expect(snapshot.rainTodayMm).toBe(3);
    expect(snapshot.windAvgTodayKmh).toBe(11);
    expect(snapshot.temperatureAvgTodayC).toBe(16);
  });

  it("devuelve un snapshot por cada coordenada cuando Open-Meteo responde con un array (batch)", async () => {
    const hourlyA = hourlyFixture(["2026-08-16", "2026-08-17"], [0, 0]);
    const hourlyB = hourlyFixture(["2026-08-16", "2026-08-17"], [20, 5]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ hourly: hourlyA }, { hourly: hourlyB }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshots = await getWeatherSnapshots([
      { lat: 43.36, lon: -8.41 },
      { lat: 42.2, lon: -8.72 },
    ]);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].rainYesterdayMm).toBe(0);
    expect(snapshots[1].rainYesterdayMm).toBe(20);
  });

  it("lanza un error legible si Open-Meteo responde con un status de error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );

    await expect(getWeatherSnapshots([{ lat: 1, lon: 1 }])).rejects.toThrow("Open-Meteo respondió 503");
  });

  it("trocea listas grandes en varias peticiones (una URL con miles de coordenadas no es viable)", async () => {
    const hourly = hourlyFixture(["2026-08-16", "2026-08-17"], [0, 0]);
    const fetchMock = vi.fn().mockImplementation(async (url: URL) => {
      // Cada petición devuelve tantos snapshots como coordenadas trajera (mismo patrón que Open-Meteo real).
      const n = url.searchParams.get("latitude")!.split(",").length;
      return { ok: true, json: async () => Array.from({ length: n }, () => ({ hourly })) };
    });
    vi.stubGlobal("fetch", fetchMock);

    // 250 coordenadas > el tamaño de lote (100): tienen que salir en 3 peticiones, no en una.
    const coords = Array.from({ length: 250 }, (_, i) => ({ lat: 40 + i * 0.001, lon: -3 - i * 0.001 }));
    const snapshots = await getWeatherSnapshots(coords);

    expect(snapshots).toHaveLength(250);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("la clave de caché de un lote nunca depende de cuántas coordenadas tenga (índice de Postgres acotado)", async () => {
    const hourly = hourlyFixture(["2026-08-16", "2026-08-17"], [0, 0]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: URL) => {
        const n = url.searchParams.get("latitude")!.split(",").length;
        return { ok: true, json: async () => Array.from({ length: n }, () => ({ hourly })) };
      }),
    );

    const coords = Array.from({ length: 100 }, (_, i) => ({ lat: 40 + i * 0.001, lon: -3 - i * 0.001 }));
    await getWeatherSnapshots(coords);

    // La caché en memoria (única forma de inspeccionarla desde aquí sin Supabase)
    // guarda claves cortas y con forma de hash, no la lista entera de coordenadas.
    const { __clearMemoryCache, __memoryKeys } = await import("../lib/cache.js");
    const keys = __memoryKeys();
    expect(keys.some((k) => k.startsWith("weather:") && k.length < 60)).toBe(true);
    __clearMemoryCache();
  });
});
