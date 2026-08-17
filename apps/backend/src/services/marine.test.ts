import { afterEach, describe, expect, it, vi } from "vitest";
import { getMarineSnapshots } from "./marine.js";

describe("getMarineSnapshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("promedia y calcula el máximo de oleaje del día", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hourly: {
            time: ["2026-08-17T00:00", "2026-08-17T01:00", "2026-08-17T02:00"],
            wave_height: [0.8, 1.2, 1.0],
            sea_surface_temperature: [19, 19.4, 19.2],
          },
        }),
      }),
    );

    const [snapshot] = await getMarineSnapshots([{ lat: 43.36, lon: -8.5 }]);

    expect(snapshot.waveHeightAvgM).toBeCloseTo(1.0, 1);
    expect(snapshot.waveHeightMaxM).toBe(1.2);
    expect(snapshot.seaSurfaceTempC).toBeCloseTo(19.2, 1);
  });

  it("filtra valores null (punto fuera de la malla marina) sin romper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hourly: {
            time: ["2026-08-17T00:00", "2026-08-17T01:00"],
            wave_height: [null, null],
            sea_surface_temperature: [null, null],
          },
        }),
      }),
    );

    const [snapshot] = await getMarineSnapshots([{ lat: 0, lon: 0 }]);

    expect(snapshot.waveHeightAvgM).toBe(0);
    expect(snapshot.waveHeightMaxM).toBe(0);
  });

  it("devuelve un array vacío si no hay coordenadas", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await getMarineSnapshots([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lanza un error legible si Open-Meteo Marine responde con un status de error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(getMarineSnapshots([{ lat: 1, lon: 1 }])).rejects.toThrow("Open-Meteo Marine respondió 503");
  });
});
