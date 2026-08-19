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
  // Resto de capitales/ciudades grandes para que la vista general de
  // running/paseo/senderismo/bici cubra todo el país, no solo el norte y las
  // grandes capitales de partida. Un zona por ciudad (parque o paseo
  // conocido); playa solo en las que son costeras.
  {
    displayName: "Zaragoza, Aragón, España",
    lat: 41.6488,
    lon: -0.8891,
    aliases: ["zaragoza"],
    zones: [{ name: "Parque Grande José Antonio Labordeta", lat: 41.6316, lon: -0.9046, categories: ["urbanPath", "cycleway"] }],
  },
  {
    displayName: "Vitoria-Gasteiz, País Vasco, España",
    lat: 42.8467,
    lon: -2.6716,
    aliases: ["vitoria", "vitoria-gasteiz", "gasteiz"],
    zones: [{ name: "Anillo Verde de Vitoria", lat: 42.8467, lon: -2.6716, categories: ["urbanPath", "trail", "cycleway"] }],
  },
  {
    displayName: "Pamplona, Navarra, España",
    lat: 42.8125,
    lon: -1.6458,
    aliases: ["pamplona", "iruna"],
    zones: [{ name: "Parque de la Taconera", lat: 42.8177, lon: -1.6510, categories: ["urbanPath"] }],
  },
  {
    displayName: "Logroño, La Rioja, España",
    lat: 42.4627,
    lon: -2.4449,
    aliases: ["logrono"],
    zones: [{ name: "Parque del Ebro", lat: 42.4680, lon: -2.4460, categories: ["urbanPath", "cycleway"] }],
  },
  {
    displayName: "Valladolid, Castilla y León, España",
    lat: 41.6523,
    lon: -4.7245,
    aliases: ["valladolid"],
    zones: [{ name: "Campo Grande", lat: 41.6467, lon: -4.7256, categories: ["urbanPath"] }],
  },
  {
    displayName: "Salamanca, Castilla y León, España",
    lat: 40.9701,
    lon: -5.6635,
    aliases: ["salamanca"],
    zones: [{ name: "Parque de la Alamedilla", lat: 40.9636, lon: -5.6595, categories: ["urbanPath"] }],
  },
  {
    displayName: "León, Castilla y León, España",
    lat: 42.5987,
    lon: -5.5671,
    aliases: ["leon"],
    zones: [{ name: "Parque del Cid", lat: 42.5960, lon: -5.5620, categories: ["urbanPath", "cycleway"] }],
  },
  {
    displayName: "Burgos, Castilla y León, España",
    lat: 42.3439,
    lon: -3.6969,
    aliases: ["burgos"],
    zones: [{ name: "Parque del Castillo", lat: 42.3450, lon: -3.7040, categories: ["urbanPath", "trail"] }],
  },
  {
    displayName: "Toledo, Castilla-La Mancha, España",
    lat: 39.8628,
    lon: -4.0273,
    aliases: ["toledo"],
    zones: [{ name: "Parque de la Vega Baja", lat: 39.8650, lon: -4.0270, categories: ["urbanPath"] }],
  },
  {
    displayName: "Albacete, Castilla-La Mancha, España",
    lat: 38.9943,
    lon: -1.8585,
    aliases: ["albacete"],
    zones: [{ name: "Parque Abelardo Sánchez", lat: 38.9975, lon: -1.8530, categories: ["urbanPath"] }],
  },
  {
    displayName: "Cáceres, Extremadura, España",
    lat: 39.4753,
    lon: -6.3724,
    aliases: ["caceres"],
    zones: [{ name: "Parque del Príncipe", lat: 39.4680, lon: -6.3690, categories: ["urbanPath"] }],
  },
  {
    displayName: "Badajoz, Extremadura, España",
    lat: 38.8794,
    lon: -6.9707,
    aliases: ["badajoz"],
    zones: [{ name: "Parque de Castelar", lat: 38.8770, lon: -6.9720, categories: ["urbanPath", "cycleway"] }],
  },
  {
    displayName: "Córdoba, Andalucía, España",
    lat: 37.8882,
    lon: -4.7794,
    aliases: ["cordoba"],
    zones: [{ name: "Jardines de la Agricultura", lat: 37.8850, lon: -4.7720, categories: ["urbanPath"] }],
  },
  {
    displayName: "Granada, Andalucía, España",
    lat: 37.1773,
    lon: -3.5986,
    aliases: ["granada"],
    zones: [{ name: "Parque Federico García Lorca", lat: 37.1650, lon: -3.6120, categories: ["urbanPath"] }],
  },
  {
    displayName: "Almería, Andalucía, España",
    lat: 36.8381,
    lon: -2.4597,
    aliases: ["almeria"],
    zones: [{ name: "Playa de las Almadrabillas", lat: 36.8340, lon: -2.4480, categories: ["beach"] }],
  },
  {
    displayName: "Cádiz, Andalucía, España",
    lat: 36.5271,
    lon: -6.2886,
    aliases: ["cadiz"],
    zones: [
      { name: "Playa de la Caleta", lat: 36.5330, lon: -6.3010, categories: ["beach"] },
      { name: "Parque Genovés", lat: 36.5340, lon: -6.2990, categories: ["urbanPath"] },
    ],
  },
  {
    displayName: "Jaén, Andalucía, España",
    lat: 37.7796,
    lon: -3.7849,
    aliases: ["jaen"],
    zones: [{ name: "Parque de la Concordia", lat: 37.7720, lon: -3.7900, categories: ["urbanPath"] }],
  },
  {
    displayName: "Huelva, Andalucía, España",
    lat: 37.2614,
    lon: -6.9447,
    aliases: ["huelva"],
    zones: [{ name: "Parque Moret", lat: 37.2700, lon: -6.9450, categories: ["urbanPath", "trail"] }],
  },
  {
    displayName: "Murcia, Región de Murcia, España",
    lat: 37.9922,
    lon: -1.1307,
    aliases: ["murcia"],
    zones: [{ name: "Jardín del Malecón", lat: 37.9880, lon: -1.1280, categories: ["urbanPath", "cycleway"] }],
  },
  {
    displayName: "Alicante, Comunidad Valenciana, España",
    lat: 38.3452,
    lon: -0.4810,
    aliases: ["alicante"],
    zones: [
      { name: "Playa del Postiguet", lat: 38.3430, lon: -0.4800, categories: ["beach"] },
      { name: "Explanada de España", lat: 38.3440, lon: -0.4820, categories: ["urbanPath"] },
    ],
  },
  {
    displayName: "Castellón de la Plana, Comunidad Valenciana, España",
    lat: 39.9864,
    lon: -0.0513,
    aliases: ["castellon", "castellon de la plana"],
    zones: [{ name: "Parque Ribalta", lat: 39.9840, lon: -0.0450, categories: ["urbanPath"] }],
  },
  {
    displayName: "Girona, Cataluña, España",
    lat: 41.9794,
    lon: 2.8214,
    aliases: ["girona", "gerona"],
    zones: [{ name: "Parc de la Devesa", lat: 41.9880, lon: 2.8180, categories: ["urbanPath", "cycleway"] }],
  },
  {
    displayName: "Lleida, Cataluña, España",
    lat: 41.6176,
    lon: 0.6200,
    aliases: ["lleida", "lerida"],
    zones: [{ name: "Parc de la Mitjana", lat: 41.6350, lon: 0.6350, categories: ["urbanPath", "trail"] }],
  },
  {
    displayName: "Tarragona, Cataluña, España",
    lat: 41.1189,
    lon: 1.2445,
    aliases: ["tarragona"],
    zones: [
      { name: "Platja del Miracle", lat: 41.1170, lon: 1.2560, categories: ["beach"] },
      { name: "Parc del Miracle", lat: 41.1180, lon: 1.2530, categories: ["urbanPath"] },
    ],
  },
  {
    displayName: "Palma de Mallorca, Baleares, España",
    lat: 39.5696,
    lon: 2.6502,
    aliases: ["palma", "palma de mallorca"],
    zones: [
      { name: "Playa de Palma", lat: 39.5290, lon: 2.7350, categories: ["beach"] },
      { name: "Parc de la Mar", lat: 39.5680, lon: 2.6480, categories: ["urbanPath"] },
    ],
  },
  {
    displayName: "Las Palmas de Gran Canaria, Canarias, España",
    lat: 28.1235,
    lon: -15.4363,
    aliases: ["las palmas", "las palmas de gran canaria"],
    zones: [
      { name: "Playa de Las Canteras", lat: 28.1440, lon: -15.4380, categories: ["beach"] },
      { name: "Parque de San Telmo", lat: 28.1240, lon: -15.4310, categories: ["urbanPath"] },
    ],
  },
  {
    displayName: "Santa Cruz de Tenerife, Canarias, España",
    lat: 28.4636,
    lon: -16.2518,
    aliases: ["santa cruz de tenerife", "tenerife"],
    zones: [{ name: "Parque García Sanabria", lat: 28.4700, lon: -16.2540, categories: ["urbanPath"] }],
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
