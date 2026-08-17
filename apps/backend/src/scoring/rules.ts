import type { MarineSnapshot, ScoreBand, Sport, WeatherSnapshot } from "@w-a/shared";

// Reglas deterministas, no IA: el color del pin tiene que ser instantáneo y
// reproducible. Claude entra después, solo para explicar el score en texto
// (Fase 3), nunca para decidirlo.

function clampPenalty(value: number, max: number) {
  return Math.min(max, Math.max(0, value));
}

function clampScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function scoreBandFor(score: number): ScoreBand {
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "red";
}

const RUNNING_IDEAL_TEMP_MIN_C = 8;
const RUNNING_IDEAL_TEMP_MAX_C = 22;
const RUNNING_COMFORTABLE_WIND_KMH = 20;

/**
 * 0-100. Penaliza barro/charcos por la lluvia de ayer, correr bajo lluvia
 * hoy, viento fuerte sostenido y temperaturas fuera del rango cómodo.
 */
export function scoreRunning(weather: WeatherSnapshot): number {
  let score = 100;

  score -= clampPenalty(weather.rainYesterdayMm * 2, 40);
  score -= clampPenalty(weather.rainTodayMm * 3, 40);
  score -= clampPenalty((weather.windMaxTodayKmh - RUNNING_COMFORTABLE_WIND_KMH) * 1, 25);

  const tempDeviation =
    Math.max(0, weather.temperatureAvgTodayC - RUNNING_IDEAL_TEMP_MAX_C) +
    Math.max(0, RUNNING_IDEAL_TEMP_MIN_C - weather.temperatureAvgTodayC);
  score -= clampPenalty(tempDeviation * 2, 25);

  return clampScore(score);
}

/**
 * 0-100. Más tolerante que running con el barro de ayer (ritmo de paseo, no
 * de entreno), pero penaliza más llover HOY — un paseo no tiene sentido
 * bajo la lluvia.
 */
export function scorePaseo(weather: WeatherSnapshot): number {
  let score = 100;

  score -= clampPenalty(weather.rainYesterdayMm * 1.5, 30);
  score -= clampPenalty(weather.rainTodayMm * 4, 50);
  score -= clampPenalty((weather.windMaxTodayKmh - 25) * 1, 20);

  const tempDeviation =
    Math.max(0, weather.temperatureAvgTodayC - 26) + Math.max(0, 5 - weather.temperatureAvgTodayC);
  score -= clampPenalty(tempDeviation * 2, 25);

  return clampScore(score);
}

/**
 * 0-100. El barro en sendero de tierra penaliza más que en asfalto, y el
 * viento en cresta/altura es más determinante que en ciudad.
 */
export function scoreSenderismo(weather: WeatherSnapshot): number {
  let score = 100;

  score -= clampPenalty(weather.rainYesterdayMm * 2.5, 45);
  score -= clampPenalty(weather.rainTodayMm * 4, 45);
  score -= clampPenalty((weather.windMaxTodayKmh - 30) * 1.2, 30);

  const tempDeviation =
    Math.max(0, weather.temperatureAvgTodayC - 25) + Math.max(0, 3 - weather.temperatureAvgTodayC);
  score -= clampPenalty(tempDeviation * 1.5, 20);

  return clampScore(score);
}

/**
 * 0-100. El firme mojado (lluvia de HOY) es lo que más importa en bici —
 * penaliza fuerte; el viento también afecta más que a pie.
 */
export function scoreBici(weather: WeatherSnapshot): number {
  let score = 100;

  score -= clampPenalty(weather.rainTodayMm * 5, 50);
  score -= clampPenalty(weather.rainYesterdayMm * 1, 15);
  score -= clampPenalty((weather.windMaxTodayKmh - 25) * 1.3, 30);

  const tempDeviation =
    Math.max(0, weather.temperatureAvgTodayC - 28) + Math.max(0, 5 - weather.temperatureAvgTodayC);
  score -= clampPenalty(tempDeviation * 1.5, 20);

  return clampScore(score);
}

/**
 * 0-100. Playa "de tumbarse": quiere calor y poco viento; penaliza frío
 * mucho más que running, y el oleaje alto resta (incómodo para bañarse).
 */
export function scorePlaya(weather: WeatherSnapshot, marine: MarineSnapshot): number {
  let score = 100;

  score -= clampPenalty(weather.rainTodayMm * 6, 60);
  score -= clampPenalty((weather.windMaxTodayKmh - 20) * 1.5, 30);

  const tempDeviation =
    Math.max(0, 20 - weather.temperatureAvgTodayC) + Math.max(0, weather.temperatureAvgTodayC - 34);
  score -= clampPenalty(tempDeviation * 3, 35);

  score -= clampPenalty((marine.waveHeightMaxM - 1.2) * 15, 20);

  return clampScore(score);
}

const SURF_IDEAL_WAVE_M = 1.2;

/**
 * 0-100 partiendo de una base neutra (sin olas no hay surf aunque haga
 * sol): premia acercarse a una altura de ola "aprovechable" y penaliza
 * viento muy fuerte (desordena las olas) o mar prácticamente plano.
 */
export function scoreSurf(weather: WeatherSnapshot, marine: MarineSnapshot): number {
  let score = 60;

  score += Math.max(0, 30 - Math.abs(marine.waveHeightAvgM - SURF_IDEAL_WAVE_M) * 25);
  score -= clampPenalty(weather.rainTodayMm * 2, 20);
  score -= clampPenalty(Math.max(0, weather.windMaxTodayKmh - 35), 20);
  if (marine.waveHeightMaxM < 0.4) score -= 30;

  return clampScore(score);
}

const WINDSURF_IDEAL_WIND_KMH = 25;

/**
 * 0-100 partiendo de una base neutra (sin viento no hay windsurf): premia
 * acercarse al viento "aprovechable" y penaliza que sople demasiado poco.
 */
export function scoreWindsurf(weather: WeatherSnapshot, marine: MarineSnapshot): number {
  let score = 50;
  void marine; // reservado para cuando haya dirección de oleaje/swell (v2)

  score += Math.max(0, 40 - Math.abs(weather.windAvgTodayKmh - WINDSURF_IDEAL_WIND_KMH) * 2);
  score -= clampPenalty(weather.rainTodayMm * 2, 15);
  if (weather.windAvgTodayKmh < 12) score -= 30;

  return clampScore(score);
}

/** Deportes en tierra: solo necesitan el snapshot meteo. */
export function scoreLandSport(sport: Sport, weather: WeatherSnapshot): number {
  switch (sport) {
    case "running":
      return scoreRunning(weather);
    case "paseo":
      return scorePaseo(weather);
    case "senderismo":
      return scoreSenderismo(weather);
    case "bici":
      return scoreBici(weather);
    default:
      throw new Error(`scoreLandSport: deporte no soportado "${sport}"`);
  }
}

/** Deportes de agua: necesitan también el snapshot marino. */
export function scoreWaterSport(sport: Sport, weather: WeatherSnapshot, marine: MarineSnapshot): number {
  switch (sport) {
    case "playa":
      return scorePlaya(weather, marine);
    case "surf":
      return scoreSurf(weather, marine);
    case "windsurf":
      return scoreWindsurf(weather, marine);
    default:
      throw new Error(`scoreWaterSport: deporte no soportado "${sport}"`);
  }
}
