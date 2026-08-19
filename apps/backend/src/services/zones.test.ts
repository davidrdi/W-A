import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveLocality, mockFindSpots, mockGetSpotsNear } = vi.hoisted(() => ({
  mockResolveLocality: vi.fn(),
  mockFindSpots: vi.fn(),
  mockGetSpotsNear: vi.fn(),
}));

vi.mock("./geocoding.js", () => ({ resolveLocality: mockResolveLocality }));
vi.mock("./spots.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./spots.js")>();
  return { ...actual, findSpots: mockFindSpots };
});
vi.mock("./spotsRepo.js", () => ({ getSpotsNear: mockGetSpotsNear }));

import { resolveZones } from "./zones.js";

const AREA = { query: "A Coruña", displayName: "A Coruña (OSM)", areaId: 3_600_000_001, lat: 43.36, lon: -8.41 };

describe("resolveZones", () => {
  beforeEach(() => {
    mockResolveLocality.mockReset();
    mockFindSpots.mockReset();
    mockGetSpotsNear.mockReset();
    // Por defecto la tabla no tiene nada, para no tener que repetirlo en
    // cada test que quiere probar la vía en vivo o la de arranque.
    mockGetSpotsNear.mockResolvedValue([]);
  });

  it("usa la tabla precalculada cuando tiene zonas cerca, sin llamar a Overpass", async () => {
    mockResolveLocality.mockResolvedValue(AREA);
    mockGetSpotsNear.mockResolvedValue([
      { id: "way/1", category: "urbanPath", name: "Parque de la tabla", lat: 43.36, lon: -8.41, source: "osm" },
    ]);

    const result = await resolveZones("running", "A Coruña", 8);

    expect(result.source).toBe("db");
    expect(result.spots[0].name).toBe("Parque de la tabla");
    expect(result.spots[0].sport).toBe("running");
    expect(mockFindSpots).not.toHaveBeenCalled();
  });

  it("usa los datos en vivo de OSM cuando la tabla no tiene nada para esa localidad", async () => {
    mockResolveLocality.mockResolvedValue(AREA);
    mockFindSpots.mockResolvedValue([
      { id: "way/1", name: "Parque real de OSM", lat: 43.36, lon: -8.41, sport: "running" },
    ]);

    const result = await resolveZones("running", "A Coruña", 8);

    expect(result.source).toBe("osm");
    expect(result.locality).toBe("A Coruña (OSM)");
    expect(result.spots[0].name).toBe("Parque real de OSM");
  });

  it("cae a las zonas precalculadas cuando la geocodificación falla", async () => {
    mockResolveLocality.mockRejectedValue(new Error("Nominatim respondió 429"));

    const result = await resolveZones("running", "A Coruña", 8);

    expect(result.source).toBe("seed");
    expect(result.spots.length).toBeGreaterThan(0);
    // Los ids de arranque nunca deben parecer ids de OSM.
    expect(result.spots.every((s) => s.id.startsWith("seed/"))).toBe(true);
    expect(mockGetSpotsNear).not.toHaveBeenCalled();
  });

  it("si la tabla falla (Supabase caído), sigue probando la vía en vivo antes de rendirse", async () => {
    mockResolveLocality.mockResolvedValue(AREA);
    mockGetSpotsNear.mockRejectedValue(new Error("fetch failed"));
    mockFindSpots.mockResolvedValue([
      { id: "way/1", name: "Parque real de OSM", lat: 43.36, lon: -8.41, sport: "running" },
    ]);

    const result = await resolveZones("running", "A Coruña", 8);

    expect(result.source).toBe("osm");
    expect(result.spots[0].name).toBe("Parque real de OSM");
  });

  it("cae a las zonas precalculadas cuando ni la tabla ni Overpass responden", async () => {
    mockResolveLocality.mockResolvedValue(AREA);
    mockFindSpots.mockRejectedValue(new Error("Overpass no respondió en ninguna instancia"));

    const result = await resolveZones("playa", "A Coruña", 8);

    expect(result.source).toBe("seed");
    expect(result.spots.map((s) => s.name)).toContain("Playa de Riazor");
  });

  it("cae a las zonas precalculadas cuando ni la tabla ni Overpass tienen zonas", async () => {
    mockResolveLocality.mockResolvedValue(AREA);
    mockFindSpots.mockResolvedValue([]);

    const result = await resolveZones("running", "A Coruña", 8);

    expect(result.source).toBe("seed");
    expect(result.spots.length).toBeGreaterThan(0);
  });

  it("propaga el error si la localidad no está entre las precalculadas", async () => {
    mockResolveLocality.mockRejectedValue(new Error("Nominatim respondió 429"));

    await expect(resolveZones("running", "Villarriba del Alcor", 8)).rejects.toThrow("429");
  });

  it("devuelve el deporte pedido, no la categoría interna, en cada zona", async () => {
    mockResolveLocality.mockRejectedValue(new Error("caída"));

    const surf = await resolveZones("surf", "Donostia", 8);

    expect(surf.spots.every((s) => s.sport === "surf")).toBe(true);
    expect(surf.spots.map((s) => s.name)).toContain("Playa de la Zurriola");
  });

  it("encuentra la localidad sin tildes y dentro de una frase", async () => {
    mockResolveLocality.mockRejectedValue(new Error("caída"));

    const result = await resolveZones("playa", "playas de malaga", 8);

    expect(result.source).toBe("seed");
    expect(result.locality).toContain("Málaga");
  });

  it("respeta el límite pedido", async () => {
    mockResolveLocality.mockRejectedValue(new Error("caída"));

    const result = await resolveZones("running", "Madrid", 2);

    expect(result.spots).toHaveLength(2);
  });
});
