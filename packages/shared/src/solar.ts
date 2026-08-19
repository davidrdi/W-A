/**
 * Hora de salida y puesta de sol para un punto y una fecha.
 *
 * Cálculo puro (ecuación del orto / "sunrise equation"), sin llamar a
 * ninguna API — es matemática de posición solar, no un dato que cambie por
 * fuente. Precisión esperada del algoritmo: del orden de un par de minutos
 * en condiciones normales (no está pensado para crepúsculo civil/náutico de
 * precisión ni para latitudes polares).
 *
 * Referencia: https://en.wikipedia.org/wiki/Sunrise_equation
 */

export interface SunTimes {
  /** Instante UTC exacto (ISO 8601) de la salida del sol. */
  sunriseUtc: string;
  /** Instante UTC exacto (ISO 8601) de la puesta del sol. */
  sunsetUtc: string;
}

const DEG = Math.PI / 180;
const J2000 = 2451545.0;
// Corrección de tiempo de tránsito de luz de la Tierra a nueve minutos
// (0.0009 días), constante estándar de la ecuación del orto.
const J_CONST = 0.0009;

function mod360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function toJulianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

function fromJulianDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86_400_000);
}

/**
 * @param lat Latitud en grados (positivo = norte).
 * @param lon Longitud en grados (positivo = este; convención geográfica
 *   estándar — la ecuación original usa "oeste positivo", por eso se
 *   invierte el signo internamente).
 * @param date Cualquier instante del día para el que se quiere calcular.
 * @returns `null` si esa latitud no tiene salida/puesta ese día (sol de
 *   medianoche o noche polar) — no aplica a España, pero evita un resultado
 *   sin sentido si algún día se usa fuera de la península/islas.
 */
export function sunTimes(lat: number, lon: number, date: Date): SunTimes | null {
  const west = -lon;
  const jDate = toJulianDate(date);

  const n = Math.ceil(jDate - J2000 - J_CONST - west / 360);
  const jApprox = J2000 + J_CONST + west / 360 + n;

  const M = mod360(357.5291 + 0.98560028 * (jApprox - J2000));
  const mRad = M * DEG;
  const center = 1.9148 * Math.sin(mRad) + 0.02 * Math.sin(2 * mRad) + 0.0003 * Math.sin(3 * mRad);
  const lambda = mod360(M + 102.9372 + center + 180);
  const lambdaRad = lambda * DEG;

  const jTransit = jApprox + 0.0053 * Math.sin(mRad) - 0.0069 * Math.sin(2 * lambdaRad);

  const declination = Math.asin(Math.sin(lambdaRad) * Math.sin(23.4397 * DEG));
  const latRad = lat * DEG;
  // -0.833°: refracción atmosférica estándar + radio aparente del sol —
  // define "puesta" como el instante en que el borde superior del disco
  // solar cruza el horizonte, que es la convención civil habitual.
  const cosHourAngle =
    (Math.sin(-0.833 * DEG) - Math.sin(latRad) * Math.sin(declination)) / (Math.cos(latRad) * Math.cos(declination));

  if (cosHourAngle > 1 || cosHourAngle < -1) return null;

  const hourAngle = Math.acos(cosHourAngle) / DEG;
  const jSet = J2000 + J_CONST + (hourAngle + west) / 360 + n + 0.0053 * Math.sin(mRad) - 0.0069 * Math.sin(2 * lambdaRad);
  const jRise = jTransit - (jSet - jTransit);

  return { sunriseUtc: fromJulianDate(jRise).toISOString(), sunsetUtc: fromJulianDate(jSet).toISOString() };
}
