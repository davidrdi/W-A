import { describe, expect, it } from "vitest";
import { buildPinHtml, cardinalDirection } from "./mapIcons.js";

describe("cardinalDirection", () => {
  it("mapea los 8 rumbos principales", () => {
    expect(cardinalDirection(0)).toBe("N");
    expect(cardinalDirection(45)).toBe("NE");
    expect(cardinalDirection(90)).toBe("E");
    expect(cardinalDirection(135)).toBe("SE");
    expect(cardinalDirection(180)).toBe("S");
    expect(cardinalDirection(225)).toBe("SO");
    expect(cardinalDirection(270)).toBe("O");
    expect(cardinalDirection(315)).toBe("NO");
  });

  it("redondea al rumbo más cercano en vez de fallar entre dos", () => {
    expect(cardinalDirection(20)).toBe("N");
    expect(cardinalDirection(30)).toBe("NE");
  });

  it("normaliza grados fuera de 0-360 (negativos o >360)", () => {
    expect(cardinalDirection(-10)).toBe("N");
    expect(cardinalDirection(370)).toBe("N");
    expect(cardinalDirection(360)).toBe("N");
  });
});

describe("buildPinHtml", () => {
  it("sin windDirectionDeg no añade la flecha de viento", () => {
    const html = buildPinHtml("running", "green");
    expect(html).not.toContain("<svg width=\"8\"");
  });

  it("con windDirectionDeg añade una flecha rotada a dirección+180 (apunta hacia dónde va el viento)", () => {
    const html = buildPinHtml("running", "green", 90);
    expect(html).toContain("rotate(270deg)");
  });
});
