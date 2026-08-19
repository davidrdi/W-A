import type { MarineSnapshot, ScoreBand, ScoreBreakdown, ScoreFactor, Sport, WeatherSnapshot } from "@w-a/shared";

// Reglas deterministas, no IA: el color del pin tiene que ser instantáneo y
// reproducible. Cada regla devuelve además POR QUÉ puntúa así (los factores
// que han sumado o restado), de modo que el diagnóstico —"mucho viento para
// estar en la playa"— sale del propio cálculo y no cuesta ni una llamada a la
// IA. Claude entra después, opcionalmente, solo para redactarlo más fino.

function clampPenalty(value: number, max: number) {
  return Math.min(max, Math.max(0, value));
}

function clampScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)));
}

// Cuatro bandas a partes iguales sobre el 0-100: verde/amarillo/naranja/rojo,
// de mejor a peor condición.
export function scoreBandFor(score: number): ScoreBand {
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  if (score >= 25) return "orange";
  return "red";
}

/** Factor con impacto sin redondear: el score se calcula con el valor exacto. */
interface RawFactor {
  label: string;
  detail: string;
  impact: number;
}

function penalty(label: string, detail: string, raw: number, max: number): RawFactor | null {
  const value = clampPenalty(raw, max);
  // Por debajo de medio punto no se enseña: es ruido, no un motivo.
  return value >= 0.5 ? { label, detail, impact: -value } : null;
}

function bonus(label: string, detail: string, raw: number): RawFactor | null {
  return raw >= 0.5 ? { label, detail, impact: raw } : null;
}

function mm(value: number) {
  return `${Math.round(value)} mm`;
}

function kmh(value: number) {
  return `${Math.round(value)} km/h`;
}

function build(base: number, raw: (RawFactor | null)[]): ScoreBreakdown {
  const factors = raw.filter((f): f is RawFactor => f !== null);
  const score = clampScore(base + factors.reduce((sum, f) => sum + f.impact, 0));

  // Se ordena por impacto: lo que más pesa manda en el diagnóstico.
  const sorted = [...factors].sort((a, b) => a.impact - b.impact);
  const emitted: ScoreFactor[] = sorted.map((f) => ({
    label: f.label,
    detail: f.detail,
    impact: Math.round(f.impact),
  }));

  return { score, scoreBand: scoreBandFor(score), factors: emitted, headline: headlineFor(score, sorted) };
}

function headlineFor(score: number, sortedFactors: RawFactor[]): string {
  const worst = sortedFactors[0];
  const isGreen = scoreBandFor(score) === "green";
  if (isGreen || !worst || worst.impact > -8) {
    return isGreen ? "Buenas condiciones" : "Condiciones aceptables";
  }
  return `${worst.label}: ${worst.detail}`;
}

const RUNNING_IDEAL_TEMP_MIN_C = 8;
const RUNNING_IDEAL_TEMP_MAX_C = 22;
const RUNNING_COMFORTABLE_WIND_KMH = 20;

function tempFactor(weather: WeatherSnapshot, min: number, max: number, weight: number, cap: number) {
  const deviation =
    Math.max(0, weather.temperatureAvgTodayC - max) + Math.max(0, min - weather.temperatureAvgTodayC);
  const tooCold = weather.temperatureAvgTodayC < min;
  return penalty(
    tooCold ? "Temperatura baja" : "Temperatura alta",
    `${Math.round(weather.temperatureAvgTodayC)} °C`,
    deviation * weight,
    cap,
  );
}

/**
 * 0-100. Penaliza barro/charcos por la lluvia de ayer, correr bajo lluvia
 * hoy, viento fuerte sostenido y temperaturas fuera del rango cómodo.
 */
