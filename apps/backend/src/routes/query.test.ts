import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/geocoding.js", () => ({ resolveLocality: vi.fn() }));
vi.mock("../services/spots.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/spots.js")>();
  return { ...actual, findSpots: vi.fn() };
});
// resolveZones (usada por /query vía zones.ts) intenta primero la tabla
// precalculada — vacía por defecto aquí, para que estos tests sigan
// probando la vía en vivo de findSpots sin necesitar Supabase.
vi.mock("../services/spotsRepo.js", () => ({ getSpotsNear: vi.fn().mockResolvedValue([]) }));
vi.mock("../services/weather.js", () => ({ getWeatherSnapshots: vi.fn() }));
vi.mock("../services/marine.js", () => ({ getMarineSnapshots: vi.fn() }));
vi.mock("../services/claude.js", () => ({ parseQueryIntent: vi.fn(), rankSpots: vi.fn() }));

import { parseQueryIntent, rankSpots } from "../services/claude.js";
import { resolveLocality } from "../services/geocoding.js";
import { getMarineSnapshots } from "../services/marine.js";
import { findSpots } from "../services/spots.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { registerQueryRoute } from "./query.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 8,
  windMaxTodayKmh: 12,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 16,
  cloudCoverTodayPct: 20,
};

const VIGO_AREA = { query: "Vigo", displayName: "Vigo, Galicia, España", areaId: 3_600_000_500, lat: 42.23, lon: -8.72 };

describe("POST /query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resuelve intención → geocoding → spots → scoring → ranking, en ese orden", async () => {
    vi.mocked(parseQueryIntent).mockResolvedValue({
      sport: "running",
      localityText: "Vigo",
      filters: {},
    });
    vi.mocked(resolveLocality).mockResolvedValue(VIGO_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Parque A", lat: 42.2, lon: -8.7, sport: "running" },
      { id: "way/2", name: "Parque B", lat: 42.25, lon: -8.75, sport: "running" },
    ]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY, CLEAR_DAY]);
    vi.mocked(rankSpots).mockResolvedValue([
      { spotId: "way/2", headline: "Mejor hoy", reasoning: "Zona más tranquila." },
      { spotId: "way/1", headline: "Segunda opción", reasoning: "Algo más transitada." },
    ]);

    const app = Fastify();
    await registerQueryRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/query",
      payload: { text: "quiero correr en Vigo" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.locality).toBe("Vigo, Galicia, España");
    expect(body.spots.map((s: { id: string }) => s.id)).toEqual(["way/2", "way/1"]);
    expect(body.spots[0].headline).toBe("Mejor hoy");
    expect(findSpots).toHaveBeenCalledWith("running", 3_600_000_500, 12);
    expect(getMarineSnapshots).not.toHaveBeenCalled();
  });

  it("para un deporte de agua, pide datos marinos antes de puntuar y rankear", async () => {
    vi.mocked(parseQueryIntent).mockResolvedValue({ sport: "surf", localityText: "Vigo", filters: {} });
    vi.mocked(resolveLocality).mockResolvedValue(VIGO_AREA);
    vi.mocked(findSpots).mockResolvedValue([{ id: "way/9", name: "Praia de Samil", lat: 42.21, lon: -8.77, sport: "surf" }]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([{ waveHeightAvgM: 1.1, waveHeightMaxM: 1.4, seaSurfaceTempC: 18 }]);
    vi.mocked(rankSpots).mockResolvedValue([{ spotId: "way/9", headline: "Buenas olas", reasoning: "Oleaje aprovechable." }]);

    const app = Fastify();
    await registerQueryRoute(app);

    const response = await app.inject({ method: "POST", url: "/query", payload: { text: "quiero hacer surf en Vigo" } });

    expect(response.statusCode).toBe(200);
    expect(getMarineSnapshots).toHaveBeenCalled();
    expect(rankSpots).toHaveBeenCalledWith(
      "quiero hacer surf en Vigo",
      "surf",
      expect.arrayContaining([expect.objectContaining({ marine: { waveHeightAvgM: 1.1, waveHeightMaxM: 1.4, seaSurfaceTempC: 18 } })]),
    );
  });

  it("filtra por amenidades antes de puntuar (ej. pide que se admitan perros)", async () => {
    vi.mocked(parseQueryIntent).mockResolvedValue({
      sport: "playa",
      localityText: "Vigo",
      filters: { requireDogsAllowed: true },
    });
    vi.mocked(resolveLocality).mockResolvedValue(VIGO_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Praia sin perros", lat: 42.2, lon: -8.7, sport: "playa", amenities: { dogsAllowed: false } },
      { id: "way/2", name: "Praia canina", lat: 42.21, lon: -8.71, sport: "playa", amenities: { dogsAllowed: true } },
    ]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([{ waveHeightAvgM: 0.3, waveHeightMaxM: 0.4, seaSurfaceTempC: 19 }]);
    vi.mocked(rankSpots).mockResolvedValue([{ spotId: "way/2", headline: "Admite perros", reasoning: "Playa canina habilitada." }]);

    const app = Fastify();
    await registerQueryRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/query",
      payload: { text: "playa en Vigo que admita perros" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.spots).toHaveLength(1);
    expect(body.spots[0].id).toBe("way/2");
    // Solo se pidió meteo/marino/ranking para el candidato que pasa el filtro.
    expect(getWeatherSnapshots).toHaveBeenCalledWith([{ lat: 42.21, lon: -8.71 }]);
  });

  it("devuelve una lista vacía sin llamar a Claude para rankear si el filtro deja 0 candidatos", async () => {
    vi.mocked(parseQueryIntent).mockResolvedValue({
      sport: "playa",
      localityText: "Vigo",
      filters: { requireNaturist: true },
    });
    vi.mocked(resolveLocality).mockResolvedValue(VIGO_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Praia normal", lat: 42.2, lon: -8.7, sport: "playa" },
    ]);

    const app = Fastify();
    await registerQueryRoute(app);

    const response = await app.inject({
      method: "POST",
      url: "/query",
      payload: { text: "playa nudista en Vigo" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().spots).toEqual([]);
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
    expect(rankSpots).not.toHaveBeenCalled();
  });

  it("si Claude omite un candidato en el ranking, se añade igualmente al final (no se pierde)", async () => {
    vi.mocked(parseQueryIntent).mockResolvedValue({ sport: "running", localityText: "Vigo", filters: {} });
    vi.mocked(resolveLocality).mockResolvedValue(VIGO_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Parque A", lat: 42.2, lon: -8.7, sport: "running" },
      { id: "way/2", name: "Parque B", lat: 42.21, lon: -8.71, sport: "running" },
    ]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY, CLEAR_DAY]);
    // Solo rankea way/1, omite way/2.
    vi.mocked(rankSpots).mockResolvedValue([{ spotId: "way/1", headline: "Ok", reasoning: "..." }]);

    const app = Fastify();
    await registerQueryRoute(app);

    const response = await app.inject({ method: "POST", url: "/query", payload: { text: "correr en Vigo" } });

    const ids = response.json().spots.map((s: { id: string }) => s.id);
    expect(ids).toEqual(["way/1", "way/2"]);
  });

  it("rechaza un texto demasiado corto", async () => {
    const app = Fastify();
    await registerQueryRoute(app);

    const response = await app.inject({ method: "POST", url: "/query", payload: { text: "a" } });

    expect(response.statusCode).toBe(400);
    expect(parseQueryIntent).not.toHaveBeenCalled();
  });
});
