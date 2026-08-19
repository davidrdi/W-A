import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/weather.js", () => ({ getWeatherSnapshots: vi.fn() }));
vi.mock("../services/marine.js", () => ({ getMarineSnapshots: vi.fn() }));
vi.mock("../services/geocoding.js", () => ({ resolveLocality: vi.fn() }));
vi.mock("../services/spots.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/spots.js")>();
  return { ...actual, findSpots: vi.fn() };
});
vi.mock("../services/spotsRepo.js", () => ({ getSpotsByCategory: vi.fn() }));

import { resolveLocality } from "../services/geocoding.js";
import { getMarineSnapshots } from "../services/marine.js";
import { findSpots } from "../services/spots.js";
import { getSpotsByCategory } from "../services/spotsRepo.js";
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
    // Por defecto la tabla no tiene nada, para no repetir el mock en cada
    // test que solo quiere probar las vías de emergencia.
    vi.mocked(getSpotsByCategory).mockResolvedValue([]);
  });

  it("lee la tabla precalculada para cualquier deporte, sin tocar Overpass ni Nominatim", async () => {
    vi.mocked(getSpotsByCategory).mockResolvedValue([
      { id: "seed/parque-1", category: "urbanPath", name: "Parque de la tabla", lat: 43.36, lon: -8.41, source: "seed" },
    ]);
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=running" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.spots).toHaveLength(1);
    expect(body.spots[0].name).toBe("Parque de la tabla");
    expect(resolveLocality).not.toHaveBeenCalled();
    expect(findSpots).not.toHaveBeenCalled();
  });

  it("para playa, la tabla ya trae todas las playas de España precalculadas", async () => {
    vi.mocked(getSpotsByCategory).mockResolvedValue([
      { id: "way/1", category: "beach", name: "Playa Real 1", lat: 43.3, lon: -8.4, source: "osm" },
      { id: "way/2", category: "beach", name: "Playa Real 2", lat: 42.2, lon: -8.7, source: "osm" },
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
    expect(resolveLocality).not.toHaveBeenCalled();
  });

  it("propaga las amenidades reales de OSM (nudismo, mascotas, socorrista) desde la tabla", async () => {
    vi.mocked(getSpotsByCategory).mockResolvedValue([
      {
        id: "way/1",
        category: "beach",
        name: "Praia Naturista",
        lat: 43.3,
        lon: -8.4,
        source: "osm",
        amenities: { naturist: true, lifeguard: "yes" },
      },
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

  it("si la tabla está vacía, cae a playas de OSM en vivo antes que a las zonas de arranque", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(SPAIN_AREA);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Playa Real 1", lat: 43.3, lon: -8.4, sport: "playa" },
    ]);
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));
    vi.mocked(getMarineSnapshots).mockImplementation(async (coords) =>
      coords.map(() => ({ waveHeightAvgM: 1, waveHeightMaxM: 1.3, seaSurfaceTempC: 19 })),
    );

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=playa" });

    expect(response.statusCode).toBe(200);
    expect(response.json().spots.map((s: { name: string }) => s.name)).toEqual(["Playa Real 1"]);
  });

  it("si ni la tabla ni la vía en vivo de playas responden, cae a las zonas precalculadas", async () => {
    vi.mocked(resolveLocality).mockRejectedValue(new Error("Nominatim respondió 429"));
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));
    vi.mocked(getMarineSnapshots).mockImplementation(async (coords) =>
      coords.map(() => ({ waveHeightAvgM: 1, waveHeightMaxM: 1.3, seaSurfaceTempC: 19 })),
    );

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=playa" });

    expect(response.statusCode).toBe(200);
    // Ya no son "todas las playas reales" sino las de arranque — pero sigue habiendo algo que pintar.
    expect(response.json().spots.length).toBeGreaterThan(0);
  });

  it("si tabla, Overpass y España resuelven vacío, también cae a las zonas precalculadas", async () => {
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

  it("para deportes de tierra, si la tabla está vacía, cae directo a las zonas de arranque (sin vía en vivo nacional)", async () => {
    vi.mocked(getWeatherSnapshots).mockImplementation(async (coords) => coords.map(() => CLEAR_DAY));

    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=running" });

    expect(response.statusCode).toBe(200);
    expect(response.json().spots.length).toBeGreaterThan(5);
    expect(resolveLocality).not.toHaveBeenCalled();
    expect(findSpots).not.toHaveBeenCalled();
  });

  it("rechaza un deporte inválido", async () => {
    const app = Fastify();
    await registerOverviewRoute(app);

    const response = await app.inject({ method: "GET", url: "/overview?sport=esqui" });

    expect(response.statusCode).toBe(400);
    expect(getWeatherSnapshots).not.toHaveBeenCalled();
  });
});
