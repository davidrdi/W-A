import { afterEach, describe, expect, it, vi } from "vitest";

import { anchorZonesToCoast, findZonesInBbox, levelForZoom, limitToNearest, snapBbox } from "./zones.js";

const CORUNA_BBOX = { south: 43.31, west: -8.46, north: 43.42, east: -8.31 };

describe("snapBbox", () => {
  it("redondea hacia fuera a la rejilla de 0.1° para que mover el mapa reutilice caché", () => {
    const snapped = snapBbox(CORUNA_BBOX);

    expect(snapped.south).toBeCloseTo(43.3, 5);
    expect(snapped.west).toBeCloseTo(-8.5, 5);
    expect(snapped.north).toBeCloseTo(43.5, 5);
    expect(snapped.east).toBeCloseTo(-8.3, 5);
  });
});

describe("levelForZoom", () => {
  it("mapea zoom a granularidad de chip", () => {
    expect(levelForZoom(6)).toBe("provincia");
    expect(levelForZoom(8)).toBe("provincia");
    expect(levelForZoom(10)).toBe("municipio");
    expect(levelForZoom(13)).toBe("local");
  });
});

describe("findZonesInBbox", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("descarta elementos sin nombre o sin coordenadas y deduplica por nombre", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          elements: [
            { type: "relation", id: 1, center: { lat: 43.36, lon: -8.41 }, tags: { name: "A Coruña" } },
            { type: "node", id: 2, lat: 43.36, lon: -8.41, tags: { name: "A Coruña" } },
            { type: "relation", id: 3, center: { lat: 43.33, lon: -8.4 }, tags: {} },
            { type: "relation", id: 4, tags: { name: "Sin centro" } },
            { type: "relation", id: 5, center: { lat: 43.31, lon: -8.36 }, tags: { name: "Oleiros" } },
          ],
        }),
      }),
    );

    const zones = await findZonesInBbox("municipio", { south: 1.11, west: 1.11, north: 1.19, east: 1.19 });

    expect(zones).toEqual([
      { id: "relation/1", name: "A Coruña", lat: 43.36, lon: -8.41 },
      { id: "relation/5", name: "Oleiros", lat: 43.31, lon: -8.36 },
    ]);
  });

  it("lanza un error legible si Overpass responde con status de error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 504 }));

    await expect(findZonesInBbox("local", { south: 2.11, west: 2.11, north: 2.19, east: 2.19 })).rejects.toThrow(
      "Overpass respondió 504",
    );
  });
});

describe("anchorZonesToCoast", () => {
  const ZONES = [
    { id: "relation/1", name: "A Coruña", lat: 43.36, lon: -8.41 },
    { id: "relation/2", name: "Lugo", lat: 43.01, lon: -7.56 },
  ];

  it("deja fuera las zonas sin playa cerca y ancla las costeras a su playa más próxima", () => {
    const beaches = [
      { lat: 43.375, lon: -8.405 }, // Riazor, pegada al centro de A Coruña
      { lat: 43.42, lon: -8.3 }, // otra playa del entorno, más lejos
    ];

    const anchored = anchorZonesToCoast(ZONES, beaches);

    expect(anchored).toHaveLength(1);
    expect(anchored[0]).toMatchObject({ id: "relation/1", lat: 43.375, lon: -8.405 });
  });

  it("no ancla playas que están a más distancia de la permitida", () => {
    expect(anchorZonesToCoast(ZONES, [{ lat: 44.5, lon: -8.4 }])).toEqual([]);
  });

  it("sin zonas o sin playas devuelve vacío", () => {
    expect(anchorZonesToCoast([], [{ lat: 43.37, lon: -8.4 }])).toEqual([]);
    expect(anchorZonesToCoast(ZONES, [])).toEqual([]);
  });
});

describe("limitToNearest", () => {
  it("se queda con las zonas más próximas al centro de la vista", () => {
    const zones = [
      { id: "a", name: "Lejos", lat: 44, lon: -8 },
      { id: "b", name: "Cerca", lat: 43.37, lon: -8.4 },
      { id: "c", name: "Medio", lat: 43.6, lon: -8.4 },
    ];

    const limited = limitToNearest(zones, { lat: 43.36, lon: -8.41 }, 2);

    expect(limited.map((z) => z.id)).toEqual(["b", "c"]);
  });

  it("no reordena si caben todas", () => {
    const zones = [{ id: "a", name: "A", lat: 44, lon: -8 }];
    expect(limitToNearest(zones, { lat: 43, lon: -8 }, 5)).toBe(zones);
  });
});
