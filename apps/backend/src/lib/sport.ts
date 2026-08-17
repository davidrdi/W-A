import type { Sport } from "@w-a/shared";

// Lista única de deportes soportados — la usan las rutas (zod) y los
// servicios (Overpass/scoring), para no triplicar el listado.
export const SPORT_VALUES = [
  "running",
  "paseo",
  "senderismo",
  "bici",
  "playa",
  "surf",
  "windsurf",
] as const satisfies readonly Sport[];

const WATER_SPORTS = ["playa", "surf", "windsurf"] as const satisfies readonly Sport[];

export function isWaterSport(sport: Sport): boolean {
  return (WATER_SPORTS as readonly string[]).includes(sport);
}
