import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/zones.js", () => ({
  resolveZones: vi.fn(),
}));
vi.mock("../services/weather.js", () => ({
  getWeatherSnapshots: vi.fn(),
}));
vi.mock("../services/marine.js", () => ({
  getMarineSnapshots: vi.fn(),
}));

import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { resolveZones } from "../services/zones.js";
import { registerRecommendRoute } from "./recommend.js";

const weatherFixture = {
  rainYesterdayMm: 5,
  rainTodayMm: 0,
  windAvgTodayKmh: 12,
  windMaxTodayKmh: 20,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 18,
  cloudCoverTodayPct: 20,
};

describe("GET /recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa las zonas resueltas (tabla precalculada, en vivo o de arranque) igual que /spots y /query", async () => {
    vi.mocked(resolveZones).mockResolvedValue({
      locality: "A Coruña, Galicia, España",
      localityCenter: { lat: 43.36, lon: -8.41 },
      spots: [{ id: "way/1", name: "Parque de Santa Margarita", lat: 43.37, lon: -8.4, sport: "running" }],
      source: "db",
    });
    vi.mocked(getWeatherSnapshots).mockResolvedValue([weatherFixture]);

    const app = Fastify();
    await registerRecommendRoute(app);

    const response = await app.inject({ method: "GET", url: "/recommend?sport=running&locality=A%20Coru%C3%B1a" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.locality).toBe("A Coruña, Galicia, España");
    expect(body.localityCenter).toEqual({ lat: 43.36, lon: -8.41 });
    expect(body.spots).toHaveLength(1);
    expect(body.spots[0].weather).toEqual(weatherFixture);
    expect(body.spots[0].marine).toBeUndefined();

    expect(resolveZones).toHaveBeenCalledWith("running", "A Coruña", 8);
    expect(getMarineSnapshots).not.toHaveBeenCalled();
  });

  it("para un deporte de agua incluye también el desglose marino por spot", async () => {
    vi.mocked(resolveZones).mockResolvedValue({
      locality: "Vigo, Galicia, España",
      localityCenter: { lat: 42.23, lon: -8.72 },
      spots: [{ id: "way/5", name: "Praia de Samil", lat: 42.21, lon: -8.77, sport: "windsurf" }],
      source: "db",
    });
    vi.mocked(getWeatherSnapshots).mockResolvedValue([weatherFixture]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([
      { waveHeightAvgM: 0.6, waveHeightMaxM: 0.9, seaSurfaceTempC: 17 },
    ]);

    const app = Fastify();
    await registerRecommendRoute(app);

    const response = await app.inject({ method: "GET", url: "/recommend?sport=windsurf&locality=Vigo" });

    expect(response.statusCode).toBe(200);
    expect(response.json().spots[0].marine).toEqual({ waveHeightAvgM: 0.6, waveHeightMaxM: 0.9, seaSurfaceTempC: 17 });
  });

  it("devuelve una lista vacía sin llamar a meteo si no hay spots en el área", async () => {
    vi.mocked(resolveZones).mockResolvedValue({
      locality: "Localidad sin spots",
      localityCenter: { lat: 0, lon: 0 },
      spots: [],
      source: "osm",
    });

    const app = Fastify();
    await registerRecommendRoute(app);

    const response = await app.inject({
      method: "GET",
      url: "/recommend?sport=running&locality=Localidad%20sin%20spots",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().spots).toEqual([]);
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
  });

  it("rechaza un deporte desconocido", async () => {
    const app = Fastify();
    await registerRecommendRoute(app);

    const response = await app.inject({ method: "GET", url: "/recommend?sport=futbol&locality=Vigo" });

    expect(response.statusCode).toBe(400);
  });

  it("exige el parámetro locality", async () => {
    const app = Fastify();
    await registerRecommendRoute(app);

    const response = await app.inject({ method: "GET", url: "/recommend?sport=running" });

    expect(response.statusCode).toBe(400);
  });
});
