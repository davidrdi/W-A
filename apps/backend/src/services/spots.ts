import type { Spot, SpotAmenities, Sport } from "@w-a/shared";
import { getOrSet, SEVEN_DAYS_MS } from "../lib/cache.js";

// La política de uso de Overpass (como la de Nominatim) exige un User-Agent que
// identifique a la aplicación. `fetch` de Node manda "node" a secas, y el proxy de
// overpass-api.de responde 406 (Not Acceptable) a clientes genéricos como ese.
const USER_AGENT = "w-a-app/0.1 (+https://github.com/davidrdi/W-A)";

// Varias instancias: las públicas limitan por IP, y en un hosting compartido como
// Render la IP de salida va con otros inquilinos, así que una sola instancia se
// queda corta. Se prueban en orden hasta que una responde.
const DEFAULT_OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const OVERPASS_ENDPOINTS = process.env.OVERPASS_ENDPOINT
  ? [process.env.OVERPASS_ENDPOINT]
  : DEFAULT_OVERPASS_ENDPOINTS;

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
/**
 * Lanza la consulta contra las instancias de Overpass en orden y devuelve la primera
 * que responda. Si fallan todas, el error menciona todos los intentos: con una sola
 * instancia un 406/429 puntual dejaba la búsqueda muerta sin pista de por qué.
 */
async function queryOverpass(query: string): Promise<OverpassResponse> {
  const failures: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          // Forma canónica documentada por Overpass. El texto plano también lo
          // acepta el servidor, pero los proxies que tienen delante las instancias
          // públicas son más quisquillosos y responden 406.
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({ data: query }).toString(),
      });

      if (!res.ok) {
        failures.push(`${endpoint} respondió ${res.status}`);
        continue;
      }
      return (await res.json()) as OverpassResponse;
    } catch (error) {
      failures.push(`${endpoint}: ${error instanceof Error ? error.message : "error de red"}`);
    }
  }

  throw new Error(`Overpass no respondió en ninguna instancia (${failures.join("; ")})`);
}

async function fetchCategoryElements(category: SpotCategory, areaId: number): Promise<OverpassElement[]> {
  return getOrSet(`spots:${category}:${areaId}`, SEVEN_DAYS_MS, async () => {
    const data = await queryOverpass(CATEGORY_QUERY[category](areaId));
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
