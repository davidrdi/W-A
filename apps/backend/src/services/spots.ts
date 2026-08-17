import type { Spot } from "@w-a/shared";
import { getOrSet, SEVEN_DAYS_MS } from "../lib/cache.js";

const OVERPASS_ENDPOINT = process.env.OVERPASS_ENDPOINT ?? "https://overpass-api.de/api/interpreter";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// area(id) limita la búsqueda al polígono administrativo real resuelto por
// Nominatim — no a un radio de distancia, que es lo que colaría spots de un
// municipio vecino (ver decisión "Precisión geográfica" del plan).
const runningQuery = (areaId: number) => `
[out:json][timeout:25];
area(${areaId})->.searchArea;
(
  way["leisure"="park"](area.searchArea);
  way["highway"~"^(footway|path|pedestrian|track)$"]["foot"!="no"](area.searchArea);
);
out tags center;
`;

export async function findRunningSpots(areaId: number, limit = 8): Promise<Spot[]> {
  return getOrSet(`spots:running:${areaId}`, SEVEN_DAYS_MS, async () => {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: runningQuery(areaId),
    });
    if (!res.ok) {
      throw new Error(`Overpass respondió ${res.status}`);
    }
    const data = (await res.json()) as OverpassResponse;

    const withCoords = data.elements.filter((el) => el.center || (el.lat !== undefined && el.lon !== undefined));
    const named = withCoords.filter((el) => el.tags?.name);
    const pool = named.length >= limit ? named : withCoords;

    return pool.slice(0, limit).map((el) => {
      const lat = el.center?.lat ?? el.lat!;
      const lon = el.center?.lon ?? el.lon!;
      const fallbackName = el.tags?.leisure === "park" ? "Parque sin nombre" : "Camino sin nombre";
      return {
        id: `${el.type}/${el.id}`,
        name: el.tags?.name ?? fallbackName,
        lat,
        lon,
        sport: "running" as const,
      };
    });
  });
}
