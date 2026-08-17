import { getSupabaseAdmin } from "./supabaseAdmin.js";

export async function upsertPushToken(userId: string, token: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("push_tokens")
    .upsert({ user_id: userId, token }, { onConflict: "user_id,token" });

  if (error) throw new Error(`Supabase respondió con error al guardar el push token: ${error.message}`);
}

/** Devuelve, para cada user_id pedido, sus tokens registrados. */
export async function listPushTokensByUserIds(userIds: string[]): Promise<Record<string, string[]>> {
  if (userIds.length === 0) return {};

  const { data, error } = await getSupabaseAdmin().from("push_tokens").select("user_id, token").in("user_id", userIds);
  if (error) throw new Error(`Supabase respondió con error al listar push tokens: ${error.message}`);

  const byUser: Record<string, string[]> = {};
  for (const row of (data ?? []) as { user_id: string; token: string }[]) {
    (byUser[row.user_id] ??= []).push(row.token);
  }
  return byUser;
}
