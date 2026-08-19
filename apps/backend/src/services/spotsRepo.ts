import type { LatLon, Spot, SpotAmenities } from "@w-a/shared";
import { distanceKm } from "@w-a/shared";

import { getSupabaseAdmin } from "./supabaseAdmin.js";
import type { SpotCategory } from "./spots.js";

const TABLE = "spots";

export interface RepoSpot extends Omit<Spot, "sport"> {
  category: SpotCategory;
  source: "osm" | "seed";
}

interface SpotRow {
  id: string;
  category: SpotCategory;
  name: string;
  lat: number;
  lon: number;
  amenities: SpotAmenities | null;
  source: "osm" | "seed";
}

function rowToRepoSpot(row: SpotRow): RepoSpot {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    amenities: row.amenities ?? undefined,
    source: row.source,
  };
}

// Reemplazo completo por categoría en vez de upsert selectivo: una playa que
// desaparece de OSM (o una zona que se quita de seedZones.ts) tiene que
// desaparecer también de aquí, no quedar huérfana para siempre.
//
// LÍMITE CONOCIDO: no es atómico (delete + insert por lotes, sin
// transacción — PostgREST no da una desde aquí). Si el insert falla a mitad
// de camino, la categoría queda parcialmente vacía hasta el siguiente
// refresco. Aceptable a esta escala (miles de filas como mucho, refresco
// periódico) — si esto creciera, la alternativa sería escribir a una tabla
// de staging y intercambiarla al final.
export async function replaceCategorySpots(category: SpotCategory, spots: RepoSpot[]): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error: deleteError } = await supabase.from(TABLE).delete().eq("category", category);
  if (deleteError) {
    throw new Error(`No se pudo limpiar la categoría "${category}" antes de refrescarla: ${deleteError.message}`);
  }

  if (spots.length === 0) return;

  const rows = spots.map((s) => ({
    id: s.id,
    category: s.category,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    amenities: s.amenities ?? null,
    source: s.source,
    updated_at: new Date().toISOString(),
  }));

  // Lotes de inserción: PostgREST tiene límites prácticos de tamaño de
  // payload, y "todas las playas de España" son varios miles de filas.
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await supabase.from(TABLE).insert(rows.slice(i, i + BATCH_SIZE));
    if (error) {
      throw new Error(`No se pudieron guardar las zonas de "${category}" (lote ${i}-${i + BATCH_SIZE}): ${error.message}`);
    }
  }
}

/** Todas las zonas de una categoría, sin filtrar por localidad — para la vista general nacional. */
export async function getSpotsByCategory(category: SpotCategory): Promise<RepoSpot[]> {
  const { data, error } = await getSupabaseAdmin().from(TABLE).select("*").eq("category", category);
  if (error) throw new Error(`No se pudieron leer las zonas de "${category}": ${error.message}`);
  return (data ?? []).map((row) => rowToRepoSpot(row as SpotRow));
}

function boundingBox(center: LatLon, radiusKm: number) {
  const latDelta = radiusKm / 111;
  // A esta latitud, un grado de longitud mide menos que uno de latitud —
  // se corrige con el coseno para no recortar de más ni de menos según la
  // latitud del punto.
  const lonDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLon: center.lon - lonDelta,
    maxLon: center.lon + lonDelta,
  };
}

/**
 * Zonas de una categoría cerca de un punto, más cercanas primero.
 *
 * Sin PostGIS aquí: se acota primero por bounding box (rápido, usa el
 * índice) y se calcula la distancia exacta en la aplicación para filtrar el
 * "círculo" real y ordenar — a la escala de España (unos pocos miles de
 * filas por categoría como mucho) es más que suficiente, sin necesitar una
 * extensión geográfica.
 */
export async function getSpotsNear(
  category: SpotCategory,
  center: LatLon,
  radiusKm: number,
  limit: number,
): Promise<RepoSpot[]> {
  const box = boundingBox(center, radiusKm);
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("*")
    .eq("category", category)
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lon", box.minLon)
    .lte("lon", box.maxLon);

  if (error) {
    throw new Error(`No se pudieron leer las zonas de "${category}" cerca de (${center.lat}, ${center.lon}): ${error.message}`);
  }

  return (data ?? [])
    .map((row) => ({ spot: rowToRepoSpot(row as SpotRow), distance: distanceKm(center, { lat: row.lat, lon: row.lon }) }))
    .filter((entry) => entry.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((entry) => entry.spot);
}
