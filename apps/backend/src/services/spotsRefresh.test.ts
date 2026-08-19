import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./geocoding.js", () => ({ resolveLocality: vi.fn() }));
vi.mock("./spots.js", () => ({ findSpotsRawByCategory: vi.fn() }));
vi.mock("./spotsRepo.js", () => ({ replaceCategorySpots: vi.fn() }));
vi.mock("../data/seedZones.js", () => ({ allSeedSpotsByCategory: vi.fn() }));

import { allSeedSpotsByCategory } from "../data/seedZones.js";
import { resolveLocality } from "./geocoding.js";
import { findSpotsRawByCategory } from "./spots.js";
import { replaceCategorySpots } from "./spotsRepo.js";
import { refreshAllSpots, refreshBeaches, refreshLandZones } from "./spotsRefresh.js";

const SPAIN_AREA = { query: "España", displayName: "España", areaId: 3_600_001_311, lat: 40.4, lon: -3.7 };

describe("refreshBeaches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resuelve España, pide todas las playas en vivo y reemplaza la categoría entera", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(SPAIN_AREA);
    vi.mocked(findSpotsRawByCategory).mockResolvedValue([
      { id: "way/1", name: "Playa de Riazor", lat: 43.37, lon: -8.41 },
    ]);

    const result = await refreshBeaches();

    expect(resolveLocality).toHaveBeenCalledWith("España");
    expect(findSpotsRawByCategory).toHaveBeenCalledWith("beach", SPAIN_AREA.areaId, expect.any(Number));
    // El límite nacional tiene que ser alto: "todas", no una muestra.
    expect(vi.mocked(findSpotsRawByCategory).mock.calls[0][2]).toBeGreaterThan(1000);
    expect(replaceCategorySpots).toHaveBeenCalledWith(
      "beach",
      [expect.objectContaining({ id: "way/1", category: "beach", source: "osm" })],
    );
    expect(result).toEqual({ category: "beach", count: 1, source: "osm" });
  });

  it("si Overpass falla, no llega a tocar la tabla (los datos anteriores se quedan como estaban)", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(SPAIN_AREA);
    vi.mocked(findSpotsRawByCategory).mockRejectedValue(new Error("Overpass no respondió en ninguna instancia"));

    await expect(refreshBeaches()).rejects.toThrow("Overpass no respondió");
    expect(replaceCategorySpots).not.toHaveBeenCalled();
  });
});

describe("refreshLandZones", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sincroniza las tres categorías de tierra desde el conjunto curado de seedZones", async () => {
    vi.mocked(allSeedSpotsByCategory).mockImplementation((category) => [
      { id: `seed/zona-${category}`, name: `Zona ${category}`, lat: 40, lon: -3 },
    ]);

    const results = await refreshLandZones();

    expect(vi.mocked(allSeedSpotsByCategory).mock.calls.map((c) => c[0]).sort()).toEqual(
      ["cycleway", "trail", "urbanPath"].sort(),
    );
    expect(replaceCategorySpots).toHaveBeenCalledTimes(3);
    expect(replaceCategorySpots).toHaveBeenCalledWith(
      "urbanPath",
      [expect.objectContaining({ id: "seed/zona-urbanPath", category: "urbanPath", source: "seed" })],
    );
    expect(results).toContainEqual({ category: "urbanPath", count: 1, source: "seed" });
    expect(results).toContainEqual({ category: "trail", count: 1, source: "seed" });
    expect(results).toContainEqual({ category: "cycleway", count: 1, source: "seed" });
  });
});

describe("refreshAllSpots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refresca playas y zonas de tierra, y devuelve un resumen de las cuatro categorías", async () => {
    vi.mocked(resolveLocality).mockResolvedValue(SPAIN_AREA);
    vi.mocked(findSpotsRawByCategory).mockResolvedValue([{ id: "way/1", name: "Playa", lat: 1, lon: 1 }]);
    vi.mocked(allSeedSpotsByCategory).mockReturnValue([{ id: "seed/zona", name: "Zona", lat: 1, lon: 1 }]);

    const results = await refreshAllSpots();

    expect(results).toHaveLength(4);
    expect(results.map((r) => r.category).sort()).toEqual(["beach", "cycleway", "trail", "urbanPath"].sort());
  });
});
