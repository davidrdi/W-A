import type { Sport, ZoneMode } from "@w-a/shared";

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

// Qué deportes se listan al abrir una zona del mapa, por modo. El orden es
// solo el de partida: al abrir la zona se reordenan por score real.
const LAND_SPORTS = ["senderismo", "bici", "running", "paseo"] as const satisfies readonly Sport[];

export function sportsForMode(mode: ZoneMode): Sport[] {
  return mode === "mar" ? [...WATER_SPORTS] : [...LAND_SPORTS];
}

/**
 * Deporte con el que se buscan sitios concretos dentro de una zona: en el
 * mar, playas; en tierra, senderos (con parques/sendas urbanas como red de
 * seguridad, porque los senderos etiquetados con sac_scale escasean fuera
 * de zona de montaña).
 */
export const MODE_SPOT_SPORT: Record<ZoneMode, Sport> = {
  mar: "playa",
  tierra: "senderismo",
};

export const MODE_FALLBACK_SPOT_SPORT: Partial<Record<ZoneMode, Sport>> = {
  tierra: "running",
};
