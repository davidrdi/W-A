export type Sport = "running" | "paseo" | "senderismo" | "bici" | "playa" | "surf" | "windsurf";

export interface HealthResponse {
  status: "ok";
  service: string;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sport: Sport;
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
}

export interface FollowUpRequest {
  groundingPayload: SpotGroundingPayload;
  priorMessages: ChatMessage[];
  question: string;
}

export interface FollowUpResponse {
  answer: string;
}
