import type { LatLon, Spot, Sport } from "@w-a/shared";

import { findSeedLocality, seedSpotsFor } from "../data/seedZones.js";
import { resolveLocality } from "./geocoding.js";
import { findSpots } from "./spots.js";

export interface ResolvedZones {
  locality: string;
  localityCenter: LatLon;
  spots: Spot[];
  /** "osm" = datos en vivo de Overpass; "seed" = zonas de arranque del repo. */
  source: "osm" | "seed";
}

/**
 * Resuelve la localidad y sus zonas, con las APIs públicas de OSM como vía
 * principal y las zonas de arranque del repo como red de seguridad.
 *
 * Nominatim y Overpass limitan por IP y el backend vive en un hosting de IP
 * compartida, así que fallan de vez en cuando pase lo que pase por nuestra
 * parte. Antes eso dejaba el mapa vacío (o un 500); ahora la petición se
 * responde igual con las zonas precalculadas y el fallo se registra en el log
 * en vez de llegarle al usuario.
 */
export async function resolveZones(sport: Sport, locality: string, limit: number): Promise<ResolvedZones> {
  const seed = findSeedLocality(locality);

  try {
    const area = await resolveLocality(locality);
    const spots = await findSpots(sport, area.areaId, limit);

    // Overpass puede responder 200 con cero elementos (área sin ese tipo de
    // zona, o un areaId que no delimita nada). Si tenemos zonas de arranque
    // para esa localidad, valen más que una lista vacía.
    if (spots.length === 0 && seed) {
      const seeded = seedSpotsFor(seed, sport, limit);
      if (seeded.length > 0) {
        return { locality: seed.displayName, localityCenter: seed, spots: seeded, source: "seed" };
      }
    }

    return {
      locality: area.displayName,
      localityCenter: { lat: area.lat, lon: area.lon },
      spots,
      source: "osm",
    };
  } catch (error) {
    if (!seed) throw error;

    const seeded = seedSpotsFor(seed, sport, limit);
    if (seeded.length === 0) throw error;

    return { locality: seed.displayName, localityCenter: seed, spots: seeded, source: "seed" };
  }
}
