import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/weather.js", () => ({ getWeatherSnapshots: vi.fn() }));
vi.mock("../services/marine.js", () => ({ getMarineSnapshots: vi.fn() }));

import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { registerSpotScoresRoute } from "./spotScores.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 8,
  windMaxTodayKmh: 12,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 27,
};

describe("GET /spot-scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("para un deporte de tierra en grupo (running), puntúa running Y paseo con una sola llamada a meteo", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);

    const app = Fastify();
    await registerSpotScoresRoute(app);

    const response = await app.inject({ method: "GET", url: "/spot-scores?sport=running&lat=43.37&lon=-8.4" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.scores.map((s: { sport: string }) => s.sport).sort()).toEqual(["paseo", "running"]);
    expect(getWeatherSnapshots).toHaveBeenCalledTimes(1);
    expect(getMarineSnapshots).not.toHaveBeenCalled();
  });

  it("para un deporte de agua (playa), puntúa playa/surf/windsurf con una sola llamada a meteo y marino", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([{ waveHeightAvgM: 1.2, waveHeightMaxM: 1.5, seaSurfaceTempC: 19 }]);

    const app = Fastify();
    await registerSpotScoresRoute(app);

    const response = await app.inject({ method: "GET", url: "/spot-scores?sport=playa&lat=43.37&lon=-8.4" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.scores.map((s: { sport: string }) => s.sport).sort()).toEqual(["playa", "surf", "windsurf"]);
    expect(getWeatherSnapshots).toHaveBeenCalledTimes(1);
    expect(getMarineSnapshots).toHaveBeenCalledTimes(1);
  });

  it("un deporte sin grupo (senderismo) devuelve solo ese deporte", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);

    const app = Fastify();
    await registerSpotScoresRoute(app);

    const response = await app.inject({ method: "GET", url: "/spot-scores?sport=senderismo&lat=1&lon=1" });

    expect(response.json().scores.map((s: { sport: string }) => s.sport)).toEqual(["senderismo"]);
  });

  it("rechaza sin coordenadas", async () => {
    const app = Fastify();
    await registerSpotScoresRoute(app);

    const response = await app.inject({ method: "GET", url: "/spot-scores?sport=running" });

    expect(response.statusCode).toBe(400);
  });
});
