import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/geocoding.js", () => ({
  resolveLocality: vi.fn(),
}));
vi.mock("../services/weather.js", () => ({
  getWeatherSnapshots: vi.fn(),
}));

import { resolveLocality } from "../services/geocoding.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { registerWeatherRoute } from "./weather.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 8,
  windMaxTodayKmh: 12,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 16,
  cloudCoverTodayPct: 20,
};

describe("GET /weather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acepta lat/lon directas sin geocodificar ni pasar por Overpass/Claude", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);

    const app = Fastify();
    await registerWeatherRoute(app);

    const response = await app.inject({ method: "GET", url: "/weather?lat=43.37&lon=-8.4" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual({ lat: 43.37, lon: -8.4, weather: CLEAR_DAY });
    expect(resolveLocality).not.toHaveBeenCalled();
  });

  it("geocodifica cuando se da una localidad en vez de coordenadas", async () => {
    vi.mocked(resolveLocality).mockResolvedValue({
      query: "A Coruña",
      displayName: "A Coruña, Galicia, España",
      areaId: 3_600_349_055,
      lat: 43.36,
      lon: -8.41,
    });
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);

    const app = Fastify();
    await registerWeatherRoute(app);

    const response = await app.inject({ method: "GET", url: "/weather?locality=A%20Coru%C3%B1a" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.locality).toBe("A Coruña, Galicia, España");
    expect(body.lat).toBe(43.36);
    expect(getWeatherSnapshots).toHaveBeenCalledWith([{ lat: 43.36, lon: -8.41 }]);
  });

  it("rechaza una petición sin coordenadas ni localidad", async () => {
    const app = Fastify();
    await registerWeatherRoute(app);

    const response = await app.inject({ method: "GET", url: "/weather" });

    expect(response.statusCode).toBe(400);
  });
});
