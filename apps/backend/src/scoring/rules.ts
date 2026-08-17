import type { ScoreBand, WeatherSnapshot } from "@w-a/shared";

// Reglas deterministas, no IA: el color del pin tiene que ser instantáneo y
// reproducible. Claude entra después, solo para explicar el score en texto
// (Fase 3), nunca para decidirlo.

function clampPenalty(value: number, max: number) {
  return Math.min(max, Math.max(0, value));
}

export function scoreBandFor(score: number): ScoreBand {
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "red";
}

const IDEAL_TEMP_MIN_C = 8;
const IDEAL_TEMP_MAX_C = 22;
const COMFORTABLE_WIND_KMH = 20;

/**
 * 0-100. Penaliza barro/charcos por la lluvia de ayer, correr bajo lluvia
 * hoy, viento fuerte sostenido y temperaturas fuera del rango cómodo.
 */
export function scoreRunning(weather: WeatherSnapshot): number {
  let score = 100;

  score -= clampPenalty(weather.rainYesterdayMm * 2, 40);
  score -= clampPenalty(weather.rainTodayMm * 3, 40);
  score -= clampPenalty((weather.windMaxTodayKmh - COMFORTABLE_WIND_KMH) * 1, 25);

  const tempDeviation =
    Math.max(0, weather.temperatureAvgTodayC - IDEAL_TEMP_MAX_C) +
    Math.max(0, IDEAL_TEMP_MIN_C - weather.temperatureAvgTodayC);
  score -= clampPenalty(tempDeviation * 2, 25);

  return Math.round(Math.min(100, Math.max(0, score)));
}
