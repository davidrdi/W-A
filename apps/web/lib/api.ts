import type {
  ChatMessage,
  CreateFavoriteRequest,
  ExplainRequest,
  Favorite,
  FavoritesResponse,
  FollowUpResponse,
  ScoredSpot,
  SpotExplanation,
  SpotGroundingPayload,
  Sport,
  SpotsResponse,
  WeatherResponse,
  ZoneChip,
  ZoneDetailResponse,
  ZoneMode,
  ZonesResponse,
} from "@w-a/shared";

// Sin quitar la barra final, "https://host/" + "/spots" produce "//spots" y
// el backend responde 404 (Not Found) — normalizamos por si el valor
// configurado en Vercel/​.env trae esa barra.
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Backend respondió ${response.status}`);
  }
  return response.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? `Backend respondió ${response.status}`);
  }
  return response.json();
}

export function fetchSpots(sport: Sport, locality: string): Promise<SpotsResponse> {
  return getJson<SpotsResponse>("/spots", { sport, locality });
}

export function fetchWeather(locality: string): Promise<WeatherResponse> {
  return getJson<WeatherResponse>("/weather", { locality });
}

export interface ZonesViewport {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

export function fetchZones(mode: ZoneMode, viewport: ZonesViewport): Promise<ZonesResponse> {
  return getJson<ZonesResponse>("/zones", {
    mode,
    zoom: String(Math.round(viewport.zoom)),
    north: viewport.north.toFixed(4),
    south: viewport.south.toFixed(4),
    east: viewport.east.toFixed(4),
    west: viewport.west.toFixed(4),
  });
}

// El chip que ya tiene el cliente lleva todo lo que el backend necesita para
// el detalle (id, nombre, nivel y punto): no hace falta volver a resolverlo.
export function fetchZoneDetail(zone: ZoneChip, mode: ZoneMode): Promise<ZoneDetailResponse> {
  return getJson<ZoneDetailResponse>("/zones/detail", {
    id: zone.id,
    name: zone.name,
    level: zone.level,
    mode,
    lat: String(zone.lat),
    lon: String(zone.lon),
  });
}

export function explainSpot(spot: ScoredSpot): Promise<SpotExplanation> {
  const request: ExplainRequest = {
    sport: spot.sport,
    spotId: spot.id,
    name: spot.name,
    lat: spot.lat,
    lon: spot.lon,
    amenities: spot.amenities,
  };
  return postJson<SpotExplanation>("/explain", request);
}

export function askFollowUp(
  groundingPayload: SpotGroundingPayload,
  priorMessages: ChatMessage[],
  question: string,
): Promise<FollowUpResponse> {
  return postJson<FollowUpResponse>("/explain/followup", { groundingPayload, priorMessages, question });
}

export async function fetchFavorites(accessToken: string): Promise<FavoritesResponse> {
  const response = await fetch(`${API_URL}/favorites`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Backend respondió ${response.status}`);
  }
  return response.json();
}

export async function addFavorite(accessToken: string, input: CreateFavoriteRequest): Promise<Favorite> {
  const response = await fetch(`${API_URL}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Backend respondió ${response.status}`);
  }
  return response.json();
}

export async function removeFavorite(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`${API_URL}/favorites/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Backend respondió ${response.status}`);
  }
}
