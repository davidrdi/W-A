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

/**
 * De dónde salen las zonas: "osm" son datos en vivo de Overpass (lo normal),
 * "seed" son las zonas precalculadas del repo, que entran cuando las APIs
 * públicas de OSM fallan. Se expone para que la UI pueda avisarlo en vez de
 * presentar unas y otras como si fueran lo mismo.
 */
export type ZonesSource = "osm" | "seed";

export interface OverviewSpot extends ScoredSpot {
  locality: string;
}

/**
 * Vista general por deporte, sin localidad: un pin por cada zona precalculada
 * de todo el país, para verse de golpe al elegir deporte, sin tener que
 * buscar ni hacer zoom. Se sirve siempre desde el conjunto precalculado —
 * pedir esto en vivo contra Overpass para todo el país en cada carga no es
 * viable con APIs públicas que limitan por IP.
 */
export interface OverviewResponse {
  sport: Sport;
  spots: OverviewSpot[];
}

export interface SpotsResponse {
  locality: string;
  sport: Sport;
  localityCenter: LatLon;
  spots: ScoredSpot[];
  source: ZonesSource;
}

/**
 * Un motivo concreto por el que una zona puntúa como puntúa. Sale del cálculo
 * determinista (scoring/rules.ts), no de la IA: es gratis, instantáneo y
 * siempre está disponible aunque no haya suscripción ni saldo de API.
 */
export interface ScoreFactor {
  /** Qué es, en corto: "Viento", "Barro de la lluvia de ayer". */
  label: string;
  /** El dato que lo respalda: "45 km/h", "18 mm". */
  detail: string;
  /** Cuánto suma o resta al score (negativo penaliza). */
  impact: number;
}

export interface ScoreBreakdown {
  score: number;
  scoreBand: ScoreBand;
  /** Ordenados por impacto: lo que más pesa, primero. */
  factors: ScoreFactor[];
  /** Diagnóstico en una línea, derivado del factor dominante. */
  headline: string;
}

export interface TideEvent {
  /** ISO local del pico o valle de marea. */
  time: string;
  kind: "pleamar" | "bajamar";
  /** Altura sobre el nivel medio del mar, en metros. */
  heightM: number;
}

export interface MarineSnapshot {
  waveHeightAvgM: number;
  waveHeightMaxM: number;
  seaSurfaceTempC: number;
  /**
   * Pleamares y bajamares de hoy, derivadas de la curva horaria de nivel del
   * mar. Puede venir vacío: no todos los puntos de la malla marina traen ese
   * dato, y en ese caso es mejor no enseñar mareas que enseñarlas inventadas.
   */
  tides?: TideEvent[];
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

/**
 * Ficha de una zona al tocar su pin. Todo lo de aquí es determinista y gratis
 * (métricas + diagnóstico del scoring): se sirve siempre, aunque no haya
 * suscripción ni saldo de API. Lo que aporta la IA —recomendar zonas
 * alternativas cercanas— va aparte, en /explain/alternatives.
 */
export interface SpotExplanation {
  score: number;
  scoreBand: ScoreBand;
  /** Diagnóstico en una línea: "Viento: 45 km/h". */
  headline: string;
  /** Motivos concretos, ordenados por cuánto pesan. */
  factors: ScoreFactor[];
  groundingPayload: SpotGroundingPayload;
}

export interface AlternativeSpot {
  spotId: string;
  name: string;
  score: number;
  distanceKm: number;
  /** Por qué merece el desplazamiento, con el dato que lo respalda. */
  why: string;
}

/** Respuesta de la función premium con IA: a qué otra zona ir y por qué. */
export interface AlternativesResponse {
  verdict: string;
  alternatives: AlternativeSpot[];
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

// Preferencias que el cuestionario extrae del texto libre, además de
// deporte y localidad. Todo opcional: ausencia de filtro = sin restricción.
export interface QueryFilters {
  requireDogsAllowed?: boolean;
  requireNaturist?: boolean;
  excludeNaturist?: boolean;
}

export interface QueryIntent {
  sport: Sport;
  /** Texto de localidad tal como Claude lo interpretó, para geocodificar. */
  localityText: string;
  filters: QueryFilters;
}

export interface QueryRequest {
  text: string;
}

export interface RankedSpot extends ScoredSpot {
  headline: string;
  reasoning: string;
}

export interface QueryResponse {
  intent: QueryIntent;
  locality: string;
  localityCenter: LatLon;
  spots: RankedSpot[];
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
