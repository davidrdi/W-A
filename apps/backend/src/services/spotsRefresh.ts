import { allSeedSpotsByCategory } from "../data/seedZones.js";
import { resolveLocality } from "./geocoding.js";
import { findSpotsRawByCategory, type SpotCategory } from "./spots.js";
import { replaceCategorySpots, type RepoSpot } from "./spotsRepo.js";

// "Todas las playas" pedido de verdad: con este tope, el único caso en que
// se recortaría es que España tenga más elementos natural=beach en OSM que
// esto — muy por encima de lo real — así que en la práctica equivale a sin
// límite, sin dejar de tener un techo defendible. Se reexporta porque
// routes/overview.ts la reutiliza en su vía de emergencia en vivo (cuando la
// tabla está vacía porque este job nunca llegó a correr).
export const NATIONWIDE_BEACH_LIMIT = 8000;

// Running/paseo (urbanPath), senderismo (trail) y bici (cycleway) se
// sincronizan desde el conjunto curado de seedZones.ts, no desde Overpass en
// vivo a escala nacional: la consulta equivalente (sendas y caminos
// peatonales de TODA España) es demasiado amplia para pedirla sin arriesgar
// el servicio (decisión explícita, ver README "Diseño de mapa").
const LAND_SPORT_CATEGORIES: SpotCategory[] = ["urbanPath", "trail", "cycleway"];

export interface RefreshResult {
  category: SpotCategory;
  count: number;
  source: "osm" | "seed";
}

/**
 * Sincroniza la tabla `spots` con Overpass para las playas de toda España.
 * Vive en un job aparte (POST /internal/refresh-spots) para que ninguna
 * petición de usuario dispare esta consulta — es la misma que antes
 * provocaba los 429 al pedir después el tiempo de miles de puntos de golpe.
 */
export async function refreshBeaches(): Promise<RefreshResult> {
  const spain = await resolveLocality("España");
  const raw = await findSpotsRawByCategory("beach", spain.areaId, NATIONWIDE_BEACH_LIMIT);

  const spots: RepoSpot[] = raw.map((spot) => ({ ...spot, category: "beach", source: "osm" }));
  await replaceCategorySpots("beach", spots);

  return { category: "beach", count: spots.length, source: "osm" };
}

/** Sincroniza la tabla `spots` con el conjunto curado de seedZones.ts para las categorías de tierra. */
export async function refreshLandZones(): Promise<RefreshResult[]> {
  const results: RefreshResult[] = [];

  for (const category of LAND_SPORT_CATEGORIES) {
    const zones = allSeedSpotsByCategory(category);
    const spots: RepoSpot[] = zones.map((zone) => ({ ...zone, category, source: "seed" }));
    await replaceCategorySpots(category, spots);
    results.push({ category, count: spots.length, source: "seed" });
  }

  return results;
}

export async function refreshAllSpots(): Promise<RefreshResult[]> {
  const beach = await refreshBeaches();
  const land = await refreshLandZones();
  return [beach, ...land];
}
