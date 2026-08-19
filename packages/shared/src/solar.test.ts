import { describe, expect, it } from "vitest";
import { sunTimes } from "./solar.js";

// El algoritmo es un cálculo astronómico estándar (ver solar.ts), no un dato
// verificado contra una fuente oficial desde este entorno (sin acceso a
// internet). Por eso las comprobaciones son por PROPIEDADES (la puesta va
// después de la salida, cae el día correcto, se mueve con la longitud de la
// forma esperada) en vez de contra una hora exacta memorizada — eso valida
// que el cálculo es coherente sin fingir una precisión que no puedo probar.

describe("sunTimes", () => {
  it("la puesta siempre es después de la salida, el mismo día en Madrid en verano", () => {
    const times = sunTimes(40.4168, -3.7038, new Date("2026-06-21T12:00:00Z"));

    expect(times).not.toBeNull();
    const sunrise = new Date(times!.sunriseUtc);
    const sunset = new Date(times!.sunsetUtc);
    expect(sunset.getTime()).toBeGreaterThan(sunrise.getTime());

    // España en junio: bastante más de 8h de luz solar (el mínimo posible en
    // el ecuador todo el año son 12h; en verano en latitud 40°N es bastante más).
    const daylightHours = (sunset.getTime() - sunrise.getTime()) / 3_600_000;
    expect(daylightHours).toBeGreaterThan(12);
    expect(daylightHours).toBeLessThan(16);
  });

  it("en invierno el día es más corto que en verano, en el mismo punto", () => {
    const summer = sunTimes(40.4168, -3.7038, new Date("2026-06-21T12:00:00Z"))!;
    const winter = sunTimes(40.4168, -3.7038, new Date("2026-12-21T12:00:00Z"))!;

    const hours = (t: { sunriseUtc: string; sunsetUtc: string }) =>
      (new Date(t.sunsetUtc).getTime() - new Date(t.sunriseUtc).getTime()) / 3_600_000;

    expect(hours(summer)).toBeGreaterThan(hours(winter));
  });

  it("moverse ~15° al este adelanta la puesta en UTC en aproximadamente una hora", () => {
    const west = sunTimes(40, -15, new Date("2026-06-21T12:00:00Z"))!;
    const east = sunTimes(40, 0, new Date("2026-06-21T12:00:00Z"))!;

    const diffMinutes =
      (new Date(west.sunsetUtc).getTime() - new Date(east.sunsetUtc).getTime()) / 60_000;

    // 15° de longitud equivalen a 1h de rotación terrestre; margen amplio
    // porque la ecuación de tiempo introduce una variación estacional.
    expect(diffMinutes).toBeGreaterThan(45);
    expect(diffMinutes).toBeLessThan(75);
  });

  it("devuelve null en sol de medianoche (círculo polar en pleno verano)", () => {
    const times = sunTimes(78, 15, new Date("2026-06-21T12:00:00Z"));
    expect(times).toBeNull();
  });
});
