import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLocality } from "./geocoding.js";

function nominatimOk(results: unknown[]) {
  return { ok: true, json: async () => results };
}

function photonOk(features: unknown[]) {
  return { ok: true, json: async () => ({ features }) };
}

const CORUNA_RELATION = {
  osm_type: "relation",
  osm_id: 349055,
  class: "boundary",
  type: "administrative",
  display_name: "A Coruña, Galicia, España",
  lat: "43.3623",
  lon: "-8.4115",
};

describe("resolveLocality", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefiere el límite administrativo real frente a un POI que comparta nombre", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      nominatimOk([
        {
          osm_type: "way",
          osm_id: 111,
          class: "shop",
          type: "bakery",
          display_name: "Panadería A Coruña, Vigo",
          lat: "42.23",
          lon: "-8.72",
        },
        CORUNA_RELATION,
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveLocality("A Coruña admin test");

    expect(result.displayName).toBe("A Coruña, Galicia, España");
    // offset de área de relación (3_600_000_000) + osm_id, ver Overpass Areas.
    expect(result.areaId).toBe(3_600_000_000 + 349055);
  });

  it("descarta nodos: Overpass no sabe construir un área a partir de un punto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      nominatimOk([
        {
          osm_type: "node",
          osm_id: 222,
          class: "place",
          type: "town",
          display_name: "Nodo de pueblo",
          lat: "43",
          lon: "-8",
        },
        {
          osm_type: "way",
          osm_id: 333,
          class: "place",
          type: "town",
          display_name: "Way de pueblo",
          lat: "43",
          lon: "-8",
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveLocality("descarta-nodos-test");

    expect(result.areaId).toBe(2_400_000_000 + 333);
  });

  it("cachea por consulta: una segunda llamada con el mismo texto no repite la petición HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(nominatimOk([CORUNA_RELATION]));
    vi.stubGlobal("fetch", fetchMock);

    const query = "localidad-cache-test";
    await resolveLocality(query);
    await resolveLocality(query);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cae a Photon cuando Nominatim limita por IP (429)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce(
        photonOk([
          {
            geometry: { coordinates: [-8.72, 42.23] },
            properties: {
              osm_type: "R",
              osm_id: 345216,
              osm_key: "place",
              osm_value: "city",
              name: "Vigo",
              state: "Galicia",
              country: "España",
              countrycode: "ES",
            },
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveLocality("vigo-fallback-test");

    expect(result.displayName).toBe("Vigo, Galicia, España");
    expect(result.areaId).toBe(3_600_000_000 + 345216);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignora resultados de Photon fuera de España", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce(
        photonOk([
          {
            geometry: { coordinates: [2.35, 48.85] },
            properties: { osm_type: "R", osm_id: 1, osm_key: "place", name: "París", countrycode: "FR" },
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveLocality("fuera-de-espana-test")).rejects.toThrow(/No se pudo resolver la localidad/);
  });

  it("el error final enumera lo que falló en cada geocodificador", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(resolveLocality("sitio-inexistente-xyz")).rejects.toThrow(
      /Nominatim respondió 429.*Photon respondió 429/s,
    );
  });

  it("serializa las llamadas concurrentes a Nominatim en vez de dispararlas a la vez", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight--;
      return nominatimOk([CORUNA_RELATION]);
    });
    vi.stubGlobal("fetch", fetchMock);

    // Consultas distintas: la caché no las puede colapsar, así que las tres salen.
    await Promise.all([
      resolveLocality("concurrencia-a"),
      resolveLocality("concurrencia-b"),
      resolveLocality("concurrencia-c"),
    ]);

    // Es justo el paralelismo lo que provocaba el 429 de Nominatim.
    expect(maxInFlight).toBe(1);
  });
});