export function explainRunning(weather: WeatherSnapshot): ScoreBreakdown {
  return build(100, [
    penalty("Barro de la lluvia de ayer", mm(weather.rainYesterdayMm), weather.rainYesterdayMm * 2, 40),
    penalty("Lluvia hoy", mm(weather.rainTodayMm), weather.rainTodayMm * 3, 40),
    penalty("Viento", kmh(weather.windMaxTodayKmh), (weather.windMaxTodayKmh - RUNNING_COMFORTABLE_WIND_KMH) * 1, 25),
    tempFactor(weather, RUNNING_IDEAL_TEMP_MIN_C, RUNNING_IDEAL_TEMP_MAX_C, 2, 25),
  ]);
}

/**
 * 0-100. Más tolerante que running con el barro de ayer (ritmo de paseo, no
 * de entreno), pero penaliza más llover HOY — un paseo no tiene sentido
 * bajo la lluvia.
 */
export function explainPaseo(weather: WeatherSnapshot): ScoreBreakdown {
  return build(100, [
    penalty("Barro de la lluvia de ayer", mm(weather.rainYesterdayMm), weather.rainYesterdayMm * 1.5, 30),
    penalty("Lluvia hoy", mm(weather.rainTodayMm), weather.rainTodayMm * 4, 50),
    penalty("Viento", kmh(weather.windMaxTodayKmh), (weather.windMaxTodayKmh - 25) * 1, 20),
    tempFactor(weather, 5, 26, 2, 25),
  ]);
}

/**
 * 0-100. El barro en sendero de tierra penaliza más que en asfalto, y el
 * viento en cresta/altura es más determinante que en ciudad.
 */
export function explainSenderismo(weather: WeatherSnapshot): ScoreBreakdown {
  return build(100, [
    penalty("Barro en el sendero", mm(weather.rainYesterdayMm), weather.rainYesterdayMm * 2.5, 45),
    penalty("Lluvia hoy", mm(weather.rainTodayMm), weather.rainTodayMm * 4, 45),
    penalty("Viento en zona alta", kmh(weather.windMaxTodayKmh), (weather.windMaxTodayKmh - 30) * 1.2, 30),
    tempFactor(weather, 3, 25, 1.5, 20),
  ]);
}

/**
 * 0-100. El firme mojado (lluvia de HOY) es lo que más importa en bici —
 * penaliza fuerte; el viento también afecta más que a pie.
 */
export function explainBici(weather: WeatherSnapshot): ScoreBreakdown {
  return build(100, [
    penalty("Firme mojado", mm(weather.rainTodayMm), weather.rainTodayMm * 5, 50),
    penalty("Lluvia de ayer", mm(weather.rainYesterdayMm), weather.rainYesterdayMm * 1, 15),
    penalty("Viento", kmh(weather.windMaxTodayKmh), (weather.windMaxTodayKmh - 25) * 1.3, 30),
    tempFactor(weather, 5, 28, 1.5, 20),
  ]);
}

/**
 * 0-100. Playa "de tumbarse": quiere calor y poco viento; penaliza frío
 * mucho más que running, y el oleaje alto resta (incómodo para bañarse).
 */
export function explainPlaya(weather: WeatherSnapshot, marine: MarineSnapshot): ScoreBreakdown {
  return build(100, [
    penalty("Lluvia hoy", mm(weather.rainTodayMm), weather.rainTodayMm * 6, 60),
    penalty("Viento", kmh(weather.windMaxTodayKmh), (weather.windMaxTodayKmh - 20) * 1.5, 30),
    tempFactor(weather, 20, 34, 3, 35),
    penalty("Oleaje", `${marine.waveHeightMaxM} m`, (marine.waveHeightMaxM - 1.2) * 15, 20),
  ]);
}

const SURF_IDEAL_WAVE_M = 1.2;

/**
 * 0-100 partiendo de una base neutra (sin olas no hay surf aunque haga
 * sol): premia acercarse a una altura de ola "aprovechable" y penaliza
 * viento muy fuerte (desordena las olas) o mar prácticamente plano.
 */
