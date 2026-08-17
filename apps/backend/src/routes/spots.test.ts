import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/geocoding.js", () => ({
  resolveLocality: vi.fn(),
}));
vi.mock("../services/spots.js", () => ({
  findSpots: vi.fn(),
}));
vi.mock("../services/weather.js", () => ({
  getWeatherSnapshots: vi.fn(),
}));
vi.mock("../services/marine.js", () => ({
  getMarineSnapshots: vi.fn(),
}));

import { resolveLocality } from "../services/geocoding.js";
import { getMarineSnapshots } from "../services/marine.js";
import { findSpots } from "../services/spots.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { registerSpotsRoute } from "./spots.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 8,
  windMaxTodayKmh: 12,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 16,
};

const MUDDY_DAY = { ...CLEAR_DAY, rainYesterdayMm: 30, rainTodayMm: 20 };

const CORUNA_AREA = {
  query: "A Coruña",
  displayName: "A Coruña, Galicia, España",
  areaId: 3_600_349_055,
  lat: 43.36,
  lon: -8.41,
};

describe("GET /spots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve score y banda por spot sin el desglose de meteo (deporte de tierra)", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(CORUNA_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Parque de Santa Margarita", lat: 43.37, lon: -8.4, sport: "running" },
      { id: "way/2", name: "Sendero embarrado", lat: 43.38, lon: -8.42, sport: "running" },
    ]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY, MUDDY_DAY]);

    const app = Fastify();
    await registerSpotsRoute(app);

    const response = await app.inject({ method: "GET", url: "/spots?sport=running&locality=A%20Coru%C3%B1a" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.localityCenter).toEqual({ lat: 43.36, lon: -8.41 });
    expect(body.spots).toHaveLength(2);
    expect(body.spots[0]).toMatchObject({ id: "way/1", scoreBand: "green" });
    expect(body.spots[1]).toMatchObject({ id: "way/2", scoreBand: "red" });
    expect(body.spots[0].weather).toBeUndefined();
    expect(getMarineSnapshots).not.toHaveBeenCalled();
  });

  it("para un deporte de agua, pide también datos marinos y los usa en el score", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(CORUNA_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/9", name: "Praia de Riazor", lat: 43.37, lon: -8.41, sport: "surf" },
    ]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([
      { waveHeightAvgM: 1.2, waveHeightMaxM: 1.5, seaSurfaceTempC: 18 },
    ]);

    const app = Fastify();
    await registerSpotsRoute(app);

    const response = await app.inject({ method: "GET", url: "/spots?sport=surf&locality=A%20Coru%C3%B1a" });

    expect(response.statusCode).toBe(200);
    expect(getMarineSnapshots).toHaveBeenCalledWith([{ lat: 43.37, lon: -8.41 }]);
    expect(response.json().spots[0].sport).toBe("surf");
  });

  it("no llama a meteo/scoring si el área no tiene spots", async () => {
    vi.mocked(resolveLocality).mockResolvedValue({
      query: "Sin spots",
      displayName: "Sin spots",
      areaId: 1,
      lat: 0,
      lon: 0,
    });
    vi.mocked(findSpots).mockResolvedValue([]);

    const app = Fastify();
    await registerSpotsRoute(app);

    const response = await app.inject({ method: "GET", url: "/spots?sport=running&locality=Sin%20spots" });

    expect(response.statusCode).toBe(200);
    expect(response.json().spots).toEqual([]);
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
  });

  it("rechaza un deporte desconocido", async () => {
    const app = Fastify();
    await registerSpotsRoute(app);

    const response = await app.inject({ method: "GET", url: "/spots?sport=futbol&locality=Vigo" });

    expect(response.statusCode).toBe(400);
  });
});
