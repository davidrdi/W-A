/**
 * Node (undici) lanza fallos de red como `TypeError: fetch failed` sin más —
 * el motivo real (DNS que no resuelve, TLS, timeout, conexión rechazada)
 * viaja en `error.cause`, que si no se lee explícitamente se pierde. Sin
 * esto, un fallo de conectividad y un fallo de DNS se ven exactamente
 * igual en el log ("fetch failed"), y no hay forma de distinguirlos sin
 * volver a intentarlo con más instrumentación.
 */
export function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return "error de red";

  const parts = [error.message];
  let cause = (error as { cause?: unknown }).cause;
  while (cause) {
    if (cause instanceof Error) {
      parts.push(cause.message);
      cause = (cause as { cause?: unknown }).cause;
    } else {
      parts.push(String(cause));
      break;
    }
  }
  return parts.join(" ← ");
}
