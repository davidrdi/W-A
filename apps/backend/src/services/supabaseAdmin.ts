import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente perezoso, igual que el de Claude: si faltan las variables de
// entorno el servidor debe poder arrancar igual (solo falla al llamar de
// verdad a una ruta que necesite auth/favoritos).
let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!cachedClient) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno");
    }
    // Service role: bypassa RLS. El backend es quien debe filtrar siempre
    // por el user_id ya verificado (ver lib/auth.ts) — nunca confiar en un
    // user_id que venga del cliente.
    cachedClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }
  return cachedClient;
}
