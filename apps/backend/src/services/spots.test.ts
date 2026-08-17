import { afterEach, describe, expect, it, vi } from "vitest";
import { findRunningSpots } from "./spots.js";

describe("findRunningSpots", () => {
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

    const spots = await findRunningSpots(3_600_000_001, 5);

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

    const spots = await findRunningSpots(3_600_000_002, 4);

    expect(spots).toHaveLength(4);
  });

  it("lanza un error legible si Overpass responde con un status de error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(findRunningSpots(3_600_000_003)).rejects.toThrow("Overpass respondió 429");
  });
});
