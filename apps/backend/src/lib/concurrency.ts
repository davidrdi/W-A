/**
 * Ejecuta `fn` sobre `items` con como mucho `limit` en vuelo a la vez.
 *
 * Se usa para las llamadas a Open-Meteo por lotes: con la vista nacional de
 * playas (miles de coordenadas → decenas de lotes) lanzarlos todos con
 * Promise.all dispara un pico de peticiones simultáneas que Open-Meteo
 * responde con 429 — su límite documentado (600/min) es generoso, pero la
 * IP de salida de Render es compartida con otros inquilinos (mismo motivo
 * por el que Nominatim también daba 429, ver geocoding.ts), así que un pico
 * de golpe puede saltarlo igualmente.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
