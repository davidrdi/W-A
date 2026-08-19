import { getSupabaseAdmin } from "../services/supabaseAdmin.js";

// Caché en dos niveles:
//   L1 memoria  — evita ida y vuelta a Supabase dentro del mismo proceso.
//   L2 Supabase — sobrevive a reinicios. Es el nivel que importa de verdad:
//                 el plan gratuito de Render duerme el servicio a los ~15 min
//                 sin tráfico, así que con caché solo en memoria CADA despertar
//                 volvía a pegarle a Nominatim y Overpass desde cero, que es
//                 justo lo que dispara sus 429/406. Con L2 la geografía (que no
//                 cambia) se calcula una vez y ya queda guardada.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const memory = new Map<string, Entry<unknown>>();

const TABLE = "api_cache";

// Si Supabase no está configurado (p.ej. en local sin .env) la caché sigue
// funcionando solo en memoria en vez de tumbar la petición.
let persistenceDisabled = false;

async function readPersisted<T>(key: string): Promise<Entry<T> | null> {
  if (persistenceDisabled) return null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select("value, expires_at")
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return null;

    const expiresAt = new Date(data.expires_at as string).getTime();
    if (expiresAt <= Date.now()) return null;

    return { value: data.value as T, expiresAt };
  } catch {
    // Falta de credenciales u otro fallo de infraestructura: se degrada a
    // memoria y no se vuelve a intentar, para no pagar el error en cada lectura.
    persistenceDisabled = true;
    return null;
  }
}

async function writePersisted(key: string, value: unknown, expiresAt: number): Promise<void> {
  if (persistenceDisabled) return;
  try {
    await getSupabaseAdmin()
      .from(TABLE)
      .upsert({ key, value, expires_at: new Date(expiresAt).toISOString() }, { onConflict: "key" });
  } catch {
    persistenceDisabled = true;
  }
}

export async function getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memory.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  const persisted = await readPersisted<T>(key);
  if (persisted) {
    memory.set(key, persisted);
    return persisted.value;
  }

  // Solo se cachean los aciertos: si fn() lanza, el error se propaga sin
  // guardarse — no queremos servir un fallo de Overpass durante 7 días.
  const value = await fn();
  const expiresAt = Date.now() + ttlMs;
  memory.set(key, { value, expiresAt });
  await writePersisted(key, value, expiresAt);
  return value;
}

/** Solo para tests: vacía el nivel de memoria. */
export function __clearMemoryCache() {
  memory.clear();
}

export const ONE_HOUR_MS = 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * ONE_HOUR_MS;
export const THIRTY_DAYS_MS = 30 * 24 * ONE_HOUR_MS;