export function explainSurf(weather: WeatherSnapshot, marine: MarineSnapshot): ScoreBreakdown {
  return build(60, [
    bonus(
      "Altura de ola",
      `${marine.waveHeightAvgM} m de media`,
      Math.max(0, 30 - Math.abs(marine.waveHeightAvgM - SURF_IDEAL_WAVE_M) * 25),
    ),
    penalty("Lluvia hoy", mm(weather.rainTodayMm), weather.rainTodayMm * 2, 20),
    penalty(
      "Viento fuerte (desordena la ola)",
      kmh(weather.windMaxTodayKmh),
      Math.max(0, weather.windMaxTodayKmh - 35),
      20,
    ),
    marine.waveHeightMaxM < 0.4
      ? { label: "Mar casi plano", detail: `${marine.waveHeightMaxM} m máx.`, impact: -30 }
      : null,
  ]);
}

const WINDSURF_IDEAL_WIND_KMH = 25;

/**
 * 0-100 partiendo de una base neutra (sin viento no hay windsurf): premia
 * acercarse al viento "aprovechable" y penaliza que sople demasiado poco.
 */
export function explainWindsurf(weather: WeatherSnapshot, marine: MarineSnapshot): ScoreBreakdown {
  void marine; // reservado para cuando haya dirección de oleaje/swell (v2)

  return build(50, [
    bonus(
      "Viento aprovechable",
      kmh(weather.windAvgTodayKmh),
      Math.max(0, 40 - Math.abs(weather.windAvgTodayKmh - WINDSURF_IDEAL_WIND_KMH) * 2),
    ),
    penalty("Lluvia hoy", mm(weather.rainTodayMm), weather.rainTodayMm * 2, 15),
    weather.windAvgTodayKmh < 12
      ? { label: "Falta viento", detail: kmh(weather.windAvgTodayKmh), impact: -30 }
      : null,
  ]);
}

/** Deportes en tierra: solo necesitan el snapshot meteo. */
export function explainLandSport(sport: Sport, weather: WeatherSnapshot): ScoreBreakdown {
  switch (sport) {
    case "running":
      return explainRunning(weather);
    case "paseo":
      return explainPaseo(weather);
    case "senderismo":
      return explainSenderismo(weather);
    case "bici":
      return explainBici(weather);
    default:
      throw new Error(`explainLandSport: deporte no soportado "${sport}"`);
  }
}

/** Deportes de agua: necesitan también el snapshot marino. */
export function explainWaterSport(sport: Sport, weather: WeatherSnapshot, marine: MarineSnapshot): ScoreBreakdown {
  switch (sport) {
    case "playa":
      return explainPlaya(weather, marine);
    case "surf":
      return explainSurf(weather, marine);
    case "windsurf":
      return explainWindsurf(weather, marine);
    default:
      throw new Error(`explainWaterSport: deporte no soportado "${sport}"`);
  }
}

// Atajos numéricos: el score sale del mismo cálculo que el desglose, así que
// no pueden desincronizarse.
export const scoreRunning = (w: WeatherSnapshot) => explainRunning(w).score;
export const scorePaseo = (w: WeatherSnapshot) => explainPaseo(w).score;
export const scoreSenderismo = (w: WeatherSnapshot) => explainSenderismo(w).score;
export const scoreBici = (w: WeatherSnapshot) => explainBici(w).score;
export const scorePlaya = (w: WeatherSnapshot, m: MarineSnapshot) => explainPlaya(w, m).score;
export const scoreSurf = (w: WeatherSnapshot, m: MarineSnapshot) => explainSurf(w, m).score;
export const scoreWindsurf = (w: WeatherSnapshot, m: MarineSnapshot) => explainWindsurf(w, m).score;
export const scoreLandSport = (sport: Sport, w: WeatherSnapshot) => explainLandSport(sport, w).score;
export const scoreWaterSport = (sport: Sport, w: WeatherSnapshot, m: MarineSnapshot) =>
  explainWaterSport(sport, w, m).score;
