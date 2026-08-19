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
 *
 * AVISO sobre las coordenadas: están puestas a mano por conocimiento general
 * de cada sitio, no verificadas contra un mapa. Para las capitales grandes
 * (Madrid, Barcelona...) el margen de error es mínimo; para pueblos costeros
 * pequeños (la ampliación de la costa gallega) puede haber más desviación —
 * sigue siendo suficiente para centrar el mapa y pedir meteo de la zona, pero
 * no lo tomes como una posición exacta de la playa.
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
  // Resto de la costa gallega: cobertura de Lugo (Ribadeo→Cedeira) y de las
  // Rías Baixas (Muros→A Guarda), para que la vista general del mapa no deje
  // huecos grandes en la costa. Cada localidad lleva su playa principal y,
  // cuando el pueblo tiene paseo marítimo conocido, una zona de paseo/running
  // en el mismo punto (misma coordenada: el paseo corre junto a la playa).
  {
    displayName: "Ribadeo, Lugo, Galicia, España",
    lat: 43.5401,
    lon: -7.0402,
    aliases: ["ribadeo"],
    zones: [{ name: "Playa de As Catedrais", lat: 43.5589, lon: -7.1653, categories: ["beach"] }],
  },
  {
    displayName: "Foz, Lugo, Galicia, España",
    lat: 43.5701,
    lon: -7.2542,
    aliases: ["foz"],
    zones: [{ name: "Playa de A Rapadoira", lat: 43.5731, lon: -7.2536, categories: ["beach"] }],
  },
  {
    displayName: "Viveiro, Lugo, Galicia, España",
    lat: 43.6631,
    lon: -7.5867,
    aliases: ["viveiro"],
    zones: [{ name: "Playa de Covas", lat: 43.6701, lon: -7.6072, categories: ["beach"] }],
  },
  {
    displayName: "Ortigueira, A Coruña, Galicia, España",
    lat: 43.6772,
    lon: -7.8535,
    aliases: ["ortigueira"],
    zones: [{ name: "Playa de Morouzos", lat: 43.7027, lon: -7.8493, categories: ["beach"] }],
  },
  {
    displayName: "Cedeira, A Coruña, Galicia, España",
    lat: 43.6551,
    lon: -8.0762,
    aliases: ["cedeira"],
    zones: [{ name: "Playa de Vilarrube", lat: 43.6717, lon: -8.0651, categories: ["beach"] }],
  },
  {
    displayName: "Ferrol, A Coruña, Galicia, España",
    lat: 43.4832,
    lon: -8.2369,
    aliases: ["ferrol"],
    zones: [
      { name: "Playa de Doniños", lat: 43.5017, lon: -8.2921, categories: ["beach"] },
      { name: "Paseo de la Malata", lat: 43.4832, lon: -8.2369, categories: ["urbanPath"] },
    ],
  },
  {
    displayName: "Muros, A Coruña, Galicia, España",
    lat: 42.7770,
    lon: -9.0605,
    aliases: ["muros"],
    zones: [{ name: "Playa de San Francisco", lat: 42.7761, lon: -9.0590, categories: ["beach"] }],
  },
  {
    displayName: "Noia, A Coruña, Galicia, España",
    lat: 42.7822,
    lon: -8.8836,
    aliases: ["noia"],
    zones: [{ name: "Playa de Testal", lat: 42.7735, lon: -8.9020, categories: ["beach"] }],
  },
  {
    displayName: "O Porto do Son, A Coruña, Galicia, España",
    lat: 42.7024,
    lon: -9.0181,
    aliases: ["o porto do son", "porto do son"],
    zones: [{ name: "Playa de Area Longa", lat: 42.6890, lon: -9.0625, categories: ["beach"] }],
  },
  {
    displayName: "Ribeira, A Coruña, Galicia, España",
    lat: 42.5588,
    lon: -8.9885,
    aliases: ["ribeira", "santa uxia de ribeira"],
    zones: [{ name: "Playa de Coroso", lat: 42.5622, lon: -8.9945, categories: ["beach"] }],
  },
  {
    displayName: "Boiro, A Coruña, Galicia, España",
    lat: 42.6486,
    lon: -8.8814,
    aliases: ["boiro"],
    zones: [{ name: "Playa de Barraña", lat: 42.6389, lon: -8.8737, categories: ["beach"] }],
  },
  {
    displayName: "Vilagarcía de Arousa, Pontevedra, Galicia, España",
    lat: 42.5967,
    lon: -8.7669,
    aliases: ["vilagarcia", "vilagarcia de arousa"],
    zones: [{ name: "Playa de Compostela", lat: 42.6058, lon: -8.7733, categories: ["beach"] }],
  },
  {
    displayName: "Sanxenxo, Pontevedra, Galicia, España",
    lat: 42.4003,
    lon: -8.8107,
    aliases: ["sanxenxo"],
    zones: [
      { name: "Playa de Silgar", lat: 42.3987, lon: -8.8074, categories: ["beach"] },
      { name: "Paseo de Sanxenxo", lat: 42.4003, lon: -8.8107, categories: ["urbanPath"] },
    ],
  },
  {
    displayName: "O Grove, Pontevedra, Galicia, España",
    lat: 42.4863,
    lon: -8.8712,
    aliases: ["o grove", "grove"],
    zones: [{ name: "Playa de A Lanzada", lat: 42.4489, lon: -8.8570, categories: ["beach"] }],
  },
  {
    displayName: "Pontevedra, Galicia, España",
    lat: 42.4310,
    lon: -8.6444,
    aliases: ["pontevedra"],
    zones: [{ name: "Paseo das Corbaceiras", lat: 42.4310, lon: -8.6444, categories: ["urbanPath", "cycleway"] }],
  },
  {
    displayName: "Baiona, Pontevedra, Galicia, España",
    lat: 42.1198,
    lon: -8.8451,
    aliases: ["baiona", "bayona"],
    zones: [{ name: "Playa de América", lat: 42.1275, lon: -8.8451, categories: ["beach"] }],
  },
  {
    displayName: "A Guarda, Pontevedra, Galicia, España",
    lat: 41.9018,
    lon: -8.8735,
    aliases: ["a guarda", "guarda"],
    zones: [{ name: "Playa do Muíño", lat: 41.9089, lon: -8.8829, categories: ["beach"] }],
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

export interface OverviewZone {
  locality: string;
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * Todas las zonas del deporte pedido, de todas las localidades precalculadas
 * a la vez. Es la base de la vista general del mapa ("ver el estado a nivel
 * de España sin dar a buscar"): un vistazo así sobre datos en vivo pediría
 * Overpass para todo el país en cada carga, lo que no es viable con APIs
 * públicas que limitan por IP. Sobre este conjunto fijo solo hace falta pedir
 * meteo (una llamada por lote, cacheada), así que sale barato e instantáneo.
 */
export function allSeedZones(sport: Sport): OverviewZone[] {
  const category = SPORT_CATEGORY[sport];
  return LOCALITIES.flatMap((locality) =>
    locality.zones
      .filter((zone) => zone.categories.includes(category))
      .map((zone) => ({
        locality: locality.displayName,
        id: `seed/${normalize(zone.name).replace(/\s+/g, "-")}`,
        name: zone.name,
        lat: zone.lat,
        lon: zone.lon,
      })),
  );
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
