import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

import { getSpotsByCategory, getSpotsNear, replaceCategorySpots, type RepoSpot } from "./spotsRepo.js";

// Igual que en favoritesDb.test.ts: la query builder de supabase-js encadena
// métodos y el resultado final es "thenable".
function chainable(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "insert", "delete"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

describe("getSpotsByCategory", () => {
  beforeEach(() => mockFrom.mockReset());

  it("filtra por categoría y mapea las filas", async () => {
    const chain = chainable({
      data: [{ id: "way/1", category: "beach", name: "Playa de Riazor", lat: 43.37, lon: -8.41, amenities: null, source: "osm" }],
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const spots = await getSpotsByCategory("beach");

    expect(mockFrom).toHaveBeenCalledWith("spots");
    expect(chain.eq).toHaveBeenCalledWith("category", "beach");
    expect(spots).toEqual([
      { id: "way/1", category: "beach", name: "Playa de Riazor", lat: 43.37, lon: -8.41, amenities: undefined, source: "osm" },
    ]);
  });

  it("lanza un error legible si Supabase responde con error", async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: { message: "boom" } }));

    await expect(getSpotsByCategory("beach")).rejects.toThrow('No se pudieron leer las zonas de "beach"');
  });
});

describe("getSpotsNear", () => {
  beforeEach(() => mockFrom.mockReset());

  it("filtra por bounding box y devuelve solo lo que cae dentro del radio real, más cerca primero", async () => {
    const CENTER = { lat: 43.36, lon: -8.41 };
    const chain = chainable({
      data: [
        // A ~1km del centro: dentro del radio.
        { id: "way/near", category: "beach", name: "Cerca", lat: 43.369, lon: -8.41, amenities: null, source: "osm" },
        // Dentro del bounding box pero a más de 25km en línea recta (la
        // caja es un cuadrado, el radio real es un círculo): debe filtrarse.
        { id: "way/corner", category: "beach", name: "Esquina lejana", lat: 43.55, lon: -8.6, amenities: null, source: "osm" },
        // A ~5km: dentro del radio, pero más lejos que "Cerca".
        { id: "way/mid", category: "beach", name: "Media distancia", lat: 43.405, lon: -8.41, amenities: null, source: "osm" },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const spots = await getSpotsNear("beach", CENTER, 25, 10);

    expect(spots.map((s) => s.id)).toEqual(["way/near", "way/mid"]);
    expect(chain.eq).toHaveBeenCalledWith("category", "beach");
    expect(chain.gte).toHaveBeenCalledWith("lat", expect.any(Number));
    expect(chain.lte).toHaveBeenCalledWith("lat", expect.any(Number));
  });

  it("respeta el límite pedido tras ordenar por distancia", async () => {
    const CENTER = { lat: 43.36, lon: -8.41 };
    const chain = chainable({
      data: Array.from({ length: 5 }, (_, i) => ({
        id: `way/${i}`,
        category: "beach",
        name: `Playa ${i}`,
        lat: 43.36 + i * 0.01,
        lon: -8.41,
        amenities: null,
        source: "osm",
      })),
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const spots = await getSpotsNear("beach", CENTER, 25, 2);

    expect(spots).toHaveLength(2);
    expect(spots[0].id).toBe("way/0");
  });

  it("lanza un error legible si Supabase responde con error", async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: { message: "boom" } }));

    await expect(getSpotsNear("beach", { lat: 0, lon: 0 }, 25, 10)).rejects.toThrow(
      'No se pudieron leer las zonas de "beach" cerca de',
    );
  });
});

describe("replaceCategorySpots", () => {
  beforeEach(() => mockFrom.mockReset());

  const SPOTS: RepoSpot[] = [
    { id: "way/1", category: "beach", name: "Playa de Riazor", lat: 43.37, lon: -8.41, source: "osm" },
  ];

  it("borra la categoría entera y luego inserta las zonas nuevas", async () => {
    const deleteChain = chainable({ data: null, error: null });
    const insertChain = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(deleteChain).mockReturnValueOnce(insertChain);

    await replaceCategorySpots("beach", SPOTS);

    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith("category", "beach");
    expect(insertChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ id: "way/1", category: "beach", name: "Playa de Riazor" }),
    ]);
  });

  it("si borrar falla, no llega a insertar nada", async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: { message: "boom" } }));

    await expect(replaceCategorySpots("beach", SPOTS)).rejects.toThrow('No se pudo limpiar la categoría "beach"');
  });

  it("no inserta nada si la lista viene vacía (solo limpia la categoría)", async () => {
    const deleteChain = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(deleteChain);

    await replaceCategorySpots("beach", []);

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("trocea la inserción en lotes de 500 filas", async () => {
    const deleteChain = chainable({ data: null, error: null });
    const insertChain = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(deleteChain).mockReturnValue(insertChain);

    const manySpots: RepoSpot[] = Array.from({ length: 650 }, (_, i) => ({
      id: `way/${i}`,
      category: "beach",
      name: `Playa ${i}`,
      lat: 43,
      lon: -8,
      source: "osm",
    }));

    await replaceCategorySpots("beach", manySpots);

    expect(insertChain.insert).toHaveBeenCalledTimes(2);
    expect((insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]).toHaveLength(500);
    expect((insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[1][0]).toHaveLength(150);
  });
});
