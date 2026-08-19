import type { Spot, Sport } from "@w-a/shared";

/**
 * Zonas de arranque para las localidades más consultadas de España.
 *
 * POR QUÉ EXISTE: las zonas salen de Overpass (OpenStreetMap) y la localidad de
 * Nominatim. Las dos son APIs públicas que limitan por IP, y en un hosting
 * compartido como el plan gratuito de Render la IP de salida va con otros
 * inquilinos — así que responden 429/406 con relativa facilidad y la app se
 * queda sin nada que pintar. Este conjunto garantiza que siempre haya zonas.
 *
 * PRECEDENCIA: es un FALLBACK, no la fuente de verdad. Si Overpass responde,
 * mandan sus datos (más completos y siempre al día). Esto solo entra cuando la
 * vía en vivo falla, y la respuesta lo marca con `source: "seed"`.
 *
 * PROCEDENCIA DE LOS DATOS: lugares reales, con coordenadas aproximadas
 * (precisión de cientos de metros, suficiente para centrar el mapa y pedir la
 * meteo de la zona, que se calcula sobre una celda de varios km). No salen de
 * una descarga de OSM, así que no tienen osm_id: sus ids llevan el prefijo
 * "seed/" precisamente para que nunca se confundan con los de OSM.
 */

interface SeedZone {
  name: string;
  lat: number;
  lon: number;
  /** Categorías de deporte a las que sirve esta zona. */
  categories: SeedCategory[];
}

// Mismas categorías que services/spots.ts: lo que cambia entre running y paseo
// (o entre playa, surf y windsurf) es el scoring, no el sitio.
type SeedCategory = "urbanPath" | "trail" | "cycleway" | "beach";

const SPORT_CATEGORY: Record<Sport, SeedCategory> = {
  running: "urbanPath",
  paseo: "urbanPath",
  senderismo: "trail",
  bici: "cycleway",
  playa: "beach",
  surf: "beach",
  windsurf: "beach",
};

interface SeedLocality {
  displayName: string;
  lat: number;
  lon: number;
  /** Alias en minúsculas y sin tildes por los que se puede pedir esta localidad. */
  aliases: string[];
  zones: SeedZone[];
}

