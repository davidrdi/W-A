import { getOrSet, THIRTY_DAYS_MS } from "../lib/cache.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Photon (Komoot) también va sobre datos de OSM y devuelve osm_type/osm_id, que es lo
// único que necesitamos para construir el área de Overpass. Se usa de reserva porque
// Nominatim limita por IP y responde 429 desde IPs de hosting compartido como las de
// Render, donde la IP de salida se comparte con otros inquilinos.
const PHOTON_URL = "https://photon.komoot.io/api";
const USER_AGENT = "w-a-app/0.1 (+https://github.com/davidrdi/W-A)";

const MIN_GAP_MS = 1100;
let lastCallAt = 0;
let throttleQueue: Promise<unknown> = Promise.resolve();

/**
 * Serializa las llamadas a Nominatim respetando su límite de 1 req/s.
 *
 * Encadena promesas en vez de comparar solo contra `lastCallAt`: con varias
 * peticiones en vuelo a la vez, todas leían el mismo `lastCallAt` antiguo, ninguna
 * esperaba y salían en paralelo — justo lo que dispara el 429.
 */
function throttle(): Promise<void> {
  const next = throttleQueue.then(async () => {
    const elapsed = Date.now() - lastCallAt;
    if (elapsed < MIN_GAP_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS - elapsed));
    }
    lastCallAt = Date.now();
  });
  throttleQueue = next.catch(() => undefined);
  return next;
}

interface NominatimResult {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  class: string;
  type: string;
  display_name: string;
  lat: string;
  lon: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: "N" | "W" | "R";
    osm_id: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

export interface ResolvedLocality {
  query: string;
  displayName: string;
  /** id de área de Overpass: offset por tipo + osm_id, ver https://wiki.openstreetmap.org/wiki/Overpass_API/Areas */
  areaId: number;
  lat: number;
  lon: number;
}

/** Candidato normalizado, común a los dos geocodificadores. */
interface Candidate {
  osmType: "node" | "way" | "relation";
  osmId: number;
  displayName: string;
  lat: number;
  lon: number;
  isAdminBoundary: boolean;
}

// Overpass solo sabe construir áreas a partir de relaciones y ways; un nodo no
// delimita nada, así que no sirve por mucho que el nombre encaje.
function toAreaId(candidate: Candidate): number | null {
  if (candidate.osmType === "relation") return 3_600_000_000 + candidate.osmId;
  if (candidate.osmType === "way") return 2_400_000_000 + candidate.osmId;
  return null;
}

function pickBest(candidates: Candidate[]): Candidate | null {
  const withArea = candidates.filter((c) => toAreaId(c) !== null);
  // Preferimos el límite administrativo real (municipio/provincia) frente a
  // un POI que comparta nombre — así "Coruña" no cae en un punto cualquiera.
  return withArea.find((c) => c.isAdminBoundary) ?? withArea[0] ?? null;
}

async function fromNominatim(query: string): Promise<Candidate[]> {
  await throttle();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "es");
  url.searchParams.set("limit", "5");

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Nominatim respondió ${res.status}`);
  }
  const results = (await res.json()) as NominatimResult[];

  return results.map((r) => ({
    osmType: r.osm_type,
    osmId: r.osm_id,
    displayName: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
    isAdminBoundary: r.class === "boundary" && r.type === "administrative",
  }));
}

const PHOTON_OSM_TYPE = { N: "node", W: "way", R: "relation" } as const;

async function fromPhoton(query: string): Promise<Candidate[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  url.searchParams.set("lang", "es");

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Photon respondió ${res.status}`);
  }
  const body = (await res.json()) as { features?: PhotonFeature[] };

  return (body.features ?? [])
    .filter((f) => f.properties.countrycode === "ES")
    .map((f) => {
      const p = f.properties;
      return {
        osmType: PHOTON_OSM_TYPE[p.osm_type],
        osmId: p.osm_id,
        displayName: [p.name, p.state, p.country].filter(Boolean).join(", "),
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        // Photon no marca "boundary/administrative" como Nominatim; lo más cercano
        // es que el elemento sea un lugar (place=city/town/village...).
        isAdminBoundary: p.osm_key === "place" || p.osm_key === "boundary",
      };
    });
}

export async function resolveLocality(query: string): Promise<ResolvedLocality> {
  return getOrSet(`locality:${query.trim().toLowerCase()}`, THIRTY_DAYS_MS, async () => {
    const failures: string[] = [];
    let best: Candidate | null = null;

    for (const geocoder of [fromNominatim, fromPhoton]) {
      try {
        const picked = pickBest(await geocoder(query));
        if (picked) {
          best = picked;
          break;
        }
        failures.push(`${geocoder.name}: sin resultados con área`);
      } catch (error) {
        failures.push(`${geocoder.name}: ${error instanceof Error ? error.message : "error de red"}`);
      }
    }

    if (!best) {
      throw new Error(`No se pudo resolver la localidad "${query}" (${failures.join("; ")})`);
    }

    return {
      query,
      displayName: best.displayName,
      areaId: toAreaId(best)!,
      lat: best.lat,
      lon: best.lon,
    };
  });
}
