// Caché en memoria del proceso — placeholder hasta que el modelo de datos
// (locality_boundaries / spot_query_cache / weather_cache en Postgres+PostGIS)
// esté conectado. Misma interfaz para que el swap no toque a los servicios.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export async function getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export const ONE_HOUR_MS = 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * ONE_HOUR_MS;
export const THIRTY_DAYS_MS = 30 * 24 * ONE_HOUR_MS;
