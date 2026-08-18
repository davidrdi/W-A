import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/zones.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/zones.js")>();
  return { ...actual, findZonesInBbox: vi.fn(), findBeachesInBbox: vi.fn() };
});
vi.mock("../services/spots.js", () => ({ findSpots: vi.fn(), findSpotsAround: vi.fn() }));
vi.mock("../services/weather.js", () => ({ getWeatherSnapshots: vi.fn() }));
vi.mock("../services/marine.js", () => ({ getMarineSnapshots: vi.fn() }));
vi.mock("../services/geocoding.js", () => ({ resolveLocality: vi.fn() }));

import { getMarineSnapshots } from "../services/marine.js";
import { findSpots, findSpotsAround } from "../services/spots.js";
import { getWeatherSnapshots } from "../services/weather.js";
import { findBeachesInBbox, findZonesInBbox } from "../services/zones.js";
import { registerZonesRoute } from "./zones.js";

const CLEAR_DAY = {
  rainYesterdayMm: 0,
  rainTodayMm: 0,
  windAvgTodayKmh: 8,
  windMaxTodayKmh: 12,
  windDirectionMiddayDeg: 90,
  temperatureAvgTodayC: 16,
};

const STORM_DAY = { ...CLEAR_DAY, rainTodayMm: 15, windMaxTodayKmh: 55 };
const BEACH_DAY = { ...CLEAR_DAY, temperatureAvgTodayC: 26 };

const CALM_SEA = { waveHeightAvgM: 0.5, waveHeightMaxM: 0.9, seaSurfaceTempC: 20 };
const NO_SEA_DATA = { waveHeightAvgM: 0, waveHeightMaxM: 0, seaSurfaceTempC: 0 };

async function buildApp() {
  const app = Fastify();
  await registerZonesRoute(app);
  return app;
}

