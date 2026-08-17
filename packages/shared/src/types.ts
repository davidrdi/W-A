export type Sport = "running" | "paseo" | "senderismo" | "bici" | "playa" | "surf" | "windsurf";

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
