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
// municipio vecino (ver decisión "Precisión geográfica" del plan).
const CATEGORY_QUERY: Record<SpotCategory, (areaId: number) => string> = {
  urbanPath: (areaId) => `
    [out:json][timeout:25];
    area(${areaId})->.searchArea;
    (
      way["leisure"="park"](area.searchArea);
      way["highway"~"^(footway|path|pedestrian|track)$"]["foot"!="no"](area.searchArea);
    );
    out tags center;
  `,
  trail: (areaId) => `
    [out:json][timeout:25];
    area(${areaId})->.searchArea;
    (
      relation["route"="hiking"](area.searchArea);
      way["highway"~"^(path|track)$"]["sac_scale"](area.searchArea);
    );
    out tags center;
  `,
  cycleway: (areaId) => `
    [out:json][timeout:25];
    area(${areaId})->.searchArea;
    (
      relation["route"="bicycle"](area.searchArea);
      way["highway"="cycleway"](area.searchArea);
    );
    out tags center;
  `,
  beach: (areaId) => `
    [out:json][timeout:25];
    area(${areaId})->.searchArea;
    (
      way["natural"="beach"](area.searchArea);
      node["natural"="beach"](area.searchArea);
    );
    out tags center;
  `,
};

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
async function fetchCategoryElements(category: SpotCategory, areaId: number): Promise<OverpassElement[]> {
  return getOrSet(`spots:${category}:${areaId}`, SEVEN_DAYS_MS, async () => {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: CATEGORY_QUERY[category](areaId),
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
  const elements = await fetchCategoryElements(category, areaId);

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
