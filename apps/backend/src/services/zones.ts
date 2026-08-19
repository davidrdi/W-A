import type { LatLon, Spot, Sport, ZonesSource } from "@w-a/shared";

import { findSeedLocality, seedSpotsFor } from "../data/seedZones.js";
import { resolveLocality } from "./geocoding.js";
import { findSpots, SPORT_CATEGORY } from "./spots.js";
import { getSpotsNear } from "./spotsRepo.js";

export interface ResolvedZones {
  locality: string;
  localityCenter: LatLon;
  spots: Spot[];
  source: ZonesSource;
}

// Radio alrededor del centro de la localidad resuelta por geocoding. Antes
// Overpass acotaba por el polígono administrativo exacto; un radio fijo es
// una aproximación (un pueblo grande puede perder algún extremo, uno muy
// pequeño puede colar algo del vecino), pero suficiente para centrar el mapa
// y pedir meteo de la zona — igual de "aproximado por diseño" que las
// coordenadas de seedZones.ts.
const LOCALITY_RADIUS_KM = 25;

/**
 * Resuelve la localidad y sus zonas en tres pasos, del más barato al más caro:
 *
 * 1. Tabla `spots` precalculada (services/spotsRepo.ts) — ninguna llamada de
 *    red, la mantiene al día un job aparte (services/spotsRefresh.ts). Es el
 *    camino que toma casi cualquier localidad real hoy en día.
 * 2. Overpass en vivo (services/spots.ts) — solo para localidades sin
 *    cobertura en la tabla (pueblo fuera del conjunto curado de zonas de
 *    tierra, o refresco que todavía no ha corrido).
 * 3. Zonas de arranque del repo (data/seedZones.ts) — red de seguridad final
 *    si ni la tabla ni Overpass responden.
 */
export async function resolveZones(sport: Sport, locality: string, limit: number): Promise<ResolvedZones> {
  const seed = findSeedLocality(locality);

  let area;
  try {
    area = await resolveLocality(locality);
  } catch (error) {
    const seeded = seed ? seedSpotsFor(seed, sport, limit) : [];
    if (seeded.length === 0) throw error;
    return { locality: seed!.displayName, localityCenter: seed!, spots: seeded, source: "seed" };
  }

  const localityCenter = { lat: area.lat, lon: area.lon };
  const category = SPORT_CATEGORY[sport];

  try {
    const nearby = await getSpotsNear(category, localityCenter, LOCALITY_RADIUS_KM, limit);
    if (nearby.length > 0) {
      return {
        locality: area.displayName,
        localityCenter,
        spots: nearby.map((spot) => ({ ...spot, sport })),
        source: "db",
      };
    }
  } catch {
    // Tabla no disponible (Supabase caído): se sigue a la vía en vivo antes
    // de rendirse, igual que con cualquier otro fallo de infraestructura.
  }

  try {
    const spots = await findSpots(sport, area.areaId, limit);
    if (spots.length > 0) {
      return { locality: area.displayName, localityCenter, spots, source: "osm" };
    }
  } catch (error) {
    if (!seed) throw error;
  }

  if (!seed) {
    return { locality: area.displayName, localityCenter, spots: [], source: "osm" };
  }

  const seeded = seedSpotsFor(seed, sport, limit);
  if (seeded.length === 0) {
    return { locality: area.displayName, localityCenter, spots: [], source: "osm" };
  }
  return { locality: seed.displayName, localityCenter: seed, spots: seeded, source: "seed" };
}