const LOCALITIES: SeedLocality[] = [
  {
    displayName: "A Coruña, Galicia, España",
    lat: 43.3623,
    lon: -8.4115,
    aliases: ["a coruna", "coruna", "la coruna"],
    zones: [
      { name: "Parque de Santa Margarita", lat: 43.3596, lon: -8.4074, categories: ["urbanPath", "cycleway"] },
      { name: "Paseo Marítimo", lat: 43.3711, lon: -8.4123, categories: ["urbanPath", "cycleway"] },
      { name: "Monte de San Pedro", lat: 43.3665, lon: -8.4364, categories: ["urbanPath", "trail"] },
      { name: "Playa de Riazor", lat: 43.3695, lon: -8.4110, categories: ["beach"] },
      { name: "Playa del Orzán", lat: 43.3722, lon: -8.4035, categories: ["beach"] },
      { name: "Torre de Hércules", lat: 43.3853, lon: -8.4064, categories: ["urbanPath", "trail"] },
    ],
  },
  {
    displayName: "Vigo, Galicia, España",
    lat: 42.2406,
    lon: -8.7207,
    aliases: ["vigo"],
    zones: [
      { name: "Parque de Castrelos", lat: 42.2192, lon: -8.7267, categories: ["urbanPath", "cycleway"] },
      { name: "Monte do Castro", lat: 42.2338, lon: -8.7243, categories: ["urbanPath", "trail"] },
      { name: "Playa de Samil", lat: 42.2058, lon: -8.7684, categories: ["beach"] },
      { name: "Parque do Monte da Guía", lat: 42.2495, lon: -8.6899, categories: ["trail"] },
    ],
  },
  {
    displayName: "Madrid, Comunidad de Madrid, España",
    lat: 40.4168,
    lon: -3.7038,
    aliases: ["madrid"],
    zones: [
      { name: "Parque del Retiro", lat: 40.4153, lon: -3.6844, categories: ["urbanPath", "cycleway"] },
      { name: "Casa de Campo", lat: 40.4190, lon: -3.7500, categories: ["urbanPath", "trail", "cycleway"] },
      { name: "Madrid Río", lat: 40.4014, lon: -3.7183, categories: ["urbanPath", "cycleway"] },
      { name: "Parque del Oeste", lat: 40.4283, lon: -3.7247, categories: ["urbanPath"] },
      { name: "Monte de El Pardo", lat: 40.5200, lon: -3.7700, categories: ["trail", "cycleway"] },
    ],
  },
  {
    displayName: "Barcelona, Cataluña, España",
    lat: 41.3874,
    lon: 2.1686,
    aliases: ["barcelona", "bcn"],
    zones: [
      { name: "Parc de la Ciutadella", lat: 41.3880, lon: 2.1870, categories: ["urbanPath", "cycleway"] },
      { name: "Montjuïc", lat: 41.3641, lon: 2.1587, categories: ["urbanPath", "trail", "cycleway"] },
      { name: "Parc del Guinardó", lat: 41.4185, lon: 2.1725, categories: ["urbanPath", "trail"] },
      { name: "Platja de la Barceloneta", lat: 41.3784, lon: 2.1925, categories: ["beach"] },
      { name: "Platja de la Mar Bella", lat: 41.3960, lon: 2.2110, categories: ["beach"] },
    ],
  },
  {
    displayName: "Valencia, Comunidad Valenciana, España",
    lat: 39.4699,
    lon: -0.3763,
    aliases: ["valencia", "valència"],
    zones: [
      { name: "Jardín del Turia", lat: 39.4750, lon: -0.3650, categories: ["urbanPath", "cycleway"] },
      { name: "Parque de Cabecera", lat: 39.4780, lon: -0.4000, categories: ["urbanPath", "cycleway"] },
      { name: "Playa de la Malvarrosa", lat: 39.4756, lon: -0.3251, categories: ["beach"] },
      { name: "Playa de El Saler", lat: 39.3830, lon: -0.3260, categories: ["beach"] },
    ],
  },
  {
    displayName: "Sevilla, Andalucía, España",
    lat: 37.3891,
    lon: -5.9845,
    aliases: ["sevilla"],
    zones: [
      { name: "Parque de María Luisa", lat: 37.3775, lon: -5.9880, categories: ["urbanPath", "cycleway"] },
      { name: "Paseo junto al Guadalquivir", lat: 37.3860, lon: -6.0010, categories: ["urbanPath", "cycleway"] },
      { name: "Parque del Alamillo", lat: 37.4145, lon: -5.9880, categories: ["urbanPath", "trail", "cycleway"] },
    ],
  },
  {
    displayName: "Bilbao, País Vasco, España",
    lat: 43.2630,
    lon: -2.9350,
    aliases: ["bilbao", "bilbo"],
    zones: [
      { name: "Parque de Doña Casilda", lat: 43.2670, lon: -2.9420, categories: ["urbanPath"] },
      { name: "Ría de Bilbao (paseo)", lat: 43.2680, lon: -2.9340, categories: ["urbanPath", "cycleway"] },
      { name: "Monte Artxanda", lat: 43.2760, lon: -2.9310, categories: ["trail"] },
    ],
  },
  {
    displayName: "Donostia-San Sebastián, País Vasco, España",
    lat: 43.3183,
    lon: -1.9812,
    aliases: ["san sebastian", "donostia", "donostia-san sebastian"],
    zones: [
      { name: "Playa de la Concha", lat: 43.3180, lon: -1.9880, categories: ["beach"] },
      { name: "Playa de la Zurriola", lat: 43.3240, lon: -1.9750, categories: ["beach"] },
      { name: "Monte Urgull", lat: 43.3245, lon: -1.9855, categories: ["trail", "urbanPath"] },
      { name: "Paseo Nuevo", lat: 43.3235, lon: -1.9905, categories: ["urbanPath", "cycleway"] },
    ],
  },
  {
    displayName: "Málaga, Andalucía, España",
    lat: 36.7213,
    lon: -4.4214,
    aliases: ["malaga"],
    zones: [
      { name: "Playa de la Malagueta", lat: 36.7185, lon: -4.4090, categories: ["beach"] },
      { name: "Parque de Málaga", lat: 36.7185, lon: -4.4175, categories: ["urbanPath"] },
      { name: "Monte de Gibralfaro", lat: 36.7238, lon: -4.4102, categories: ["trail", "urbanPath"] },
    ],
  },
  {
    displayName: "Santander, Cantabria, España",
    lat: 43.4623,
    lon: -3.8100,
    aliases: ["santander"],
    zones: [
      { name: "Playa del Sardinero", lat: 43.4785, lon: -3.7840, categories: ["beach"] },
      { name: "Península de la Magdalena", lat: 43.4713, lon: -3.7690, categories: ["urbanPath", "trail"] },
      { name: "Parque de Mataleñas", lat: 43.4838, lon: -3.7808, categories: ["urbanPath", "trail"] },
    ],
  },
];

/** Quita tildes y normaliza para que "A Coruña" y "a coruna" casen igual. */
function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export interface SeedLocalityMatch {
  displayName: string;
  lat: number;
  lon: number;
  zones: SeedZone[];
}

export function findSeedLocality(query: string): SeedLocalityMatch | null {
  const q = normalize(query);
  if (!q) return null;

  const match = LOCALITIES.find((locality) =>
    // Coincidencia por inclusión en los dos sentidos para que "playa en Vigo"
    // o "Vigo, Galicia" sigan encontrando Vigo.
    locality.aliases.some((alias) => q === alias || q.includes(alias) || alias.includes(q)),
  );
  if (!match) return null;

  return { displayName: match.displayName, lat: match.lat, lon: match.lon, zones: match.zones };
}

export function seedSpotsFor(locality: SeedLocalityMatch, sport: Sport, limit: number): Spot[] {
  const category = SPORT_CATEGORY[sport];
  return locality.zones
    .filter((zone) => zone.categories.includes(category))
    .slice(0, limit)
    .map((zone) => ({
      // Prefijo "seed/" para que estos ids nunca se confundan con los de OSM
      // ("way/123"), ni al guardarlos en favoritos ni al cachearlos.
      id: `seed/${normalize(zone.name).replace(/\s+/g, "-")}`,
      name: zone.name,
      lat: zone.lat,
      lon: zone.lon,
      sport,
    }));
}
