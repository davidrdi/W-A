import type { Spot, SpotAmenities, Sport } from "@w-a/shared";
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

// Varios deportes comparten el mismo tipo de lugar en OSM (running y paseo
// buscan lo mismo: parques y sendas urbanas; playa/surf/windsurf buscan
// todas "natural=beach" — lo que cambia entre ellos es el SCORING, no el
// sitio). Así se cachea una sola vez por categoría en vez de una vez por
// deporte.
type SpotCategory = "urbanPath" | "trail" | "cycleway" | "beach";

const SPORT_CATEGORY: Record<Sport, SpotCategory> = {
  running: "urbanPath",
  paseo: "urbanPath",
  senderismo: "trail",
  bici: "cycleway",
  playa: "beach",
  surf: "beach",
  windsurf: "beach",
};

// area(id) limita la búsqueda al polígono administrativo real resuelto por
// Nominatim — no a un radio de distancia, que es lo que colaría spots de un
// municipio vecino (ver decisión "Precisión geográfica" del plan). Las zonas
// del mapa que no son un polígono (un barrio mapeado como nodo place=*) no
// tienen area, y para esas sí se busca por radio: ver findSpotsAround.
const CATEGORY_FILTERS: Record<SpotCategory, (scope: string) => string> = {
  urbanPath: (scope) => `
      way["leisure"="park"]${scope};
      way["highway"~"^(footway|path|pedestrian|track)$"]["foot"!="no"]${scope};
  `,
  trail: (scope) => `
      relation["route"="hiking"]${scope};
      way["highway"~"^(path|track)$"]["sac_scale"]${scope};
  `,
  cycleway: (scope) => `
      relation["route"="bicycle"]${scope};
      way["highway"="cycleway"]${scope};
  `,
  beach: (scope) => `
      way["natural"="beach"]${scope};
      node["natural"="beach"]${scope};
  `,
};

function areaQuery(category: SpotCategory, areaId: number): string {
  return `
    [out:json][timeout:25];
    area(${areaId})->.searchArea;
    (${CATEGORY_FILTERS[category]("(area.searchArea)")});
    out tags center;
  `;
}

function aroundQuery(category: SpotCategory, lat: number, lon: number, radiusM: number): string {
  return `
    [out:json][timeout:25];
    (${CATEGORY_FILTERS[category](`(around:${radiusM},${lat},${lon})`)});
    out tags center;
  `;
}

// `out tags center` ya trae todos los tags de OSM del elemento — solo hace
// falta leer los que nos interesan. Ausencia de tag = "sin dato" (undefined),
// nunca se asume "no": si OSM no dice nada de perros, no afirmamos que estén
// prohibidos.
function parseAmenities(tags: Record<string, string> | undefined): SpotAmenities | undefined {
  if (!tags) return undefined;
  const amenities: SpotAmenities = {};

  if (tags.naturist === "yes") amenities.naturist = true;
  else if (tags.naturist === "no") amenities.naturist = false;

  if (tags.dog === "yes" || tags.dog === "leashed") amenities.dogsAllowed = true;
  else if (tags.dog === "no") amenities.dogsAllowed = false;

  return Object.keys(amenities).length > 0 ? amenities : undefined;
}

function fallbackName(el: OverpassElement, category: SpotCategory): string {
  if (el.tags?.leisure === "park") return "Parque sin nombre";
  if (el.tags?.natural === "beach") return "Playa sin nombre";
  if (category === "trail") return "Sendero sin nombre";
  if (category === "cycleway") return "Ruta ciclista sin nombre";
  return "Camino sin nombre";
}

// Se cachean los elementos crudos de Overpass por categoría — nunca el
// resultado ya mapeado a Spot, porque el campo `sport` depende de qué
// deporte pidió la consulta (una misma playa sirve para playa/surf/windsurf).
async function fetchCategoryElements(cacheKey: string, query: string): Promise<OverpassElement[]> {
  return getOrSet(cacheKey, SEVEN_DAYS_MS, async () => {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
    });
    if (!res.ok) {
      throw new Error(`Overpass respondió ${res.status}`);
    }
    const data = (await res.json()) as OverpassResponse;
    return data.elements;
  });
}

export async function findSpots(sport: Sport, areaId: number, limit = 8): Promise<Spot[]> {
  const category = SPORT_CATEGORY[sport];
  const elements = await fetchCategoryElements(`spots:${category}:${areaId}`, areaQuery(category, areaId));
  return toSpots(elements, sport, category, limit);
}

/**
 * Igual que findSpots pero por radio, para zonas del mapa que no tienen
 * polígono administrativo en OSM (barrios mapeados como nodo place=*).
 */
export async function findSpotsAround(
  sport: Sport,
  point: { lat: number; lon: number },
  radiusM: number,
  limit = 8,
): Promise<Spot[]> {
  const category = SPORT_CATEGORY[sport];
  const key = `spots:${category}:around:${point.lat.toFixed(3)},${point.lon.toFixed(3)},${radiusM}`;
  const elements = await fetchCategoryElements(key, aroundQuery(category, point.lat, point.lon, radiusM));
  return toSpots(elements, sport, category, limit);
}

function toSpots(elements: OverpassElement[], sport: Sport, category: SpotCategory, limit: number): Spot[] {
  const withCoords = elements.filter((el) => el.center || (el.lat !== undefined && el.lon !== undefined));
  const named = withCoords.filter((el) => el.tags?.name);
  const pool = named.length >= limit ? named : withCoords;

  return pool.slice(0, limit).map((el) => {
    const lat = el.center?.lat ?? el.lat!;
    const lon = el.center?.lon ?? el.lon!;
    return {
      id: `${el.type}/${el.id}`,
      name: el.tags?.name ?? fallbackName(el, category),
      lat,
      lon,
      sport,
      amenities: parseAmenities(el.tags),
    };
  });
}
