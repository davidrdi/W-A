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

export interface RecommendResponse {
  locality: string;
  sport: Sport;
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
  spots: ScoredSpot[];
}
