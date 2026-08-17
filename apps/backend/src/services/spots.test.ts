import { afterEach, describe, expect, it, vi } from "vitest";
import { findSpots } from "./spots.js";

describe("findSpots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prioriza elementos con nombre y usa el centro de la way como coordenada", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: "way",
            id: 1,
            center: { lat: 43.37, lon: -8.4 },
            tags: { leisure: "park", name: "Parque de Santa Margarita" },
          },
          {
            type: "way",
            id: 2,
            center: { lat: 43.38, lon: -8.41 },
            tags: { highway: "footway" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const spots = await findSpots("running", 3_600_000_101, 5);

    expect(spots).toHaveLength(2);
    expect(spots[0]).toMatchObject({
      id: "way/1",
      name: "Parque de Santa Margarita",
      lat: 43.37,
      lon: -8.4,
      sport: "running",
    });
  });

  it("respeta el límite pedido", async () => {
    const elements = Array.from({ length: 10 }, (_, i) => ({
      type: "way",
      id: i,
      center: { lat: 43 + i * 0.001, lon: -8 },
      tags: { name: `Sendero ${i}` },
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements }) }));

    const spots = await findSpots("senderismo", 3_600_000_102, 4);

    expect(spots).toHaveLength(4);
  });

  it("lanza un error legible si Overpass responde con un status de error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(findSpots("bici", 3_600_000_103)).rejects.toThrow("Overpass respondió 429");
  });

  it("usa un nombre de fallback distinto según la categoría (playa vs sendero)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          elements: [{ type: "way", id: 1, center: { lat: 1, lon: 1 }, tags: { natural: "beach" } }],
        }),
      }),
    );

    const spots = await findSpots("playa", 3_600_000_104);
    expect(spots[0].name).toBe("Playa sin nombre");
  });

  it("comparte la caché de Overpass entre playa/surf/windsurf (misma categoría) pero etiqueta el sport pedido", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [{ type: "way", id: 42, center: { lat: 43.5, lon: -8.2 }, tags: { natural: "beach", name: "Praia" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const areaId = 3_600_000_105;
    const playaSpots = await findSpots("playa", areaId);
    const surfSpots = await findSpots("surf", areaId);
    const windsurfSpots = await findSpots("windsurf", areaId);

    expect(playaSpots[0].sport).toBe("playa");
    expect(surfSpots[0].sport).toBe("surf");
    expect(windsurfSpots[0].sport).toBe("windsurf");
    // Misma área + misma categoría (beach) → una sola llamada real a Overpass.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("extrae nudismo y admisión de mascotas de los tags de OSM cuando están presentes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          elements: [
            {
              type: "way",
              id: 1,
              center: { lat: 43.1, lon: -8.1 },
              tags: { natural: "beach", name: "Praia Naturista", naturist: "yes", dog: "leashed" },
            },
            {
              type: "way",
              id: 2,
              center: { lat: 43.2, lon: -8.2 },
              tags: { natural: "beach", name: "Praia sin datos de mascotas" },
            },
            {
              type: "way",
              id: 3,
              center: { lat: 43.3, lon: -8.3 },
              tags: { natural: "beach", name: "Praia sin perros", dog: "no" },
            },
          ],
        }),
      }),
    );

    const spots = await findSpots("playa", 3_600_000_106, 3);

    expect(spots[0].amenities).toEqual({ naturist: true, dogsAllowed: true });
    // Sin tag de OSM -> sin dato, nunca se asume "no".
    expect(spots[1].amenities).toBeUndefined();
    expect(spots[2].amenities).toEqual({ dogsAllowed: false });
  });
});
