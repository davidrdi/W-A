export type Sport = "running" | "paseo" | "senderismo" | "bici" | "playa" | "surf" | "windsurf";

// Deportes que comparten el mismo tipo de lugar en OSM (ver
// apps/backend/src/services/spots.ts#SPORT_CATEGORY) — una misma playa
// sirve para playa/surf/windsurf, un mismo parque para running/paseo. Sirve
// para saber qué otros deportes tiene sentido puntuar en la misma zona.
export const SPORT_GROUPS: readonly Sport[][] = [
  ["running", "paseo"],
  ["senderismo"],
  ["bici"],
  ["playa", "surf", "windsurf"],
];

export function sportsInSameGroup(sport: Sport): Sport[] {
  return SPORT_GROUPS.find((group) => group.includes(sport)) ?? [sport];
}

export interface HealthResponse {
  status: "ok";
  service: string;
}

// De tags de OSM (naturist=yes, dog=yes/leashed/no). Todos opcionales:
// ausencia de campo significa "sin dato", no "no". `dogsAllowed` aplica a
// cualquier categoría (parques, senderos...), `naturist` solo a playas.
export interface SpotAmenities {
  naturist?: boolean;
  dogsAllowed?: boolean;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sport: Sport;
  amenities?: SpotAmenities;
}

export interface WeatherSnapshot {
  rainYesterdayMm: number;
  rainTodayMm: number;
  windAvgTodayKmh: number;
  windMaxTodayKmh: number;
  windDirectionMiddayDeg: number;
  temperatureAvgTodayC: number;
}

export interface RecommendedSpot extends Spot {
  weather: WeatherSnapshot;
  /** Solo presente para playa/surf/windsurf. */
  marine?: MarineSnapshot;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RecommendResponse {
  locality: string;
  sport: Sport;
  /** Centro de la localidad resuelta por geocoding — punto de referencia
   * para calcular distancia cuando no hay ubicación real del usuario. */
  localityCenter: LatLon;
  spots: RecommendedSpot[];
}

export type ScoreBand = "green" | "amber" | "red";

export interface ScoredSpot extends Spot {
  score: number;
  scoreBand: ScoreBand;
}

export interface SpotsResponse {
  locality: string;
  sport: Sport;
  localityCenter: LatLon;
  spots: ScoredSpot[];
}

export interface MarineSnapshot {
  waveHeightAvgM: number;
  waveHeightMaxM: number;
  seaSurfaceTempC: number;
}

// Datos ya calculados que se le pasan a Claude para que razone sobre ellos
// (nunca para que invente geografía ni meteo). El cliente lo recibe y lo
// reenvía tal cual en las preguntas de seguimiento, así el backend no
// necesita guardar sesión/estado por conversación.
export interface SpotGroundingPayload {
  sport: Sport;
  spotName: string;
  score: number;
  scoreBand: ScoreBand;
  weather: WeatherSnapshot;
  /** Solo presente para playa/surf/windsurf. */
  marine?: MarineSnapshot;
  amenities?: SpotAmenities;
}

export interface SpotExplanation {
  score: number;
  scoreBand: ScoreBand;
  headline: string;
  reasoning: string;
  cautions: string[];
  groundingPayload: SpotGroundingPayload;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ExplainRequest {
  sport: Sport;
  spotId: string;
  name: string;
  lat: number;
  lon: number;
  amenities?: SpotAmenities;
}

export interface FollowUpRequest {
  groundingPayload: SpotGroundingPayload;
  priorMessages: ChatMessage[];
  question: string;
}

export interface FollowUpResponse {
  answer: string;
}

export interface WeatherResponse {
  lat: number;
  lon: number;
  /** Solo presente si la consulta fue por nombre de localidad. */
  locality?: string;
  weather: WeatherSnapshot;
}

// Las dos "versiones" del mapa de zonas: condiciones para hacer deporte en
// la costa/mar o en tierra. No son deportes: son el contexto sobre el que se
// puntúa (ver scoring/rules.ts#scoreZone) y determinan qué deportes se
// listan al abrir una zona.
export type ZoneMode = "mar" | "tierra";

/**
 * Nivel de agregación de los chips del mapa, derivado del zoom: poco zoom
 * enseña una provincia, zoom medio un municipio y mucho zoom una zona
 * dentro de la ciudad (barrio/distrito).
 */
export type ZoneLevel = "provincia" | "municipio" | "local";

export interface ZoneChip {
  /** "provincia/a-coruna" (tabla estática) o "relation/349055" / "node/123" (OSM). */
  id: string;
  name: string;
  level: ZoneLevel;
  /**
   * Punto que se puntúa y donde se ancla el chip. En modo mar NO es el
   * centro geométrico de la zona sino un punto de costa (una playa real o,
   * a nivel provincia, un punto de mar representativo): la meteo marina en
   * el centro de la provincia no existe.
   */
  lat: number;
  lon: number;
  score: number;
  scoreBand: ScoreBand;
}

export interface ZonesResponse {
  mode: ZoneMode;
  /** Nivel realmente devuelto: puede ser menos fino que el pedido si OSM no
   * tiene zonas de ese nivel en el área visible. */
  level: ZoneLevel;
  zones: ZoneChip[];
}

export interface ZoneDetailResponse {
  zone: ZoneChip;
  weather: WeatherSnapshot;
  /** Solo en modo mar. */
  marine?: MarineSnapshot;
  /** Deportes del modo, de mejor a peor encaje con las condiciones de hoy. */
  sportFits: SportScore[];
  /** Mejores sitios concretos dentro de la zona (de mejor a peor). */
  best: ScoredSpot[];
  /** Peores sitios de la zona; vacío si no hay suficientes para distinguir. */
  worst: ScoredSpot[];
}

export interface Favorite {
  id: string;
  spotId: string;
  spotName: string;
  sport: Sport;
  lat: number;
  lon: number;
  createdAt: string;
}

export interface FavoritesResponse {
  favorites: Favorite[];
}

export interface CreateFavoriteRequest {
  spotId: string;
  spotName: string;
  sport: Sport;
  lat: number;
  lon: number;
}

export interface SportScore {
  sport: Sport;
  score: number;
  scoreBand: ScoreBand;
}

export interface SpotScoresResponse {
  scores: SportScore[];
}
