import { getOrSet, THIRTY_DAYS_MS } from "../lib/cache.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "w-a-app/0.1 (+https://github.com/davidrdi/W-A)";

// Nominatim exige no superar 1 req/s desde el mismo cliente.
let lastCallAt = 0;
async function throttle() {
  const minGapMs = 1100;
  const elapsed = Date.now() - lastCallAt;
  if (elapsed < minGapMs) {
    await new Promise((resolve) => setTimeout(resolve, minGapMs - elapsed));
  }
  lastCallAt = Date.now();
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

export interface ResolvedLocality {
  query: string;
  displayName: string;
  /** id de área de Overpass: offset por tipo + osm_id, ver https://wiki.openstreetmap.org/wiki/Overpass_API/Areas */
  areaId: number;
  lat: number;
  lon: number;
}

export async function resolveLocality(query: string): Promise<ResolvedLocality> {
  return getOrSet(`locality:${query.trim().toLowerCase()}`, THIRTY_DAYS_MS, async () => {
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

    // Preferimos el límite administrativo real (municipio/provincia) frente a
    // un POI que comparta nombre — así "Coruña" no cae en un punto cualquiera.
    const admin = results.find(
      (r) => r.class === "boundary" && r.type === "administrative" && r.osm_type === "relation",
    );
    const best = admin ?? results[0];
    if (!best) {
      throw new Error(`No se pudo resolver la localidad "${query}"`);
    }

    const areaOffset = best.osm_type === "relation" ? 3_600_000_000 : 2_400_000_000;

    return {
      query,
      displayName: best.display_name,
      areaId: areaOffset + best.osm_id,
      lat: Number(best.lat),
      lon: Number(best.lon),
    };
  });
}
