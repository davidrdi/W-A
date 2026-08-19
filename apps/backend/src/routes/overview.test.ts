import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/weather.js", () => ({ getWeatherSnapshots: vi.fn() }));
vi.mock("../services/marine.js", () => ({ getMarineSnapshots: vi.fn() }));
vi.mock("../services/geocoding.js", () => ({ resolveLocality: vi.fn() }));
vi.mock("../services/spots.js", () => ({ findSpots: vi.fn() }));

import { resolveLocality } from "../services/geocoding.js";
import { getMarineSnapshots } from "../services/marine.js";
import { findSpots } from "../services/spots.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { registerOverviewRoute } from "./overview.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 5,
  windMaxTodayKmh: 8,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 18,
  cloudCoverTodayPct: 20,
};

const SPAIN_AREA = { query: "España", displayName: "España", areaId: 3_600_001_311, lat: 40.4, lon: -3.7 };

describe("GET /overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("para deportes en tierra, sigue usando el conjunto precalculado (zonas representativas, no exhaustivas)", async () => {
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=running" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.spots.length).toBeGreaterThan(5);
    expect(resolveLocality).not.toHaveBeenCalled();
    expect(findSpots).not.toHaveBeenCalled();
  });

  it("para playa, pide TODAS las playas de España en vivo vía findSpots con el área del país", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(SPAIN_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Playa Real 1", lat: 43.3, lon: -8.4, sport: "playa" },
      { id: "way/2", name: "Playa Real 2", lat: 42.2, lon: -8.7, sport: "playa" },
    ]);
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));
    vi.mocked(getMarineSnapshots).mockImplementation(async (coords) =>
      coords.map(() => ({ waveHeightAvgM: 1, waveHeightMaxM: 1.3, seaSurfaceTempC: 19 })),
    );

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=playa" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.spots.map((s: { name: string }) => s.name)).toEqual(["Playa Real 1", "Playa Real 2"]);
    // El límite pedido a findSpots tiene que ser alto: "todas", no una muestra.
    const [, areaId, limit] = vi.mocked(findSpots).mock.calls[0];
    expect(areaId).toBe(SPAIN_AREA.areaId);
    expect(limit).toBeGreaterThan(1000);
  });

  it("propaga las amenidades reales de OSM (nudismo, mascotas, socorrista) en la vista nacional de playas", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(SPAIN_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Praia Naturista", lat: 43.3, lon: -8.4, sport: "playa", amenities: { naturist: true, lifeguard: "yes" } },
    ]);
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));
    vi.mocked(getMarineSnapshots).mockImplementation(async (coords) =>
      coords.map(() => ({ waveHeightAvgM: 1, waveHeightMaxM: 1.3, seaSurfaceTempC: 19 })),
    );

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=playa" });

    expect(response.json().spots[0].amenities).toEqual({ naturist: true, lifeguard: "yes" });
  });

  it("si la vía en vivo de playas falla, cae a las zonas precalculadas en vez de dejar la vista vacía", async () => {
    vi.mocked(resolveLocality).mockRejectedValue(new Error("Nominatim respondió 429"));

    const app = Fastify();
    await registerOverviewRoute(app);
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));
    vi.mocked(getMarineSnapshots).mockImplementation(async (coords) =>
      coords.map(() => ({ waveHeightAvgM: 1, waveHeightMaxM: 1.3, seaSurfaceTempC: 19 })),
    );

    const response = await app.inject({ method: "GET", url: "/overview?sport=playa" });

    expect(response.statusCode).toBe(200);
    // Ya no son "todas las playas reales" sino las de arranque — pero sigue habiendo algo que pintar.
    expect(response.json().spots.length).toBeGreaterThan(0);
  });

  it("si findSpots devuelve vacío (Overpass sin resultados), también cae a las zonas precalculadas", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(SPAIN_AREA);
    vi.mocked(findSpots).mockResolvedValue([]);
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));
    vi.mocked(getMarineSnapshots).mockImplementation(async (coords) =>
      coords.map(() => ({ waveHeightAvgM: 1, waveHeightMaxM: 1.3, seaSurfaceTempC: 19 })),
    );

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=playa" });

    expect(response.statusCode).toBe(200);
    expect(response.json().spots.length).toBeGreaterThan(0);
  });

  it("rechaza un deporte inválido", async () => {
    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=esqui" });

    expect(response.statusCode).toBe(400);
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
  });
});
