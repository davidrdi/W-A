import { describe, expect, it } from "vitest";
import { hashKey } from "./cache.js";

describe("hashKey", () => {
  it("la clave se queda corta pase lo que pase de larga la lista de partes", () => {
    // "Todas las playas de España" son miles de coordenadas — una clave que
    // las une literalmente revienta el límite de un índice btree de Postgres
    // (~2.7 KB). El hash tiene que quedarse corto siempre.
    const thousandsOfCoords = Array.from({ length: 5000 }, (_, i) => `${40 + i * 0.001},${-3 - i * 0.001}`);

    const key = hashKey("weather", thousandsOfCoords);

    expect(key.length).toBeLessThan(60);
  });

  it("el mismo conjunto de partes, en otro orden, da la misma clave", () => {
    const a = hashKey("weather", ["43.36,-8.41", "42.2,-8.72"]);
    const b = hashKey("weather", ["42.2,-8.72", "43.36,-8.41"]);

    expect(a).toBe(b);
  });

  it("conjuntos distintos dan claves distintas", () => {
    const a = hashKey("weather", ["43.36,-8.41"]);
    const b = hashKey("weather", ["42.2,-8.72"]);

    expect(a).not.toBe(b);
  });

  it("el prefijo queda legible en la clave (para poder inspeccionar la tabla a mano)", () => {
    expect(hashKey("marine", ["1,1"])).toMatch(/^marine:[0-9a-f]{32}$/);
  });
});
