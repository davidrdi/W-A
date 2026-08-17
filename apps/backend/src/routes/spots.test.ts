import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/geocoding.js", () => ({
  resolveLocality: vi.fn(),
}));
vi.mock("../services/spots.js", () => ({
  findRunningSpots: vi.fn(),
}));
vi.mock("../services/weather.js", () => ({
  getWeatherSnapshots: vi.fn(),
}));

import { resolveLocality } from "../services/geocoding.js";
import { findRunningSpots } from "../services/spots.js";
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

describe("GET /spots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve score y banda por spot sin el desglose de meteo", async () => {
    vi.mocked(resolveLocality).mockResolvedValue({
      query: "A Coruña",
      displayName: "A Coruña, Galicia, España",
      areaId: 3_600_349_055,
      lat: 43.36,
      lon: -8.41,
    });
    vi.mocked(findRunningSpots).mockResolvedValue([
      { id: "way/1", name: "Parque de Santa Margarita", lat: 43.37, lon: -8.4, sport: "running" },
      { id: "way/2", name: "Sendero embarrado", lat: 43.38, lon: -8.42, sport: "running" },
    ]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY, MUDDY_DAY]);

    const app = Fastify();
    await registerSpotsRoute(app);

    const response = await app.inject({ method: "GET", url: "/spots?sport=running&locality=A%20Coru%C3%B1a" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.spots).toHaveLength(2);
    expect(body.spots[0]).toMatchObject({ id: "way/1", scoreBand: "green" });
    expect(body.spots[1]).toMatchObject({ id: "way/2", scoreBand: "red" });
    expect(body.spots[0].weather).toBeUndefined();
  });

  it("no llama a meteo/scoring si el área no tiene spots", async () => {
    vi.mocked(resolveLocality).mockResolvedValue({
      query: "Sin spots",
      displayName: "Sin spots",
      areaId: 1,
      lat: 0,
      lon: 0,
    });
    vi.mocked(findRunningSpots).mockResolvedValue([]);

    const app = Fastify();
    await registerSpotsRoute(app);

    const response = await app.inject({ method: "GET", url: "/spots?sport=running&locality=Sin%20spots" });

    expect(response.statusCode).toBe(200);
    expect(response.json().spots).toEqual([]);
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
  });
});
