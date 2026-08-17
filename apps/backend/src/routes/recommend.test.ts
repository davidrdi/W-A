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
import { registerRecommendRoute } from "./recommend.js";

const weatherFixture = {
  rainYesterdayMm: 5,
  rainTodayMm: 0,
  windAvgTodayKmh: 12,
  windMaxTodayKmh: 20,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 18,
};

describe("GET /recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("solo devuelve spots dentro del área resuelta por geocoding (no cuela municipios vecinos)", async () => {
    vi.mocked(resolveLocality).mockResolvedValue({
      query: "A Coruña",
      displayName: "A Coruña, Galicia, España",
      areaId: 3_600_349_055,
      lat: 43.36,
      lon: -8.41,
    });
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Parque de Santa Margarita", lat: 43.37, lon: -8.4, sport: "running" },
    ]);
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

    // El área pasada a Overpass es la resuelta por geocoding, no un radio libre.
    expect(findSpots).toHaveBeenCalledWith("running", 3_600_349_055);
    expect(getMarineSnapshots).not.toHaveBeenCalled();
  });

  it("para un deporte de agua incluye también el desglose marino por spot", async () => {
    vi.mocked(resolveLocality).mockResolvedValue({
      query: "Vigo",
      displayName: "Vigo, Galicia, España",
      areaId: 3_600_000_500,
      lat: 42.23,
      lon: -8.72,
    });
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/5", name: "Praia de Samil", lat: 42.21, lon: -8.77, sport: "windsurf" },
    ]);
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
    vi.mocked(resolveLocality).mockResolvedValue({
      query: "Localidad sin spots",
      displayName: "Localidad sin spots",
      areaId: 3_600_000_999,
      lat: 0,
      lon: 0,
    });
    vi.mocked(findSpots).mockResolvedValue([]);

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
