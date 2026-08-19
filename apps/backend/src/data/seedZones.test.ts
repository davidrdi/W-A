import { describe, expect, it } from "vitest";
import { allSeedZones, findSeedLocality, seedSpotsFor } from "./seedZones.js";

describe("findSeedLocality", () => {
  it("encuentra A Coruña sin tildes", () => {
    expect(findSeedLocality("a coruna")?.displayName).toContain("A Coruña");
  });

  it("encuentra una localidad dentro de una frase más larga", () => {
    expect(findSeedLocality("playas cerca de vigo")?.displayName).toContain("Vigo");
  });

  it("devuelve null si no hay ninguna localidad precalculada que encaje", () => {
    expect(findSeedLocality("Villarriba del Alcor")).toBeNull();
  });
});

describe("seedSpotsFor", () => {
  it("filtra por categoría del deporte pedido y etiqueta el sport correcto", () => {
    const locality = findSeedLocality("a coruna")!;
    const spots = seedSpotsFor(locality, "playa", 8);

    expect(spots.length).toBeGreaterThan(0);
    expect(spots.every((s) => s.sport === "playa")).toBe(true);
    expect(spots.map((s) => s.name)).toContain("Playa de Riazor");
  });

  it("los ids nunca parecen ids de OSM", () => {
    const locality = findSeedLocality("madrid")!;
    const spots = seedSpotsFor(locality, "running", 8);

    expect(spots.every((s) => s.id.startsWith("seed/"))).toBe(true);
  });
});

describe("allSeedZones", () => {
  it("junta zonas de todas las localidades precalculadas para un deporte", () => {
    const zones = allSeedZones("playa");

    const localities = new Set(zones.map((z) => z.locality));
    expect(localities.size).toBeGreaterThan(1);
    expect(zones.every((z) => z.id.startsWith("seed/"))).toBe(true);
  });

  it("no devuelve zonas de deportes que no encajan (bici en una playa)", () => {
    const beachZones = allSeedZones("playa").map((z) => z.name);
    const cyclewayZones = allSeedZones("bici").map((z) => z.name);

    expect(beachZones.some((name) => cyclewayZones.includes(name))).toBe(false);
  });
});
