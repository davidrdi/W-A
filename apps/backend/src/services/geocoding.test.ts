import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLocality } from "./geocoding.js";

describe("resolveLocality", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefiere el límite administrativo real frente a un POI que comparta nombre", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          osm_type: "node",
          osm_id: 111,
          class: "shop",
          type: "bakery",
          display_name: "Panadería A Coruña, Vigo",
          lat: "42.23",
          lon: "-8.72",
        },
        {
          osm_type: "relation",
          osm_id: 349055,
          class: "boundary",
          type: "administrative",
          display_name: "A Coruña, Galicia, España",
          lat: "43.3623",
          lon: "-8.4115",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveLocality("A Coruña admin test");

    expect(result.displayName).toBe("A Coruña, Galicia, España");
    // offset de área de relación (3_600_000_000) + osm_id, ver Overpass Areas.
    expect(result.areaId).toBe(3_600_000_000 + 349055);
  });

  it("cachea por consulta: una segunda llamada con el mismo texto no repite la petición HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          osm_type: "relation",
          osm_id: 999,
          class: "boundary",
          type: "administrative",
          display_name: "Localidad de prueba de caché",
          lat: "1",
          lon: "1",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const query = "localidad-cache-test";
    await resolveLocality(query);
    await resolveLocality(query);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lanza un error legible cuando Nominatim no devuelve ningún resultado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    await expect(resolveLocality("sitio-inexistente-xyz")).rejects.toThrow(
      'No se pudo resolver la localidad "sitio-inexistente-xyz"',
    );
  });
});
