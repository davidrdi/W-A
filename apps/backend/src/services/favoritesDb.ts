import type { CreateFavoriteRequest, Favorite, Sport } from "@w-a/shared";

import { getSupabaseAdmin } from "./supabaseAdmin.js";

interface FavoriteRow {
  id: string;
  spot_id: string;
  spot_name: string;
  sport: string;
  lat: number;
  lon: number;
  created_at: string;
}

// V2 (notificaciones): un favorito con su propietario y la última fecha en
// que se evaluó, para el job de notificaciones — no se expone en la API
// pública de favoritos, solo lo usa favoritesNotifier.ts.
export interface FavoriteForNotification {
  id: string;
  userId: string;
  spotId: string;
  spotName: string;
  sport: Sport;
  lat: number;
  lon: number;
  lastNotifiedDate: string | null;
}

function rowToFavorite(row: FavoriteRow): Favorite {
  return {
    id: row.id,
    spotId: row.spot_id,
    spotName: row.spot_name,
    sport: row.sport as Favorite["sport"],
    lat: row.lat,
    lon: row.lon,
    createdAt: row.created_at,
  };
}

export async function listFavorites(userId: string): Promise<Favorite[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Supabase respondió con error al listar favoritos: ${error.message}`);
  return ((data ?? []) as FavoriteRow[]).map(rowToFavorite);
}

export async function createFavorite(userId: string, input: CreateFavoriteRequest): Promise<Favorite> {
  const { data, error } = await getSupabaseAdmin()
    .from("favorites")
    .upsert(
      {
        user_id: userId,
        spot_id: input.spotId,
        spot_name: input.spotName,
        sport: input.sport,
        lat: input.lat,
        lon: input.lon,
      },
      { onConflict: "user_id,spot_id,sport" },
    )
    .select()
    .single();

  if (error) throw new Error(`Supabase respondió con error al guardar el favorito: ${error.message}`);
  return rowToFavorite(data as FavoriteRow);
}

export async function deleteFavorite(userId: string, id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("favorites").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(`Supabase respondió con error al borrar el favorito: ${error.message}`);
}

interface FavoriteWithOwnerRow extends FavoriteRow {
  user_id: string;
  last_notified_date: string | null;
}

export async function listAllFavorites(): Promise<FavoriteForNotification[]> {
  const { data, error } = await getSupabaseAdmin().from("favorites").select("*");
  if (error) throw new Error(`Supabase respondió con error al listar todos los favoritos: ${error.message}`);

  return ((data ?? []) as FavoriteWithOwnerRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    spotId: row.spot_id,
    spotName: row.spot_name,
    sport: row.sport as Sport,
    lat: row.lat,
    lon: row.lon,
    lastNotifiedDate: row.last_notified_date,
  }));
}

export async function markFavoriteNotified(id: string, date: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("favorites").update({ last_notified_date: date }).eq("id", id);
  if (error) throw new Error(`Supabase respondió con error al marcar el favorito como notificado: ${error.message}`);
}
