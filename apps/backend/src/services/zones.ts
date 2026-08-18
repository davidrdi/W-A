import type { LatLon, ZoneLevel } from "@w-a/shared";
import { distanceKm } from "@w-a/shared";

import { getOrSet, SEVEN_DAYS_MS } from "../lib/cache.js";

const OVERPASS_ENDPOINT = process.env.OVERPASS_ENDPOINT ?? "https://overpass-api.de/api/interpreter";

export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface ZoneCandidate {
  /** "relation/349055" o "node/123" — el tipo importa para buscar dentro. */
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// El bbox se redondea hacia fuera a una rejilla de 0.1° antes de consultar y
// de cachear: al mover el mapa un poco, la clave de caché sigue siendo la
// misma y no se repite la consulta a Overpass (que es lo lento de todo esto).
const GRID_DEG = 0.1;

export function snapBbox(bbox: Bbox): Bbox {
  return {
    south: Math.floor(bbox.south / GRID_DEG) * GRID_DEG,
    west: Math.floor(bbox.west / GRID_DEG) * GRID_DEG,
    north: Math.ceil(bbox.north / GRID_DEG) * GRID_DEG,
    east: Math.ceil(bbox.east / GRID_DEG) * GRID_DEG,
  };
}

function bboxKey(bbox: Bbox): string {
  return [bbox.south, bbox.west, bbox.north, bbox.east].map((v) => v.toFixed(1)).join(",");
}

/** Overpass espera el bbox como (sur,oeste,norte,este). */
function bboxFilter(bbox: Bbox): string {
  return `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
}

// admin_level en España: 6 = provincia (esa no se consulta, es estática),
// 8 = municipio, 9/10 = distrito/barrio. Los barrios como relación solo
// existen en ciudades grandes, así que el nivel "local" acepta también los
// nodos place=suburb/quarter/neighbourhood, que sí están por todas partes.
const LEVEL_QUERY: Record<Exclude<ZoneLevel, "provincia">, (bbox: Bbox) => string> = {
  municipio: (bbox) => `
    [out:json][timeout:25];
    relation["boundary"="administrative"]["admin_level"="8"]["name"]${bboxFilter(bbox)};
    out tags center;
  `,
  local: (bbox) => `
    [out:json][timeout:25];
    (
      relation["boundary"="administrative"]["admin_level"~"^(9|10)$"]["name"]${bboxFilter(bbox)};
      node["place"~"^(suburb|quarter|neighbourhood)$"]["name"]${bboxFilter(bbox)};
    );
    out tags center;
  `,
};

const BEACHES_QUERY = (bbox: Bbox) => `
  [out:json][timeout:25];
  (
    way["natural"="beach"]${bboxFilter(bbox)};
    node["natural"="beach"]${bboxFilter(bbox)};
  );
  out tags center;
`;

async function overpass(query: string): Promise<OverpassElement[]> {
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });
  if (!res.ok) {
    throw new Error(`Overpass respondió ${res.status}`);
  }
  const data = (await res.json()) as { elements: OverpassElement[] };
  return data.elements;
}

function toCandidates(elements: OverpassElement[]): ZoneCandidate[] {
  const seen = new Set<string>();
  const candidates: ZoneCandidate[] = [];

  for (const el of elements) {
    const lat = el.center?.lat ?? el.lat;
    const lon = el.center?.lon ?? el.lon;
    const name = el.tags?.name;
    if (lat === undefined || lon === undefined || !name) continue;
    // Un mismo barrio puede estar mapeado como relación y como nodo; el
    // nombre basta para no pintar dos chips encima del otro.
    if (seen.has(name)) continue;
    seen.add(name);
    candidates.push({ id: `${el.type}/${el.id}`, name, lat, lon });
  }

  return candidates;
}

/** Zonas administrativas (municipios o barrios) que caen en el área visible. */
export async function findZonesInBbox(level: Exclude<ZoneLevel, "provincia">, bbox: Bbox): Promise<ZoneCandidate[]> {
  const snapped = snapBbox(bbox);
  return getOrSet(`zones:${level}:${bboxKey(snapped)}`, SEVEN_DAYS_MS, async () =>
    toCandidates(await overpass(LEVEL_QUERY[level](snapped))),
  );
}

/** Playas del área visible — sirven para saber qué zonas tienen costa. */
export async function findBeachesInBbox(bbox: Bbox): Promise<LatLon[]> {
  const snapped = snapBbox(bbox);
  return getOrSet(`beaches:${bboxKey(snapped)}`, SEVEN_DAYS_MS, async () => {
    const elements = await overpass(BEACHES_QUERY(snapped));
    return elements
      .map((el) => ({ lat: el.center?.lat ?? el.lat, lon: el.center?.lon ?? el.lon }))
      .filter((c): c is LatLon => c.lat !== undefined && c.lon !== undefined);
  });
}

/**
 * En modo mar solo tienen sentido las zonas con costa, y hay que puntuarlas
 * sobre el agua (la API marina devuelve nulos tierra adentro). En vez de
 * hacer geometría de polígonos, se asigna cada playa a la zona cuyo centro
 * tiene más cerca: la zona se queda con la playa más próxima como punto de
 * anclaje, y las zonas sin ninguna playa asignada desaparecen del mapa.
 */
export function anchorZonesToCoast(zones: ZoneCandidate[], beaches: LatLon[], maxDistanceKm = 25): ZoneCandidate[] {
  if (zones.length === 0 || beaches.length === 0) return [];

  const nearestBeach = new Map<string, { beach: LatLon; km: number }>();

  for (const beach of beaches) {
    let closest: { zone: ZoneCandidate; km: number } | null = null;
    for (const zone of zones) {
      const km = distanceKm(zone, beach);
      if (!closest || km < closest.km) closest = { zone, km };
    }
    if (!closest || closest.km > maxDistanceKm) continue;

    const current = nearestBeach.get(closest.zone.id);
    if (!current || closest.km < current.km) {
      nearestBeach.set(closest.zone.id, { beach, km: closest.km });
    }
  }

  return zones
    .filter((zone) => nearestBeach.has(zone.id))
    .map((zone) => {
      const { beach } = nearestBeach.get(zone.id)!;
      return { ...zone, lat: beach.lat, lon: beach.lon };
    });
}

/** Deja las zonas más próximas al centro del área visible (chips legibles). */
export function limitToNearest(zones: ZoneCandidate[], center: LatLon, max: number): ZoneCandidate[] {
  if (zones.length <= max) return zones;
  return [...zones].sort((a, b) => distanceKm(center, a) - distanceKm(center, b)).slice(0, max);
}

/** El zoom del mapa decide la granularidad de los chips. */
export function levelForZoom(zoom: number): ZoneLevel {
  if (zoom <= 8) return "provincia";
  if (zoom <= 11) return "municipio";
  return "local";
}
