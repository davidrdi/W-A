import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/weather.js", () => ({ getWeatherSnapshots: vi.fn() }));
vi.mock("../services/marine.js", () => ({ getMarineSnapshots: vi.fn() }));

import { getMarineSnapshots } from "../services/marine.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { registerOverviewRoute } from "./overview.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 5,
  windMaxTodayKmh: 8,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 18,
};

describe("GET /overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pinta una zona por cada localidad precalculada que tenga running, sin pedir localidad", async () => {
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=running" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sport).toBe("running");
    expect(body.spots.length).toBeGreaterThan(5);
    // Cada zona lleva su localidad, para poder agruparlas o rotularlas.
    expect(body.spots.every((s: { locality: string }) => typeof s.locality === "string" && s.locality.length > 0)).toBe(
      true,
    );
    expect(body.spots.map((s: { locality: string }) => s.locality)).toContain("A Coruña, Galicia, España");
  });

  it("pide una sola llamada de meteo en lote, no una por zona", async () => {
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));

    const app = Fastify();
    await registerOverviewRoute(app);

    await app.inject({ method: "GET", url: "/overview?sport=running" });

    // El coste de la vista general está precisamente en que sea un solo lote.
    expect(getWeatherSnapshots).toHaveBeenCalledTimes(1);
  });

  it("para deportes de agua pide también datos marinos, y solo esos", async () => {
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));
    vi.mocked(getMarineSnapshots).mockImplementation(async (coords) =>
      coords.map(() => ({ waveHeightAvgM: 1, waveHeightMaxM: 1.3, seaSurfaceTempC: 19 })),
    );

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=playa" });

    expect(response.statusCode).toBe(200);
    expect(getMarineSnapshots).toHaveBeenCalledTimes(1);
    const body = response.json();
    expect(body.spots.map((s: { locality: string }) => s.locality)).toContain("A Coruña, Galicia, España");
  });

  it("no pide datos marinos para deportes de tierra", async () => {
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));

    const app = Fastify();
    await registerOverviewRoute(app);

    await app.inject({ method: "GET", url: "/overview?sport=senderismo" });

    expect(getMarineSnapshots).not.toHaveBeenCalled();
  });

  it("rechaza un deporte inválido", async () => {
    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=esqui" });

    expect(response.statusCode).toBe(400);
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
  });
});
