import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveLocality, mockFindSpots } = vi.hoisted(() => ({
  mockResolveLocality: vi.fn(),
  mockFindSpots: vi.fn(),
}));

vi.mock("./geocoding.js", () => ({ resolveLocality: mockResolveLocality }));
vi.mock("./spots.js", () => ({ findSpots: mockFindSpots }));

import { resolveZones } from "./zones.js";

const AREA = { query: "A Coruña", displayName: "A Coruña (OSM)", areaId: 3_600_000_001, lat: 43.36, lon: -8.41 };

describe("resolveZones", () => {
  beforeEach(() => {
    mockResolveLocality.mockReset();
    mockFindSpots.mockReset();
  });

  it("usa los datos en vivo de OSM cuando responden", async () => {
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
  });

  it("cae a las zonas precalculadas cuando Overpass falla", async () => {
    mockResolveLocality.mockResolvedValue(AREA);
    mockFindSpots.mockRejectedValue(new Error("Overpass no respondió en ninguna instancia"));

    const result = await resolveZones("playa", "A Coruña", 8);

    expect(result.source).toBe("seed");
    expect(result.spots.map((s) => s.name)).toContain("Playa de Riazor");
  });

  it("cae a las zonas precalculadas cuando Overpass responde 200 pero sin zonas", async () => {
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