describe("GET /zones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con poco zoom devuelve un chip por provincia visible, puntuada con la regla de tierra", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY, STORM_DAY]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones?mode=tierra&zoom=6&south=42.9&west=-8.8&north=43.5&east=-7.2",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.level).toBe("provincia");
    expect(body.zones.map((z: { name: string }) => z.name)).toEqual(["A Coruña", "Lugo"]);
    expect(body.zones[0]).toMatchObject({ id: "provincia/a-coruna", score: 100, scoreBand: "green" });
    expect(body.zones[1].score).toBeLessThan(60);
    // A nivel provincia no se consulta Overpass: la lista es estática.
    expect(findZonesInBbox).not.toHaveBeenCalled();
  });

  it("en modo mar solo salen provincias con costa y se puntúan sobre el punto de mar", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([BEACH_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([CALM_SEA]);
    const app = await buildApp();

    // Ventana sobre Lugo y Ourense: Ourense no tiene costa.
    const res = await app.inject({
      method: "GET",
      url: "/zones?mode=mar&zoom=7&south=42.0&west=-7.8&north=43.9&east=-7.2",
    });

    const body = res.json();
    expect(body.zones).toHaveLength(1);
    expect(body.zones[0]).toMatchObject({ id: "provincia/lugo", lat: 43.62, lon: -7.35 });
    expect(vi.mocked(getWeatherSnapshots).mock.calls[0][0]).toEqual([{ lat: 43.62, lon: -7.35 }]);
  });

  it("con zoom medio pide los municipios a Overpass", async () => {
    vi.mocked(findZonesInBbox).mockResolvedValue([
      { id: "relation/1", name: "A Coruña", lat: 43.36, lon: -8.41 },
      { id: "relation/2", name: "Oleiros", lat: 43.33, lon: -8.32 },
    ]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY, CLEAR_DAY]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones?mode=tierra&zoom=10&south=43.2&west=-8.6&north=43.5&east=-8.1",
    });

    const body = res.json();
    expect(findZonesInBbox).toHaveBeenCalledWith("municipio", { south: 43.2, west: -8.6, north: 43.5, east: -8.1 });
    expect(body.level).toBe("municipio");
    expect(body.zones.map((z: { id: string }) => z.id)).toEqual(["relation/1", "relation/2"]);
  });

  it("si no hay barrios mapeados baja al nivel de municipio en vez de dejar el mapa vacío", async () => {
    vi.mocked(findZonesInBbox)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "relation/1", name: "A Coruña", lat: 43.36, lon: -8.41 }]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones?mode=tierra&zoom=14&south=43.34&west=-8.44&north=43.39&east=-8.38",
    });

    const body = res.json();
    expect(body.level).toBe("municipio");
    expect(body.zones).toHaveLength(1);
  });

  it("en modo mar descarta municipios sin playa asignada y ancla el chip a la playa", async () => {
    vi.mocked(findZonesInBbox).mockResolvedValue([
      { id: "relation/1", name: "A Coruña", lat: 43.36, lon: -8.41 },
      { id: "relation/2", name: "Culleredo", lat: 43.28, lon: -8.39 },
    ]);
    vi.mocked(findBeachesInBbox).mockResolvedValue([{ lat: 43.375, lon: -8.405 }]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([BEACH_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([CALM_SEA]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones?mode=mar&zoom=10&south=43.2&west=-8.6&north=43.5&east=-8.1",
    });

    const body = res.json();
    expect(body.zones).toHaveLength(1);
    expect(body.zones[0]).toMatchObject({ id: "relation/1", lat: 43.375, lon: -8.405 });
  });

  it("descarta zonas de mar sin ningún dato marino (la API marina devuelve nulos en tierra)", async () => {
    vi.mocked(findZonesInBbox).mockResolvedValue([{ id: "relation/9", name: "Zona interior", lat: 43.1, lon: -8.2 }]);
    vi.mocked(findBeachesInBbox).mockResolvedValue([{ lat: 43.1, lon: -8.2 }]);
    vi.mocked(getWeatherSnapshots).mockResolvedValue([BEACH_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([NO_SEA_DATA]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones?mode=mar&zoom=10&south=43.0&west=-8.4&north=43.3&east=-8.0",
    });

    expect(res.json().zones).toEqual([]);
  });

  it("rechaza parámetros inválidos", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/zones?mode=lago&zoom=10" });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /zones/detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve estado de la zona, deportes ordenados por encaje y mejores sitios", async () => {
    vi.mocked(getWeatherSnapshots)
      .mockResolvedValueOnce([CLEAR_DAY])
      .mockResolvedValueOnce([CLEAR_DAY, STORM_DAY, CLEAR_DAY]);
    vi.mocked(findSpots).mockResolvedValue([
      { id: "way/1", name: "Senda del Faro", lat: 43.38, lon: -8.4, sport: "senderismo" },
      { id: "way/2", name: "Pista alta", lat: 43.4, lon: -8.3, sport: "senderismo" },
      { id: "way/3", name: "Camiño Inglés", lat: 43.35, lon: -8.35, sport: "senderismo" },
    ]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones/detail?id=relation/349055&name=A%20Coru%C3%B1a&level=municipio&mode=tierra&lat=43.36&lon=-8.41",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.zone).toMatchObject({ id: "relation/349055", name: "A Coruña", score: 100, scoreBand: "green" });
    expect(body.marine).toBeUndefined();
    // El area id de Overpass es 3600000000 + el id de la relación.
    expect(findSpots).toHaveBeenCalledWith("senderismo", 3_600_349_055, 12);
    expect(body.sportFits.map((f: { sport: string }) => f.sport)).toHaveLength(4);
    expect(body.sportFits[0].score).toBeGreaterThanOrEqual(body.sportFits[3].score);
    // El sitio con temporal cae al final del ranking.
    expect(body.best.map((s: { id: string }) => s.id)).toEqual(["way/1", "way/3", "way/2"]);
    // Con solo 3 sitios no tiene sentido separar "peores".
    expect(body.worst).toEqual([]);
  });

  it("en una provincia muestrea alrededor del punto en vez de barrer el área entera", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValueOnce([BEACH_DAY]).mockResolvedValueOnce([BEACH_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValueOnce([CALM_SEA]).mockResolvedValueOnce([CALM_SEA]);
    vi.mocked(findSpotsAround).mockResolvedValue([
      { id: "way/7", name: "Praia das Catedrais", lat: 43.55, lon: -7.16, sport: "playa" },
    ]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones/detail?id=provincia/lugo&name=Lugo&level=provincia&mode=mar&lat=43.62&lon=-7.35",
    });

    const body = res.json();
    expect(findSpotsAround).toHaveBeenCalledWith("playa", { lat: 43.62, lon: -7.35 }, 30_000, 12);
    expect(body.marine).toEqual(CALM_SEA);
    expect(body.sportFits.map((f: { sport: string }) => f.sport).sort()).toEqual(["playa", "surf", "windsurf"]);
    expect(body.best).toHaveLength(1);
  });

  it("completa con parques/sendas urbanas cuando apenas hay senderos etiquetados", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([CLEAR_DAY, CLEAR_DAY]);
    vi.mocked(findSpots)
      .mockResolvedValueOnce([{ id: "way/1", name: "Sendero", lat: 43.36, lon: -8.41, sport: "senderismo" }])
      .mockResolvedValueOnce([{ id: "way/9", name: "Parque", lat: 43.37, lon: -8.4, sport: "running" }]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones/detail?id=relation/1&name=A%20Coru%C3%B1a&level=municipio&mode=tierra&lat=43.36&lon=-8.41",
    });

    expect(vi.mocked(findSpots).mock.calls.map((c) => c[0])).toEqual(["senderismo", "running"]);
    expect(res.json().best).toHaveLength(2);
  });

  it("responde 404 si se pide el detalle marino de un punto sin mar", async () => {
    vi.mocked(getWeatherSnapshots).mockResolvedValue([BEACH_DAY]);
    vi.mocked(getMarineSnapshots).mockResolvedValue([NO_SEA_DATA]);
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/zones/detail?id=relation/1&name=Lugo%20interior&level=municipio&mode=mar&lat=43.0&lon=-7.5",
    });

    expect(res.statusCode).toBe(404);
  });
});
